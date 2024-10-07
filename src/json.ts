import { encodeRange } from 'basketry';
import * as parse from 'json-to-ast';

export type Literal<T extends string | number | boolean | null> = {
  value: T;
  loc?: string;
};

export type NodeConstructor<T extends JsonNode> = new (
  n: parse.ASTNode,
  p: string,
) => T;

export abstract class JsonNode {
  constructor(readonly node: parse.ASTNode, readonly _pointer: string) {}

  abstract readonly nodeType: string;

  /** Location of this JsonNode or undefined if location data has not been parsed. */
  get loc(): parse.Location | undefined {
    return this.node.loc;
  }

  /** Returns all of the object property keys in this node */
  get _keys(): parse.IdentifierNode[] {
    return isObjectNode(this.node) ? this.node.children.map((n) => n.key) : [];
  }

  /** Returns all of the object properties in this node */
  get _properties(): parse.PropertyNode[] {
    return isObjectNode(this.node) ? this.node.children : [];
  }

  /** Returns all of the array values in the node */
  get _values(): parse.ValueNode[] {
    return isArrayNode(this.node) ? this.node.children : [];
  }

  _propertyRange(key: string): string | undefined {
    const prop = this._property(key);

    return prop ? encodeRange(prop.loc) : undefined;
  }

  protected _child<T extends JsonNode>(
    key: string,
    Node: NodeConstructor<T>,
  ): T | undefined {
    const prop = this._property(key);
    return prop?.value
      ? new Node(prop.value, `${this._pointer}/${key}`)
      : undefined;
  }

  protected _array<T extends JsonNode>(
    key: string,
    Node: NodeConstructor<T>,
  ): T[] | undefined {
    const array = this._property(key)?.value;

    return isArrayNode(array)
      ? array.children.map(
          (n, i) => new Node(n, `${this._pointer}/${key}/${i}`),
        )
      : undefined;
  }

  protected _property(key: string): parse.PropertyNode | undefined {
    return isObjectNode(this.node)
      ? this.node.children.find((n) => n.key.value === key)
      : undefined;
  }

  protected _literal<T extends string | number | boolean | null>(
    key: string,
  ): LiteralNode<T> | undefined {
    return this._child(key, LiteralNode) as LiteralNode<T> | undefined;
  }
}

export class LiteralNode<
  T extends string | number | boolean | null,
> extends JsonNode {
  public readonly nodeType = 'Literal';
  constructor(node: parse.ASTNode, _pointer: string) {
    super(node, _pointer);
  }

  get asLiteral(): Literal<T> {
    return {
      value: this.value,
      loc: this.loc ? encodeRange(this.loc) : undefined,
    };
  }

  get value(): T {
    if (isLiteralNode(this.node) || isIdentifierNode(this.node)) {
      return this.node.value as T;
    }
    throw new Error('Cannot parse literal');
  }
}

export function resolve<T extends JsonNode>(
  document: parse.ASTNode,
  pointer: string,
  Node: NodeConstructor<T>,
): T | undefined {
  let cursor: parse.ASTNode | undefined = undefined;
  for (const segment of pointer.split('/')) {
    if (segment === '#') {
      cursor = document;
      continue;
    } else if (!cursor) {
      return undefined;
    }

    if (isArrayNode(cursor)) {
      const index = Number(segment);
      if (!Number.isNaN(index)) {
        cursor = cursor.children[index];
      } else {
        return undefined;
      }
    } else if (isObjectNode(cursor)) {
      const child = cursor.children.find((c) => c.key.value === segment);
      if (child) {
        cursor = child.value;
      } else {
        return undefined;
      }
    }
  }

  return cursor ? new Node(cursor, pointer) : undefined;
}

export function getName(
  document: parse.ASTNode,
  pointer: string,
): Literal<string> | undefined {
  let name: Literal<string> | undefined = undefined;
  let cursor: parse.ASTNode | undefined = undefined;
  for (const segment of pointer.split('/')) {
    if (segment === '#') {
      cursor = document;
      continue;
    } else if (!cursor) {
      return undefined;
    }

    if (isArrayNode(cursor)) {
      const index = Number(segment);
      if (!Number.isNaN(index)) {
        cursor = cursor.children[index];
      } else {
        return undefined;
      }
    } else if (isObjectNode(cursor)) {
      const child: parse.PropertyNode | undefined = cursor.children.find(
        (c) => c.key.value === segment,
      );
      if (child) {
        name = {
          value: child.key.value,
          loc: encodeRange(child.key.loc),
        };
        cursor = child.value;
      } else {
        return undefined;
      }
    }
  }

  return name;
}

export function range(node: parse.ASTNode | JsonNode): string | undefined {
  const loc = node.loc;

  return encodeRange(loc);
}

export function isObjectNode(
  node: parse.ASTNode | undefined,
): node is parse.ObjectNode {
  return node?.type === 'Object';
}

export function isPropertyNode(
  node: parse.ASTNode | undefined,
): node is parse.PropertyNode {
  return node?.type === 'Property';
}

export function isIdentifierNode(
  node: parse.ASTNode | undefined,
): node is parse.IdentifierNode {
  return node?.type === 'Identifier';
}

export function isArrayNode(
  node: parse.ASTNode | undefined,
): node is parse.ArrayNode {
  return node?.type === 'Array';
}

export function isLiteralNode(
  node: parse.ASTNode | undefined,
): node is parse.LiteralNode {
  return node?.type === 'Literal';
}

export function isValueNode(
  node: parse.ASTNode | undefined,
): node is parse.ValueNode {
  return isObjectNode(node) || isArrayNode(node) || isLiteralNode(node);
}
