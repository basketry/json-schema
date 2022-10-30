import {
  decodeRange,
  encodeRange,
  Enum,
  Literal,
  Parser,
  Primitive,
  Property,
  Service,
  Type,
  TypedValue,
  Union,
  ValidationRule,
  Violation,
} from 'basketry';
import parse = require('json-to-ast');
import { getName, resolve } from './json';
import * as AST from './json-schema';
import {
  parseObjectValidationRules,
  parseValidationRules,
} from './rule-factories';

export const jsonSchemaParser: Parser = (sourceContent, sourcePath) => {
  return new JsonSchemaParser(sourceContent, sourcePath).parse();
};

export type TypeKind = 'enum' | 'intersection' | 'union' | 'type' | 'primitive';

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
        basketry: '1',
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

  parseTitle(): Literal<string> {
    const name = this.parseTypeName(this.source);
    return name || { value: 'TODO' };
  }

  parseMajorVersion(): Literal<number> {
    return { value: 0 };
  }

  parseTypeName(
    schema: AST.AbstractSchemaNode | undefined,
  ): Literal<string> | undefined {
    if (!schema) return;
    if (schema.title) {
      return schema.title.asLiteral;
    }

    const [last, penultimate, ...rest] = schema._pointer.split('/').reverse();

    if (penultimate === 'definitions' || penultimate === '$defs') {
      return getName(this.source.node, schema._pointer);
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

    return { value };
  }

  parseIsRequired(schema: AST.AbstractSchemaNode | undefined): boolean {
    if (!schema) return false;

    const [last, penultimate, ...rest] = schema._pointer.split('/').reverse();
    if (penultimate !== 'properties') return false;

    const parentPointer = rest.reverse().join('/');
    const parent = resolve(this.source.node, parentPointer, AST.SchemaNode);

    return !!parent?.required?.some((name) => name.value === last);
  }

  parseKind(schema: AST.AbstractSchemaNode | undefined): TypeKind | undefined {
    if (!schema) return;

    if (schema.ref) {
      return this.parseKind(
        resolve(this.source.node, schema.ref.value, AST.SchemaNode),
      );
    } else if (schema.allOf) {
      return 'intersection';
    } else if (schema.anyOf) {
      return 'union';
    } else if (schema.oneOf) {
      return 'union';
    } else if (Array.isArray(schema.type)) {
      return 'union';
    } else if (schema.enum) {
      return 'enum';
    } else if (schema.type?.value === 'object') {
      return 'type';
    } else if (schema.type?.value === 'array') {
      return this.parseKind(
        // TODO: handle tuples
        Array.isArray(schema.items) ? schema.items[0] : schema.items,
      );
    } else {
      return 'primitive';
    }
  }

  parseType(
    schema: AST.AbstractSchemaNode | undefined,
    loc: string,
  ): TypedValue {
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

  parseRef(schema: AST.AbstractSchemaNode, loc: string): TypedValue {
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

  parseOneOfUnion(schema: AST.AbstractSchemaNode, loc: string): TypedValue {
    if (schema.oneOf) {
      const members: TypedValue[] = schema.oneOf.map((member) =>
        this.parseType(member, encodeRange(member.loc)),
      );

      const name = this.parseTypeName(schema);

      if (!name) return untyped(); // TODO

      this.unions.set(name.value, {
        name,
        loc,
        members,
      });

      return {
        typeName: name,
        isArray: false,
        isPrimitive: false,
        rules: [], // TODO
      };
    }

    return untyped();
  }

  parseTypeArrayUnion(schema: AST.AbstractSchemaNode, loc: string): TypedValue {
    if (Array.isArray(schema.type)) {
      // TODO
    }

    return untyped();
  }

  parseAnyOfUnion(schema: AST.AbstractSchemaNode, loc: string): TypedValue {
    if (schema.anyOf) {
      // TODO
    }

    return untyped();
  }

  parseIntersection(schema: AST.AbstractSchemaNode, loc: string): TypedValue {
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

      const properties: Property[] | undefined = objects
        .flatMap((node) => node.properties?.children)
        .filter((node): node is AST.SchemaRecordItem => !!node)
        .map((child) => {
          const typedValue = this.parseType(
            child.value,
            encodeRange(child.loc),
          );

          return {
            ...typedValue,
            name: child.key.asLiteral,
            description: child.value.description?.asLiteral,
            loc: encodeRange(child.loc),
          };
        });

      const rules = objects.flatMap((object) =>
        Array.from(parseObjectValidationRules(object)),
      );

      this.types.set(typeName.value, {
        name: typeName,
        description: schema.description?.asLiteral,
        properties: properties || [],
        rules,
        loc,
      });

      return {
        typeName,
        isArray: false,
        isPrimitive: false,
        rules: [], // TODO
      };
    }

    return untyped();
  }

  parseArray(schema: AST.AbstractSchemaNode, loc: string): TypedValue {
    if (!Array.isArray(schema.type) && schema.type?.value === 'array') {
      if (Array.isArray(schema.items)) {
        // TODO: union
        throw new Error('Not implemented exeption');
      } else {
        const items = this.parseType(
          schema.items,
          encodeRange(schema.items?.loc),
        );

        return { ...items, isArray: true };
      }
    }

    return untypedArray();
  }

  parseObject(schema: AST.AbstractSchemaNode, loc: string): TypedValue {
    if (!Array.isArray(schema.type) && schema.type?.value === 'object') {
      const typeName = this.parseTypeName(schema);
      if (!typeName) return untyped();

      if (!this.types.has(typeName.value)) {
        const properties: Property[] | undefined = schema.properties?.children
          .map((child) => this.parseProperty(child))
          .filter((prop): prop is Property => !!prop);

        this.types.set(typeName.value, {
          name: typeName,
          description: schema.description?.asLiteral,
          properties: properties || [],
          rules: Array.from(parseObjectValidationRules(schema)),
          loc,
        });
      }

      return {
        typeName,
        isArray: false,
        isPrimitive: false,
        rules: [], // TODO
      };
    }

    return untyped();
  }

  parseProperty(child: AST.SchemaRecordItem): Property | undefined {
    const typedValue = this.parseType(child.value, encodeRange(child.loc));

    return {
      ...typedValue,
      name: child.key.asLiteral,
      description: child.value.description?.asLiteral,
      loc: encodeRange(child.loc),
    };
  }

  parsePrimitive(schema: AST.AbstractSchemaNode, loc: string): TypedValue {
    if (!Array.isArray(schema.type)) {
      const rules = Array.from(this.parseRules(schema));

      // const loc = encodeRange(schema.type?.loc); // TODO
      const fromPrimitive = (primitive: Primitive) => ({
        typeName: { value: primitive, loc },
        isArray: false,
        isPrimitive: true,
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
        case 'null':
          return fromPrimitive('null');
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
        default:
          return untyped();
      }
    }
    return untyped();
  }

  parseEnum(schema: AST.AbstractSchemaNode, loc: string): TypedValue {
    if (schema.enum) {
      if (Array.isArray(schema.type) || schema.type?.value !== 'string') {
        // TODO: support non-string enums
        return untyped();
      }

      const name = this.parseTypeName(schema);
      if (!name) return untyped();

      const values: Enum['values'] = schema.enum
        .map((value) => value.asLiteral)
        .filter(
          // TODO: support non-string enums
          (value): value is Literal<string> => typeof value.value === 'string',
        );

      this.enums.set(name.value, { name, loc, values });

      return {
        typeName: name,
        isArray: false,
        isPrimitive: false,
        rules: [],
      };
    }
    return untyped();
  }

  parseRules(schema: AST.AbstractSchemaNode): ValidationRule[] {
    const rules: ValidationRule[] = [];

    if (this.parseIsRequired(schema)) {
      rules.push({ id: 'required' });
    }

    rules.push(...parseValidationRules(schema));

    return rules;
  }
}

function untyped(): TypedValue {
  return {
    typeName: { value: 'untyped' },
    isArray: false,
    isPrimitive: true,
    rules: [],
  };
}

function untypedArray(): TypedValue {
  return {
    typeName: { value: 'untyped' },
    isArray: true,
    isPrimitive: true,
    rules: [],
  };
}
