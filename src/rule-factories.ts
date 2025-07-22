import {
  NonNegativeIntegerLiteral,
  ObjectValidationRule,
  StringLiteral,
  ValidationRule,
} from 'basketry';
import { Literal, LiteralNode } from './json';
import * as AST from './json-schema';
import {
  toNonEmptyStringLiteral,
  toNonNegativeNumberLiteral,
  toNumberLiteral,
  toStringLiteral,
} from './utils';

export interface ValidationRuleFactory {
  (node: AST.AbstractSchemaNode): ValidationRule | undefined;
}

export interface ObjectValidationRuleFactory {
  (node: AST.AbstractSchemaNode): ObjectValidationRule | undefined;
}

export function* parseValidationRules(
  node: AST.AbstractSchemaNode,
): Iterable<ValidationRule> {
  const factories: ValidationRuleFactory[] = [
    stringMaxLengthFactory,
    stringMinLengthFactory,
    stringPatternFactory,
    stringFormatFactory,
    numberMultipleOfFactory,
    numberGreaterThanFactory,
    numberLessThanFactory,
    arrayMinItemsFactory,
    arrayMaxItemsFactory,
    arrayUniqueItemsFactory,
  ];

  for (const factory of factories) {
    const rule = factory(node);
    if (rule) yield rule;
  }
}

export function* parseObjectValidationRules(
  node: AST.AbstractSchemaNode,
): Iterable<ObjectValidationRule> {
  const factories: ObjectValidationRuleFactory[] = [
    objectMinPropertiesFactory,
    objectMaxPropertiesFactory,
    objectAdditionalPropertiesFactory,
  ];

  for (const factory of factories) {
    const rule = factory(node);
    if (rule) yield rule;
  }
}

export const stringMaxLengthFactory: ValidationRuleFactory = (node) => {
  if (
    AST.isStringType(node.type) &&
    typeof node.maxLength?.value === 'number'
  ) {
    return {
      kind: 'ValidationRule',
      id: 'StringMaxLength',
      length: toNonNegativeIntegerLiteral(node.maxLength),
      loc: node._propertyRange('maxLength'),
    };
  } else {
    return;
  }
};

export const stringMinLengthFactory: ValidationRuleFactory = (node) => {
  if (
    AST.isStringType(node.type) &&
    typeof node.minLength?.value === 'number'
  ) {
    return {
      kind: 'ValidationRule',
      id: 'StringMinLength',
      length: toNonNegativeIntegerLiteral(node.minLength),
      loc: node._propertyRange('minLength'),
    };
  } else {
    return;
  }
};

export const stringPatternFactory: ValidationRuleFactory = (node) => {
  if (AST.isStringType(node.type) && typeof node.pattern?.value === 'string') {
    return {
      kind: 'ValidationRule',
      id: 'StringPattern',
      pattern: toNonEmptyStringLiteral(node.pattern),
      loc: node._propertyRange('pattern'),
    };
  } else {
    return;
  }
};

export const stringFormatFactory: ValidationRuleFactory = (node) => {
  if (AST.isStringType(node.type) && typeof node.format?.value === 'string') {
    return {
      kind: 'ValidationRule',
      id: 'StringFormat',
      format: toNonEmptyStringLiteral(node.format),
      loc: node._propertyRange('format'),
    };
  } else {
    return;
  }
};

export const numberMultipleOfFactory: ValidationRuleFactory = (node) => {
  if (
    AST.isNumericType(node.type) &&
    typeof node.multipleOf?.value === 'number'
  ) {
    return {
      kind: 'ValidationRule',
      id: 'NumberMultipleOf',
      value: toNonNegativeNumberLiteral(node.multipleOf),
      loc: node._propertyRange('multipleOf'),
    };
  } else {
    return;
  }
};

export const numberGreaterThanFactory: ValidationRuleFactory = (node) => {
  if (AST.isNumericType(node.type) && typeof node.minimum?.value === 'number') {
    return {
      kind: 'ValidationRule',
      id: node.exclusiveMinimum?.value ? 'NumberGT' : 'NumberGTE',
      value: toNumberLiteral(node.minimum),
      loc: node._propertyRange('minimum'),
    };
  } else {
    return;
  }
};

export const numberLessThanFactory: ValidationRuleFactory = (node) => {
  if (AST.isNumericType(node.type) && typeof node.maximum?.value === 'number') {
    return {
      kind: 'ValidationRule',
      id: node.exclusiveMaximum?.value ? 'NumberLT' : 'NumberLTE',
      value: toNumberLiteral(node.maximum),
      loc: node._propertyRange('maximum'),
    };
  } else {
    return;
  }
};

export const arrayMinItemsFactory: ValidationRuleFactory = (node) => {
  if (AST.isArrayType(node.type) && typeof node.minItems?.value === 'number') {
    return {
      kind: 'ValidationRule',
      id: 'ArrayMinItems',
      min: toNonNegativeIntegerLiteral(node.minItems),
      loc: node._propertyRange('minItems'),
    };
  } else {
    return;
  }
};

export const arrayMaxItemsFactory: ValidationRuleFactory = (node) => {
  if (AST.isArrayType(node.type) && typeof node.maxItems?.value === 'number') {
    return {
      kind: 'ValidationRule',
      id: 'ArrayMaxItems',
      max: toNonNegativeIntegerLiteral(node.maxItems),
      loc: node._propertyRange('maxItems'),
    };
  } else {
    return;
  }
};

export const arrayUniqueItemsFactory: ValidationRuleFactory = (node) => {
  if (AST.isArrayType(node.type) && node.uniqueItems?.value) {
    return {
      kind: 'ValidationRule',
      id: 'ArrayUniqueItems',
      required: true,
      loc: node._propertyRange('uniqueItems'),
    };
  } else {
    return;
  }
};

export const objectMinPropertiesFactory: ObjectValidationRuleFactory = (
  node,
) => {
  if (
    AST.isObjectType(node.type) &&
    typeof node.minProperties?.value === 'number'
  ) {
    return {
      kind: 'ObjectValidationRule',
      id: 'ObjectMinProperties',
      min: toNonNegativeIntegerLiteral(node.minProperties),
      loc: node._propertyRange('minProperties')!,
    };
  } else {
    return;
  }
};

export const objectMaxPropertiesFactory: ObjectValidationRuleFactory = (
  node,
) => {
  if (
    AST.isObjectType(node.type) &&
    typeof node.maxProperties?.value === 'number'
  ) {
    return {
      kind: 'ObjectValidationRule',
      id: 'ObjectMaxProperties',
      max: toNonNegativeIntegerLiteral(node.maxProperties),
      loc: node._propertyRange('maxProperties'),
    };
  } else {
    return;
  }
};

export const objectAdditionalPropertiesFactory: ObjectValidationRuleFactory = (
  node,
) => {
  return undefined; // TODO
  // if (
  //   AST.isObjectType(node.type) &&
  //   AST.isBooleanType(node.additionalProperties?.type)
  // ) {
  //   return {
  //     id: 'object-additional-properties',
  //     forbidden: true,
  //     loc: node._propertyRange('additionalProperties')!,
  //   };
  // } else {
  //   return;
  // }
};

function toNonNegativeIntegerLiteral(
  node: Literal<number> | LiteralNode<number>,
): NonNegativeIntegerLiteral {
  return 'nodeType' in node
    ? { kind: 'NonNegativeIntegerLiteral', ...node.asLiteral }
    : { kind: 'NonNegativeIntegerLiteral', ...node };
}
