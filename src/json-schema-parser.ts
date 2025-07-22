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
  TrueLiteral,
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

export const jsonSchemaParser: Parser = (sourceContent) => {
  const x = new JsonSchemaParser(sourceContent).parse();
  return x;
};

class JsonSchemaParser {
  constructor(sourceContent: string) {
    this.sourcePaths = ['#'];
    this.source = new AST.DocumentNode(
      parse(sourceContent, { loc: true }),
      '#',
    );
  }

  private readonly sourcePaths: string[];

  private readonly source: AST.AbstractSchemaNode;

  private readonly types = new Map<string, Type>();
  private readonly enums = new Map<string, Enum>();
  private readonly unions = new Map<string, Union>();
  private readonly violations: Violation[] = [];

  parse(): { service: Service; violations: Violation[] } {
    this.parseType(this.source, encodeRange(0, this.source.loc));

    return {
      service: {
        kind: 'Service',
        basketry: '0.2',
        title: this.parseTitle(),
        sourcePaths: this.sourcePaths,
        loc: encodeRange(0, this.source.loc),
        majorVersion: this.parseMajorVersion(),
        interfaces: [],
        types: Array.from(this.types.values()),
        enums: Array.from(this.enums.values()),
        unions: Array.from(this.unions.values()),
      },
      violations: this.violations,
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
  ): {
    memberValue: MemberValue;
    inheritedDescription: StringLiteral[];
  } {
    if (!schema) return { memberValue: untyped(), inheritedDescription: [] };

    if (schema.definitions) {
      for (const child of schema.definitions.children) {
        this.parseType(child.value, encodeRange(0, child.loc));
      }
    }

    const inheritedDescription: StringLiteral[] =
      toDescription(schema.description) ?? [];

    if (schema.ref) {
      const parsedRef = this.parseRef(schema, loc);

      if (parsedRef.inheritedDescription) {
        inheritedDescription.push(...parsedRef.inheritedDescription);
      }
      if (schema.description) {
        inheritedDescription.push(...toDescription(schema.description));
      }

      return {
        memberValue: parsedRef.memberValue,
        inheritedDescription,
      };
    } else if (schema.allOf) {
      return {
        memberValue: this.parseIntersection(schema, loc),
        inheritedDescription,
      };
    } else if (schema.anyOf) {
      return {
        memberValue: this.parseAnyOfUnion(schema, loc),
        inheritedDescription,
      };
    } else if (schema.oneOf) {
      if (schema.description) {
        inheritedDescription.push(...toDescription(schema.description));
      }
      return {
        memberValue: this.parseOneOfUnion(schema, loc),
        inheritedDescription,
      };
    } else if (Array.isArray(schema.type)) {
      // TODO: parse nullable here; any array that's [<type>, null] is a nullable <type>
      return {
        memberValue: this.parseTypeArrayUnion(schema, loc),
        inheritedDescription,
      };
    } else if (schema.enum) {
      return { memberValue: this.parseEnum(schema, loc), inheritedDescription };
    } else if (schema.type?.value === 'object') {
      return {
        memberValue: this.parseObject(schema, loc),
        inheritedDescription,
      };
    } else if (schema.type?.value === 'array') {
      return {
        memberValue: this.parseArray(schema, loc),
        inheritedDescription,
      };
    } else {
      return {
        memberValue: this.parsePrimitive(schema, loc),
        inheritedDescription,
      };
    }
  }

  parseRef(
    schema: AST.AbstractSchemaNode,
    loc: string | undefined,
  ): { memberValue: MemberValue; inheritedDescription: StringLiteral[] } {
    if (schema.ref) {
      const resolved = resolve(
        this.source.node,
        schema.ref.value,
        AST.SchemaNode,
      );

      if (resolved) {
        return this.parseType(resolved, loc);
      } else {
        const { range, sourceIndex } = decodeRange(
          encodeRange(0, schema.ref.loc),
        );
        this.violations.push({
          code: 'PARSER_ERROR',
          message: `Cannot resolve ref '${schema.ref.value}'`,
          severity: 'error',
          range,
          sourcePath: this.sourcePaths[sourceIndex],
        });
      }
    }

    return { memberValue: untyped(), inheritedDescription: [] };
  }

  // TODO: support intersected unions
  parseOneOfUnion(
    schema: AST.AbstractSchemaNode,
    loc: string | undefined,
  ): MemberValue {
    if (schema.oneOf) {
      const members: MemberValue[] = schema.oneOf.map(
        (member) =>
          this.parseType(member, encodeRange(0, member.loc)).memberValue,
      );
      const name = this.parseTypeName(schema);

      if (!name) return untyped(); // TODO

      if (schema.discriminator?.propertyName) {
        const { propertyName, mapping } = schema.discriminator;

        if (mapping) {
          const { range, sourceIndex } = decodeRange(
            encodeRange(0, mapping.loc),
          );
          this.violations.push({
            code: 'json-schema/unsupported-feature',
            message:
              'Discriminator mapping is not yet supported and will have no effect.',
            range,
            severity: 'info',
            sourcePath: this.sourcePaths[sourceIndex],
          });
        }

        // TODO: validate that the discriminator definition is compatable with the referenced types

        const complexTypes: ComplexValue[] = [];
        for (const member of members) {
          if (member.kind === 'PrimitiveValue') {
            const { range, sourceIndex } = decodeRange(
              encodeRange(0, schema.discriminator.loc),
            );
            this.violations.push({
              code: 'openapi-3/misconfigured-discriminator',
              message: 'Discriminators may not reference primitive types.',
              range,
              severity: 'error',
              sourcePath: this.sourcePaths[sourceIndex],
            });
          } else {
            complexTypes.push(member);
          }
        }

        const union: Union = {
          kind: 'DiscriminatedUnion',
          name,
          description: toDescription(schema.description),
          discriminator: toStringLiteral(propertyName),
          members: complexTypes,
          loc,
        };

        this.unions.set(name.value, union);
      } else {
        this.unions.set(name.value, {
          kind: 'SimpleUnion',
          name,
          description: toDescription(schema.description),
          members,
          loc,
        });
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
        const { memberValue: items } = this.parseType(
          schema.items,
          encodeRange(0, schema.items?.loc),
        );

        return {
          ...items,
          isArray: {
            kind: 'TrueLiteral',
            value: true,
            loc: encodeRange(0, schema.type.loc),
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
    const { memberValue, inheritedDescription } = this.parseType(
      child.value,
      encodeRange(0, child.loc),
    );

    const description: StringLiteral[] =
      toDescription(child.value.description) ?? [];

    if (
      inheritedDescription &&
      !description.length &&
      memberValue.kind === 'PrimitiveValue'
    ) {
      description.push(...inheritedDescription);
    }

    const isOptional = this.parseIsOptional(child.value);

    if (memberValue.kind === 'PrimitiveValue') {
      return {
        kind: 'Property',
        name: toStringLiteral(child.key),
        description: description.length ? description : undefined,
        value: {
          ...memberValue,
          constant: toPrimitiveValueConstant(child.value.const),
          isOptional,
          rules: this.parseRules(child.value),
        },
        loc: encodeRange(0, child.loc),
      };
    } else {
      return {
        kind: 'Property',
        name: toStringLiteral(child.key),
        description: description.length ? description : undefined,
        value: {
          ...memberValue,
          isOptional,
          rules: this.parseRules(child.value),
        },
        loc: encodeRange(0, child.loc),
      };
    }
  }

  parsePrimitive(
    schema: AST.AbstractSchemaNode,
    loc: string | undefined,
  ): MemberValue {
    if (!Array.isArray(schema.type)) {
      const rules = Array.from(this.parseRules(schema));

      // const loc = encodeRange(0,schema.type?.loc); // TODO
      const fromPrimitive = (primitive: Primitive): PrimitiveValue => ({
        kind: 'PrimitiveValue',
        typeName: { kind: 'PrimitiveLiteral', value: primitive, loc },
        // constant: schema.const?.asLiteral, // TODO
        // default: schema.default?.asLiteral, // TODO
        isOptional: this.parseIsOptional(schema),
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

      this.enums.set(name.value, {
        kind: 'Enum',
        description: toDescription(schema.description),
        name,
        loc,
        members,
      });

      return {
        kind: 'ComplexValue',
        typeName: name,
        rules: [], // TODO
      };
    }
    return untyped();
  }

  parseIsOptional(schema: AST.AbstractSchemaNode): TrueLiteral | undefined {
    if (this.parseIsRequired(schema)) return undefined;

    return {
      kind: 'TrueLiteral',
      value: true,
      // TODO: add loc
    };
  }

  parseRules(schema: AST.AbstractSchemaNode): ValidationRule[] {
    return Array.from(parseValidationRules(schema));
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
