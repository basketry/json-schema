import {
  NonEmptyStringLiteral,
  NonNegativeNumberLiteral,
  NumberLiteral,
  StringLiteral,
} from 'basketry';
import { Literal, LiteralNode } from './json';

export function toStringLiteral(
  node: Literal<string> | LiteralNode<string>,
): StringLiteral;
// eslint-disable-next-line no-redeclare
export function toStringLiteral(
  node: Literal<string> | LiteralNode<string> | undefined,
): StringLiteral | undefined;
// eslint-disable-next-line no-redeclare
export function toStringLiteral(
  node: Literal<string> | LiteralNode<string> | undefined,
): StringLiteral | undefined {
  if (!node) return undefined;

  return 'nodeType' in node
    ? { kind: 'StringLiteral', ...node.asLiteral }
    : { kind: 'StringLiteral', ...node };
}

export function toNonEmptyStringLiteral(
  node: Literal<string> | LiteralNode<string>,
): NonEmptyStringLiteral;
// eslint-disable-next-line no-redeclare
export function toNonEmptyStringLiteral(
  node: Literal<string> | LiteralNode<string> | undefined,
): NonEmptyStringLiteral | undefined;
// eslint-disable-next-line no-redeclare
export function toNonEmptyStringLiteral(
  node: Literal<string> | LiteralNode<string> | undefined,
): NonEmptyStringLiteral | undefined {
  if (!node) return undefined;

  return 'nodeType' in node
    ? { kind: 'NonEmptyStringLiteral', ...node.asLiteral }
    : { kind: 'NonEmptyStringLiteral', ...node };
}

export function toNonNegativeNumberLiteral(
  node: Literal<number> | LiteralNode<number>,
): NonNegativeNumberLiteral;
// eslint-disable-next-line no-redeclare
export function toNonNegativeNumberLiteral(
  node: Literal<number> | LiteralNode<number> | undefined,
): NonNegativeNumberLiteral | undefined;
// eslint-disable-next-line no-redeclare
export function toNonNegativeNumberLiteral(
  node: Literal<number> | LiteralNode<number> | undefined,
): NonNegativeNumberLiteral | undefined {
  if (!node) return undefined;

  return 'nodeType' in node
    ? { kind: 'NonNegativeNumberLiteral', ...node.asLiteral }
    : { kind: 'NonNegativeNumberLiteral', ...node };
}

export function toNumberLiteral(
  node: Literal<number> | LiteralNode<number>,
): NumberLiteral;
// eslint-disable-next-line no-redeclare
export function toNumberLiteral(
  node: Literal<number> | LiteralNode<number> | undefined,
): NumberLiteral | undefined;
// eslint-disable-next-line no-redeclare
export function toNumberLiteral(
  node: Literal<number> | LiteralNode<number> | undefined,
): NumberLiteral | undefined {
  if (!node) return undefined;

  return 'nodeType' in node
    ? { kind: 'NumberLiteral', ...node.asLiteral }
    : { kind: 'NumberLiteral', ...node };
}

export function toDescription(node: LiteralNode<string>): StringLiteral[];
// eslint-disable-next-line no-redeclare
export function toDescription(
  node: LiteralNode<string> | undefined,
): StringLiteral[] | undefined;
// eslint-disable-next-line no-redeclare
export function toDescription(
  node: LiteralNode<string> | undefined,
): StringLiteral[] | undefined {
  if (!node) return undefined;

  const { value, loc } = node?.asLiteral;

  const paragraphs = value.split('\n\n');

  return paragraphs.map((paragraph) => ({
    kind: 'StringLiteral',
    value: paragraph,
    loc,
  }));
}
