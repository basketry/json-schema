import {
  ComplexValue,
  decodeRange,
  encodeRange,
  Enum,
  EnumMember,
  IntegerLiteral,
  MemberValue,
  Parser,
  Primitive,
  PrimitiveValue,
  PrimitiveValueConstant,
  Property,
  Service,
  StringLiteral,
  Type,
  Union,
  ValidationRule,
  Violation,
} from 'basketry';
import parse = require('json-to-ast');
import { getName, resolve, LiteralNode, Literal } from './json';
import * as AST from './json-schema';
import {
  parseObjectValidationRules,
  parseValidationRules,
} from './rule-factories';
import { toDescription, toStringLiteral } from './utils';

export const jsonSchemaParser: Parser = (sourceContent, sourcePath) => {
  const x = new JsonSchemaParser(sourceContent, sourcePath).parse();
  return x;
};

class JsonSchemaParser {
  constructor(sourceContent: string, private readonly sourcePath: string) {
    this.source = new AST.DocumentNode(
      parse(sourceContent, { loc: true }),
      '#',
    );
  }

  private readonly source: AST.AbstractSchemaNode;

  private readonly types = new Map<string, Type>();
  private readonly enums = new Map<string, Enum>();
  private readonly unions = new Map<string, Union>();
  private readonly violations: Violation[] = [];

  parse(): { service: Service; violations: Violation[] } {
    this.parseType(this.source, encodeRange(this.source.loc));

    return {
      service: {
        kind: 'Service',
        basketry: '0.2',
        title: this.parseTitle(),
        sourcePath: 'source.ext',
        loc: encodeRange(this.source.loc),
        majorVersion: this.parseMajorVersion(),
        interfaces: [],
        types: Array.from(this.types.values()),
        enums: Array.from(this.enums.values()),
        unions: Array.from(this.unions.values()),
      },
      violations: [],
    };
  }

  parseTitle(): StringLiteral {
    const name = this.parseTypeName(this.source);
    return name || { kind: 'StringLiteral', value: 'TODO' };
  }

  parseMajorVersion(): IntegerLiteral {
    return { kind: 'IntegerLiteral', value: 0 };
  }

  parseTypeName(
    schema: AST.AbstractSchemaNode | undefined,
  ): StringLiteral | undefined {
    if (!schema) return;
    if (schema.title) {
      return toStringLiteral(schema.title);
    }

    const [last, penultimate, ...rest] = schema._pointer.split('/').reverse();

    if (penultimate === 'definitions' || penultimate === '$defs') {
      return toStringLiteral(getName(this.source.node, schema._pointer));
    }

    const previousPointer = () => {
      if (penultimate === 'properties') return rest.reverse().join('/');
      if (last === 'items') return [...rest.reverse(), penultimate].join('/');
      if (penultimate === 'oneOf') return rest.reverse().join('/');
      if (penultimate === 'allOf') return rest.reverse().join('/');
      return rest.reverse().join('/');
    };

    const previous = resolve(
      this.source.node,
      previousPointer(),
      AST.SchemaNode,
    );

    const previousName = this.parseTypeName(previous);

    const value = [previousName?.value, last].filter((x) => !!x).join('_');

    return { kind: 'StringLiteral', value };
  }

  parseIsRequired(schema: AST.AbstractSchemaNode | undefined): boolean {
    if (!schema) return false;

    const [last, penultimate, ...rest] = schema._pointer.split('/').reverse();
    if (penultimate !== 'properties') return false;

    const parentPointer = rest.reverse().join('/');
    const parent = resolve(this.source.node, parentPointer, AST.SchemaNode);

    return !!parent?.required?.some((name) => name.value === last);
  }

  parseType(
    schema: AST.AbstractSchemaNode | undefined,
    loc: string | undefined,
  ): MemberValue {
    if (!schema) return untyped();

    if (schema.definitions) {
      for (const child of schema.definitions.children) {
        this.parseType(child.value, encodeRange(child.loc));
      }
    }

    if (schema.ref) {
      return this.parseRef(schema, loc);
    } else if (schema.allOf) {
      return this.parseIntersection(schema, loc);
    } else if (schema.anyOf) {
      return this.parseAnyOfUnion(schema, loc);
    } else if (schema.oneOf) {
      return this.parseOneOfUnion(schema, loc);
    } else if (Array.isArray(schema.type)) {
      return this.parseTypeArrayUnion(schema, loc);
    } else if (schema.enum) {
      return this.parseEnum(schema, loc);
    } else if (schema.type?.value === 'object') {
      return this.parseObject(schema, loc);
    } else if (schema.type?.value === 'array') {
      return this.parseArray(schema, loc);
    } else {
      return this.parsePrimitive(schema, loc);
    }
  }

  parseRef(
    schema: AST.AbstractSchemaNode,
    loc: string | undefined,
  ): MemberValue {
    if (schema.ref) {
      const resolved = resolve(
        this.source.node,
        schema.ref.value,
        AST.SchemaNode,
      );

      if (resolved) {
        return this.parseType(resolved, loc);
      } else {
        this.violations.push({
          code: 'PARSER_ERROR',
          message: `Cannot resolve ref '${schema.ref.value}'`,
          severity: 'error',
          sourcePath: this.sourcePath,
          range: decodeRange(encodeRange(schema.ref.loc)),
        });
      }
    }

    return untyped();
  }

  // TODO: support intersected unions
  parseOneOfUnion(
    schema: AST.AbstractSchemaNode,
    loc: string | undefined,
  ): MemberValue {
    if (schema.oneOf) {
      const members: MemberValue[] = schema.oneOf.map((member) =>
        this.parseType(member, encodeRange(member.loc)),
      );
      const name = this.parseTypeName(schema);

      if (!name) return untyped(); // TODO

      if (schema.discriminator?.propertyName) {
        const { propertyName, mapping } = schema.discriminator;

        if (mapping) {
          this.violations.push({
            code: 'json-schema/unsupported-feature',
            message:
              'Discriminator mapping is not yet supported and will have no effect.',
            range: decodeRange(encodeRange(mapping.loc)),
            severity: 'info',
            sourcePath: this.sourcePath,
          });
        }

        // TODO: validate that the discriminator definition is compatable with the referenced types

        const complexTypes: ComplexValue[] = [];
        for (const member of members) {
          if (member.kind === 'PrimitiveValue') {
            this.violations.push({
              code: 'openapi-3/misconfigured-discriminator',
              message: 'Discriminators may not reference primitive types.',
              range: decodeRange(encodeRange(schema.discriminator.loc)),
              severity: 'error',
              sourcePath: this.sourcePath,
            });
          } else {
            complexTypes.push(member);
          }
        }

        const union: Union = {
          kind: 'DiscriminatedUnion',
          name,
          discriminator: toStringLiteral(propertyName),
          members: complexTypes,
          loc,
        };

        this.unions.set(name.value, union);
      } else {
        const primitiveMemebers = members.filter(
          (member) => member.kind === 'PrimitiveValue',
        );
        const complexMembers = members.filter(
          (member) => member.kind === 'ComplexValue',
        );

        if (primitiveMemebers.length === members.length) {
          this.unions.set(name.value, {
            kind: 'PrimitiveUnion',
            name,
            members: primitiveMemebers,
            loc,
          });
        } else if (complexMembers.length === members.length) {
          this.unions.set(name.value, {
            kind: 'ComplexUnion',
            name,
            members: complexMembers,
            loc,
          });
        } else {
          this.violations.push({
            code: 'json-schema/unsupported-feature',
            message:
              'Unions with a mix of primitive and complex members is not supported.',
            range: decodeRange(loc),
            severity: 'info',
            sourcePath: this.sourcePath,
          });
        }
      }

      return {
        kind: 'ComplexValue',
        typeName: name,
        rules: [], // TODO
      };
    }

    return untyped();
  }

  parseTypeArrayUnion(
    schema: AST.AbstractSchemaNode,
    loc: string | undefined,
  ): MemberValue {
    if (Array.isArray(schema.type)) {
      // TODO
    }

    return untyped();
  }

  parseAnyOfUnion(
    schema: AST.AbstractSchemaNode,
    loc: string | undefined,
  ): MemberValue {
    if (schema.anyOf) {
      // TODO
    }

    return untyped();
  }

  parseIntersection(
    schema: AST.AbstractSchemaNode,
    loc: string | undefined,
  ): MemberValue {
    if (schema.allOf) {
      const typeName = this.parseTypeName(schema);

      if (!typeName) return untyped();

      const objects = schema.allOf
        .map((node) =>
          node.ref
            ? resolve(this.source.node, node.ref.value, AST.SchemaNode)
            : node,
        )
        .filter(
          (node): node is AST.SchemaNode =>
            !Array.isArray(node?.type) && node?.type?.value === 'object',
        );

      // TODO: handle intersected unions

      const properties = this.parseIntersectionProperties(schema);

      const rules = objects.flatMap((object) =>
        Array.from(parseObjectValidationRules(object)),
      );

      this.types.set(typeName.value, {
        kind: 'Type',
        name: typeName,
        description: toDescription(schema.description),
        properties: properties || [],
        rules,
        loc,
      });

      return {
        kind: 'ComplexValue',
        typeName,
        rules: [], // TODO
      };
    }

    return untyped();
  }

  parseIntersectionProperties(schema: AST.AbstractSchemaNode): Property[] {
    const objects = schema.allOf
      ?.map((node) =>
        node.ref
          ? resolve(this.source.node, node.ref.value, AST.SchemaNode)
          : node,
      )
      .filter(
        (node): node is AST.SchemaNode =>
          !Array.isArray(node?.type) && node?.type?.value === 'object',
      );

    const properties: Property[] | undefined = objects
      ?.flatMap((node) => node.properties?.children)
      .filter((node): node is AST.SchemaRecordItem => !!node)
      .map((child) => this.parseProperty(child));

    return properties ?? [];
  }

  parseArray(
    schema: AST.AbstractSchemaNode,
    loc: string | undefined,
  ): MemberValue {
    if (!Array.isArray(schema.type) && schema.type?.value === 'array') {
      if (Array.isArray(schema.items)) {
        // TODO: union
        throw new Error('Not implemented exeption');
      } else {
        const items = this.parseType(
          schema.items,
          encodeRange(schema.items?.loc),
        );

        return {
          ...items,
          isArray: {
            kind: 'TrueLiteral',
            value: true,
            loc: encodeRange(schema.type.loc),
          },
        };
      }
    }

    return untypedArray();
  }

  parseObject(
    schema: AST.AbstractSchemaNode,
    loc: string | undefined,
  ): MemberValue {
    if (!Array.isArray(schema.type) && schema.type?.value === 'object') {
      const typeName = this.parseTypeName(schema);
      if (!typeName) return untyped();

      if (!this.types.has(typeName.value)) {
        const properties: Property[] | undefined = schema.properties?.children
          .filter((c) => !c.key.value.startsWith('$'))
          .map((child) => this.parseProperty(child))
          .filter((prop): prop is Property => !!prop);

        this.types.set(typeName.value, {
          kind: 'Type',
          name: typeName,
          description: toDescription(schema.description),
          properties: properties || [],
          rules: Array.from(parseObjectValidationRules(schema)),
          loc,
        });
      }

      return {
        kind: 'ComplexValue',
        typeName,
        rules: [], // TODO
      };
    }

    return untyped();
  }

  parseProperty(child: AST.SchemaRecordItem): Property {
    const memberValue = this.parseType(child.value, encodeRange(child.loc));

    if (memberValue.kind === 'PrimitiveValue') {
      return {
        kind: 'Property',
        name: toStringLiteral(child.key),
        description: toDescription(child.value.description),
        value: {
          ...memberValue,
          constant: toPrimitiveValueConstant(child.value.const),
          rules: this.parseRules(child.value),
        },
        loc: encodeRange(child.loc),
      };
    } else {
      return {
        kind: 'Property',
        name: toStringLiteral(child.key),
        description: toDescription(child.value.description),
        value: {
          ...memberValue,
          rules: this.parseRules(child.value),
        },
        loc: encodeRange(child.loc),
      };
    }
  }

  parsePrimitive(
    schema: AST.AbstractSchemaNode,
    loc: string | undefined,
  ): MemberValue {
    if (!Array.isArray(schema.type)) {
      const rules = Array.from(this.parseRules(schema));

      // const loc = encodeRange(schema.type?.loc); // TODO
      const fromPrimitive = (primitive: Primitive): PrimitiveValue => ({
        kind: 'PrimitiveValue',
        typeName: { kind: 'PrimitiveLiteral', value: primitive, loc },
        // constant: schema.const?.asLiteral, // TODO
        // default: schema.default?.asLiteral, // TODO
        rules,
      });

      switch (schema.type?.value) {
        case 'boolean':
          return fromPrimitive('boolean');
        case 'integer':
          switch (schema.format?.value) {
            case 'int64':
              return fromPrimitive('long');
            case 'int32':
            default:
              return fromPrimitive('integer');
          }
        case 'number':
          switch (schema.format?.value) {
            case 'float':
              return fromPrimitive('float');
            case 'double':
              return fromPrimitive('double');
            default:
              return fromPrimitive('number');
          }
        case 'string':
          switch (schema.format?.value) {
            case 'date':
              return fromPrimitive('date');
            case 'date-time':
              return fromPrimitive('date-time');
            default:
              return fromPrimitive('string');
          }
        case 'null':
        // return fromPrimitive('null'); // TODO
        default:
          return untyped();
      }
    }
    return untyped();
  }

  parseEnum(
    schema: AST.AbstractSchemaNode,
    loc: string | undefined,
  ): MemberValue {
    if (schema.enum) {
      if (Array.isArray(schema.type) || schema.type?.value !== 'string') {
        // TODO: support non-string enums
        return untyped();
      }

      const name = this.parseTypeName(schema);
      if (!name) return untyped();

      const members: EnumMember[] = schema.enum
        .map((value) => value.asLiteral)
        .filter(
          // TODO: support non-string enums
          (value): value is Literal<string> => typeof value.value === 'string',
        )
        .map((value) => ({
          kind: 'EnumMember',
          content: toStringLiteral(value),
        }));

      this.enums.set(name.value, { kind: 'Enum', name, loc, members });

      return {
        kind: 'ComplexValue',
        typeName: name,
        rules: [], // TODO
      };
    }
    return untyped();
  }

  parseRules(schema: AST.AbstractSchemaNode): ValidationRule[] {
    const rules: ValidationRule[] = [];

    if (this.parseIsRequired(schema)) {
      rules.push({ kind: 'ValidationRule', id: 'Required' });
    }

    rules.push(...parseValidationRules(schema));

    return rules;
  }
}

function untyped(): MemberValue {
  return {
    kind: 'PrimitiveValue',
    typeName: { kind: 'PrimitiveLiteral', value: 'untyped' },
    rules: [],
  };
}

function untypedArray(): MemberValue {
  return {
    kind: 'PrimitiveValue',
    typeName: { kind: 'PrimitiveLiteral', value: 'untyped' },
    isArray: { kind: 'TrueLiteral', value: true },
    rules: [],
  };
}

export function toPrimitiveValueConstant<T extends string | number | boolean>(
  node: LiteralNode<T> | undefined,
): PrimitiveValueConstant | undefined {
  if (!node) return undefined;

  const { value, loc } = node.asLiteral;

  switch (typeof value) {
    case 'string':
      return { kind: 'StringLiteral', value, loc };
    case 'number':
      return { kind: 'NumberLiteral', value, loc };
    case 'boolean':
      return { kind: 'BooleanLiteral', value, loc };
    default:
      throw new Error(`Unexpected constant value type: ${typeof value}`);
  }
}
