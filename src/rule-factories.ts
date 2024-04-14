import { ObjectValidationRule, ValidationRule } from 'basketry';
import { LiteralNode } from './json';
import * as AST from './json-schema';

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
    stringEnumFactory,
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
      id: 'string-max-length',
      length: node.maxLength.asLiteral,
      loc: node._propertyRange('maxLength')!,
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
      id: 'string-min-length',
      length: node.minLength.asLiteral,
      loc: node._propertyRange('minLength')!,
    };
  } else {
    return;
  }
};

export const stringPatternFactory: ValidationRuleFactory = (node) => {
  if (AST.isStringType(node.type) && typeof node.pattern?.value === 'string') {
    return {
      kind: 'ValidationRule',
      id: 'string-pattern',
      pattern: node.pattern.asLiteral,
      loc: node._propertyRange('pattern')!,
    };
  } else {
    return;
  }
};

export const stringFormatFactory: ValidationRuleFactory = (node) => {
  if (AST.isStringType(node.type) && typeof node.format?.value === 'string') {
    return {
      kind: 'ValidationRule',
      id: 'string-format',
      format: node.format.asLiteral,
      loc: node._propertyRange('format')!,
    };
  } else {
    return;
  }
};

export const stringEnumFactory: ValidationRuleFactory = (node) => {
  if (
    AST.isStringType(node.type) &&
    Array.isArray(node.enum) &&
    node.enum.every(
      (n): n is LiteralNode<string> => typeof n.value === 'string',
    )
  ) {
    return {
      kind: 'ValidationRule',
      id: 'string-enum',
      values: node.enum.map((e) => e.asLiteral),
      loc: node._propertyRange('enum')!,
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
      id: 'number-multiple-of',
      value: node.multipleOf.asLiteral,
      loc: node._propertyRange('multipleOf')!,
    };
  } else {
    return;
  }
};

export const numberGreaterThanFactory: ValidationRuleFactory = (node) => {
  if (AST.isNumericType(node.type) && typeof node.minimum?.value === 'number') {
    return {
      kind: 'ValidationRule',
      id: node.exclusiveMinimum?.value ? 'number-gt' : 'number-gte',
      value: node.minimum.asLiteral,
      loc: node._propertyRange('minimum')!,
    };
  } else {
    return;
  }
};

export const numberLessThanFactory: ValidationRuleFactory = (node) => {
  if (AST.isNumericType(node.type) && typeof node.maximum?.value === 'number') {
    return {
      kind: 'ValidationRule',
      id: node.exclusiveMaximum?.value ? 'number-lt' : 'number-lte',
      value: node.maximum.asLiteral,
      loc: node._propertyRange('maximum')!,
    };
  } else {
    return;
  }
};

export const arrayMinItemsFactory: ValidationRuleFactory = (node) => {
  if (AST.isArrayType(node.type) && typeof node.minItems?.value === 'number') {
    return {
      kind: 'ValidationRule',
      id: 'array-min-items',
      min: node.minItems.asLiteral,
      loc: node._propertyRange('minItems')!,
    };
  } else {
    return;
  }
};

export const arrayMaxItemsFactory: ValidationRuleFactory = (node) => {
  if (AST.isArrayType(node.type) && typeof node.maxItems?.value === 'number') {
    return {
      kind: 'ValidationRule',
      id: 'array-max-items',
      max: node.maxItems.asLiteral,
      loc: node._propertyRange('maxItems')!,
    };
  } else {
    return;
  }
};

export const arrayUniqueItemsFactory: ValidationRuleFactory = (node) => {
  if (AST.isArrayType(node.type) && node.uniqueItems?.value) {
    return {
      kind: 'ValidationRule',
      id: 'array-unique-items',
      required: true,
      loc: node._propertyRange('uniqueItems')!,
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
      id: 'object-min-properties',
      min: node.minProperties.asLiteral,
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
      id: 'object-max-properties',
      max: node.maxProperties.asLiteral,
      loc: node._propertyRange('maxProperties')!,
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
