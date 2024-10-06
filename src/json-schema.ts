import { Location } from 'json-to-ast';
import { JsonNode, LiteralNode } from './json';

export abstract class AbstractSchemaNode extends JsonNode {
  get ref() {
    return this._literal<string>('$ref');
  }

  get title() {
    return this._literal<string>('title');
  }

  get description() {
    return this._literal<string>('description');
  }

  get multipleOf() {
    return this._literal<number>('multipleOf');
  }

  get maximum() {
    return this._literal<number>('maximum');
  }

  get exclusiveMaximum() {
    return this._literal<number>('exclusiveMaximum');
  }

  get minimum() {
    return this._literal<number>('minimum');
  }

  get exclusiveMinimum() {
    return this._literal<number>('exclusiveMinimum');
  }

  get maxLength() {
    return this._literal<number>('maxLength');
  }

  get minLength() {
    return this._literal<number>('minLength');
  }

  get pattern() {
    return this._literal<string>('pattern');
  }

  get items() {
    return this._array('items', SchemaNode) || this._child('items', SchemaNode);
  }

  get maxItems() {
    return this._literal<number>('maxItems');
  }

  get minItems() {
    return this._literal<number>('minItems');
  }

  get uniqueItems() {
    return this._literal<boolean>('uniqueItems');
  }

  get maxProperties() {
    return this._literal<number>('maxProperties');
  }

  get minProperties() {
    return this._literal<number>('minProperties');
  }

  get required() {
    return this._array<LiteralNode<string>>('required', LiteralNode);
  }

  get additionalProperties() {
    return this._child('additionalProperties', SchemaNode);
  }

  get definitions() {
    return this._child('definitions', SchemaRecordNode);
  }

  get properties() {
    return this._child('properties', SchemaRecordNode);
  }

  get enum() {
    return this._array('enum', LiteralNode);
  }

  get type() {
    return (
      this._array<LiteralNode<SimpleType>>('type', LiteralNode) ||
      this._child<LiteralNode<SimpleType>>('type', LiteralNode)
    );
  }

  get format() {
    return this._literal<string>('format');
  }

  get allOf() {
    return this._array('allOf', SchemaNode);
  }

  get anyOf() {
    return this._array('anyOf', SchemaNode);
  }

  get oneOf() {
    return this._array('oneOf', SchemaNode);
  }

  get discriminator() {
    return this._child('discriminator', DiscriminatorNode);
  }

  get const() {
    return this._literal<string | number | boolean>('const');
  }
}

export class DiscriminatorNode extends JsonNode {
  public readonly nodeType = 'Discriminator';

  get propertyName() {
    return this._literal<string>('propertyName');
  }

  get mapping() {
    return this._child('mapping', StringMappingNode);
  }
}

export class StringMappingNode extends AbstractSchemaNode {
  public readonly nodeType = 'StringMapping';

  read(key: string) {
    return this._literal<string>(key);
  }
}

export class DocumentNode extends AbstractSchemaNode {
  public readonly nodeType = 'DocumentNode';
}

export class SchemaNode extends AbstractSchemaNode {
  public readonly nodeType = 'SchemaNode';
}

export type SimpleType =
  | 'array'
  | 'boolean'
  | 'integer'
  | 'null'
  | 'number'
  | 'object'
  | 'string';

export type SchemaRecordItem = {
  loc: Location | undefined;
  key: LiteralNode<string>;
  value: SchemaNode;
};

export class SchemaRecordNode extends JsonNode {
  public readonly nodeType = 'SchemaRecordNode';

  get children(): SchemaRecordItem[] {
    return this._properties.map((prop) => ({
      loc: prop.loc,
      key: new LiteralNode<string>(prop.key, ''),
      value: new SchemaNode(prop.value, `${this._pointer}/${prop.key.value}`),
    }));
  }
}

export function isArrayType(
  type: AbstractSchemaNode['type'],
): type is LiteralNode<'array'> {
  return !Array.isArray(type) && type?.value === 'array';
}

export function isBooleanType(
  type: AbstractSchemaNode['type'],
): type is LiteralNode<'boolean'> {
  return !Array.isArray(type) && type?.value === 'boolean';
}

export function isNullType(
  type: AbstractSchemaNode['type'],
): type is LiteralNode<'null'> {
  return !Array.isArray(type) && type?.value === 'null';
}

export function isNumberType(
  type: AbstractSchemaNode['type'],
): type is LiteralNode<'number'> {
  return !Array.isArray(type) && type?.value === 'number';
}

export function isIntegerType(
  type: AbstractSchemaNode['type'],
): type is LiteralNode<'integer'> {
  return !Array.isArray(type) && type?.value === 'integer';
}

export function isNumericType(
  type: AbstractSchemaNode['type'],
): type is LiteralNode<'number' | 'integer'> {
  return (
    !Array.isArray(type) &&
    (type?.value === 'number' || type?.value === 'integer')
  );
}

export function isObjectType(
  type: AbstractSchemaNode['type'],
): type is LiteralNode<'object'> {
  return !Array.isArray(type) && type?.value === 'object';
}

export function isStringType(
  type: AbstractSchemaNode['type'],
): type is LiteralNode<'string'> {
  return !Array.isArray(type) && type?.value === 'string';
}
