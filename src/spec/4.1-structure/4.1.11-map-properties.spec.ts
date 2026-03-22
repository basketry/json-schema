import { Service } from '@basketry/ir';
import parser from '../..';

const absoluteSourcePath = '/test/path.ext';

describe('4.1.11 MapProperties', () => {
  it('handles a boolean', async () => {
    // ARRANGE
    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'wrapper',
      additionalProperties: true,
    };

    const content = JSON.stringify(schema);

    // ACT
    const result = await parser(content, absoluteSourcePath);

    // ASSERT
    expect(result.service).toEqual(
      partial<Service>({
        kind: 'Service',
        types: [
          {
            kind: 'Type',
            name: { value: 'wrapper' },
            properties: [],
            mapProperties: {
              kind: 'MapProperties',
              key: {
                kind: 'MapKey',
                value: {
                  kind: 'PrimitiveValue',
                  typeName: { value: 'string' },
                },
              },
              value: {
                kind: 'MapValue',
                value: {
                  kind: 'PrimitiveValue',
                  typeName: { value: 'untyped' },
                },
              },
            },
          },
        ],
      }),
    );
  });

  describe('type', () => {
    it('handles a referenced type', async () => {
      // ARRANGE
      const schema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        title: 'wrapper',
        additionalProperties: {
          $ref: '#/definitions/extraValue',
        },
        definitions: {
          extraValue: {
            type: 'object',
            required: ['value'],
            properties: {
              value: {
                type: 'string',
              },
            },
            additionalProperties: false,
          },
        },
      };

      const content = JSON.stringify(schema);

      // ACT
      const result = await parser(content, absoluteSourcePath);

      // ASSERT
      expect(result.service).toEqual(
        partial<Service>({
          kind: 'Service',
          types: [
            {
              kind: 'Type',
              name: { value: 'extraValue' },
              properties: [
                {
                  kind: 'Property',
                  name: { value: 'value' },
                  value: {
                    kind: 'PrimitiveValue',
                    typeName: { value: 'string' },
                  },
                },
              ],
            },
            {
              kind: 'Type',
              name: { value: 'wrapper' },
              properties: [],
              mapProperties: {
                kind: 'MapProperties',
                key: {
                  kind: 'MapKey',
                  value: {
                    kind: 'PrimitiveValue',
                    typeName: { value: 'string' },
                  },
                },
                value: {
                  kind: 'MapValue',
                  value: {
                    kind: 'ComplexValue',
                    typeName: { value: 'extraValue' },
                  },
                },
              },
            },
          ],
        }),
      );
    });
  });

  describe('primitive', () => {
    it('handles a direct string primitive', async () => {
      // ARRANGE
      const schema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        title: 'wrapper',
        additionalProperties: {
          type: 'string',
        },
      };

      const content = JSON.stringify(schema);

      // ACT
      const result = await parser(content, absoluteSourcePath);

      // ASSERT
      expect(result.service).toEqual(
        partial<Service>({
          kind: 'Service',
          types: [
            {
              kind: 'Type',
              name: { value: 'wrapper' },
              properties: [],
              mapProperties: {
                kind: 'MapProperties',
                key: {
                  kind: 'MapKey',
                  value: {
                    kind: 'PrimitiveValue',
                    typeName: { value: 'string' },
                  },
                },
                value: {
                  kind: 'MapValue',
                  value: {
                    kind: 'PrimitiveValue',
                    typeName: { value: 'string' },
                  },
                },
              },
            },
          ],
        }),
      );
    });

    it('handles a referenced string primitive', async () => {
      // ARRANGE
      const schema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        title: 'wrapper',
        additionalProperties: {
          $ref: '#/definitions/stringValue',
        },
        definitions: {
          stringValue: {
            type: 'string',
          },
        },
      };

      const content = JSON.stringify(schema);

      // ACT
      const result = await parser(content, absoluteSourcePath);

      // ASSERT
      expect(result.service).toEqual(
        partial<Service>({
          kind: 'Service',
          types: [
            {
              kind: 'Type',
              name: { value: 'wrapper' },
              properties: [],
              mapProperties: {
                kind: 'MapProperties',
                key: {
                  kind: 'MapKey',
                  value: {
                    kind: 'PrimitiveValue',
                    typeName: { value: 'string' },
                  },
                },
                value: {
                  kind: 'MapValue',
                  value: {
                    kind: 'PrimitiveValue',
                    typeName: { value: 'string' },
                  },
                },
              },
            },
          ],
        }),
      );
    });

    it('handles a direct number primitive', async () => {
      // ARRANGE
      const schema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        title: 'wrapper',
        additionalProperties: {
          type: 'number',
        },
      };

      const content = JSON.stringify(schema);

      // ACT
      const result = await parser(content, absoluteSourcePath);

      // ASSERT
      expect(result.service).toEqual(
        partial<Service>({
          kind: 'Service',
          types: [
            {
              kind: 'Type',
              name: { value: 'wrapper' },
              properties: [],
              mapProperties: {
                kind: 'MapProperties',
                key: {
                  kind: 'MapKey',
                  value: {
                    kind: 'PrimitiveValue',
                    typeName: { value: 'string' },
                  },
                },
                value: {
                  kind: 'MapValue',
                  value: {
                    kind: 'PrimitiveValue',
                    typeName: { value: 'number' },
                  },
                },
              },
            },
          ],
        }),
      );
    });

    it('handles a referenced number primitive', async () => {
      // ARRANGE
      const schema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        title: 'wrapper',
        additionalProperties: {
          $ref: '#/definitions/numberValue',
        },
        definitions: {
          numberValue: {
            type: 'number',
          },
        },
      };

      const content = JSON.stringify(schema);

      // ACT
      const result = await parser(content, absoluteSourcePath);

      // ASSERT
      expect(result.service).toEqual(
        partial<Service>({
          kind: 'Service',
          types: [
            {
              kind: 'Type',
              name: { value: 'wrapper' },
              properties: [],
              mapProperties: {
                kind: 'MapProperties',
                key: {
                  kind: 'MapKey',
                  value: {
                    kind: 'PrimitiveValue',
                    typeName: { value: 'string' },
                  },
                },
                value: {
                  kind: 'MapValue',
                  value: {
                    kind: 'PrimitiveValue',
                    typeName: { value: 'number' },
                  },
                },
              },
            },
          ],
        }),
      );
    });
  });

  describe('enum', () => {
    it('handles a direct inline enum', async () => {
      // ARRANGE
      const schema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        title: 'wrapper',
        additionalProperties: {
          type: 'string',
          enum: ['a', 'b'],
        },
      };

      const content = JSON.stringify(schema);

      // ACT
      const result = await parser(content, absoluteSourcePath);

      // ASSERT
      expect(result.service).toEqual(
        partial<Service>({
          kind: 'Service',
          types: [
            {
              kind: 'Type',
              name: { value: 'wrapper' },
              properties: [],
              mapProperties: {
                kind: 'MapProperties',
                key: {
                  kind: 'MapKey',
                  value: {
                    kind: 'PrimitiveValue',
                    typeName: { value: 'string' },
                  },
                },
                value: {
                  kind: 'MapValue',
                  value: {
                    kind: 'ComplexValue',
                    typeName: { value: 'wrapperMapValue' },
                  },
                },
              },
            },
          ],
          enums: [
            {
              kind: 'Enum',
              name: { value: 'wrapperMapValue' },
              members: [
                { kind: 'EnumMember', content: { value: 'a' } },
                { kind: 'EnumMember', content: { value: 'b' } },
              ],
            },
          ],
        }),
      );
    });

    it('handles a referenced enum', async () => {
      // ARRANGE
      const schema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        title: 'wrapper',
        additionalProperties: {
          $ref: '#/definitions/statusEnum',
        },
        definitions: {
          statusEnum: {
            type: 'string',
            enum: ['active', 'inactive'],
          },
        },
      };

      const content = JSON.stringify(schema);

      // ACT
      const result = await parser(content, absoluteSourcePath);

      // ASSERT
      expect(result.service).toEqual(
        partial<Service>({
          kind: 'Service',
          types: [
            {
              kind: 'Type',
              name: { value: 'wrapper' },
              properties: [],
              mapProperties: {
                kind: 'MapProperties',
                key: {
                  kind: 'MapKey',
                  value: {
                    kind: 'PrimitiveValue',
                    typeName: { value: 'string' },
                  },
                },
                value: {
                  kind: 'MapValue',
                  value: {
                    kind: 'ComplexValue',
                    typeName: { value: 'statusEnum' },
                  },
                },
              },
            },
          ],
          enums: [
            {
              kind: 'Enum',
              name: { value: 'statusEnum' },
              members: [
                { kind: 'EnumMember', content: { value: 'active' } },
                { kind: 'EnumMember', content: { value: 'inactive' } },
              ],
            },
          ],
        }),
      );
    });
  });

  describe('union', () => {
    it('handles a direct oneOf union', async () => {
      // ARRANGE
      const schema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        title: 'wrapper',
        additionalProperties: {
          oneOf: [
            { $ref: '#/definitions/typeA' },
            { $ref: '#/definitions/typeB' },
          ],
        },
        definitions: {
          typeA: {
            type: 'object',
            properties: { a: { type: 'string' } },
          },
          typeB: {
            type: 'object',
            properties: { b: { type: 'number' } },
          },
        },
      };

      const content = JSON.stringify(schema);

      // ACT
      const result = await parser(content, absoluteSourcePath);

      // ASSERT
      expect(result.service).toEqual(
        partial<Service>({
          kind: 'Service',
          types: [
            { kind: 'Type', name: { value: 'typeA' } },
            { kind: 'Type', name: { value: 'typeB' } },
            {
              kind: 'Type',
              name: { value: 'wrapper' },
              properties: [],
              mapProperties: {
                kind: 'MapProperties',
                key: {
                  kind: 'MapKey',
                  value: {
                    kind: 'PrimitiveValue',
                    typeName: { value: 'string' },
                  },
                },
                value: {
                  kind: 'MapValue',
                  value: {
                    kind: 'ComplexValue',
                    typeName: { value: 'wrapperMapValues' },
                  },
                },
              },
            },
          ],
          unions: [
            {
              kind: 'SimpleUnion',
              name: { value: 'wrapperMapValues' },
              members: [
                { typeName: { value: 'typeA' } },
                { typeName: { value: 'typeB' } },
              ],
              disjunction: { value: 'exclusive' },
            },
          ],
        }),
      );
    });

    it('handles a referenced oneOf union', async () => {
      // ARRANGE
      const schema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        title: 'wrapper',
        additionalProperties: {
          $ref: '#/definitions/unionAB',
        },
        definitions: {
          typeA: {
            type: 'object',
            properties: { a: { type: 'string' } },
          },
          typeB: {
            type: 'object',
            properties: { b: { type: 'number' } },
          },
          unionAB: {
            oneOf: [
              { $ref: '#/definitions/typeA' },
              { $ref: '#/definitions/typeB' },
            ],
          },
        },
      };

      const content = JSON.stringify(schema);

      // ACT
      const result = await parser(content, absoluteSourcePath);

      // ASSERT
      expect(result.service).toEqual(
        partial<Service>({
          kind: 'Service',
          types: [
            { kind: 'Type', name: { value: 'typeA' } },
            { kind: 'Type', name: { value: 'typeB' } },
            {
              kind: 'Type',
              name: { value: 'wrapper' },
              properties: [],
              mapProperties: {
                kind: 'MapProperties',
                key: {
                  kind: 'MapKey',
                  value: {
                    kind: 'PrimitiveValue',
                    typeName: { value: 'string' },
                  },
                },
                value: {
                  kind: 'MapValue',
                  value: {
                    kind: 'ComplexValue',
                    typeName: { value: 'unionAB' },
                  },
                },
              },
            },
          ],
          unions: [
            {
              kind: 'SimpleUnion',
              name: { value: 'unionAB' },
              members: [
                { typeName: { value: 'typeA' } },
                { typeName: { value: 'typeB' } },
              ],
              disjunction: { value: 'exclusive' },
            },
          ],
        }),
      );
    });

    it('handles a direct anyOf union', async () => {
      // ARRANGE
      const schema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        title: 'wrapper',
        additionalProperties: {
          anyOf: [
            { $ref: '#/definitions/typeA' },
            { $ref: '#/definitions/typeB' },
          ],
        },
        definitions: {
          typeA: {
            type: 'object',
            properties: { a: { type: 'string' } },
          },
          typeB: {
            type: 'object',
            properties: { b: { type: 'number' } },
          },
        },
      };

      const content = JSON.stringify(schema);

      // ACT
      const result = await parser(content, absoluteSourcePath);

      // ASSERT
      expect(result.service).toEqual(
        partial<Service>({
          kind: 'Service',
          types: [
            { kind: 'Type', name: { value: 'typeA' } },
            { kind: 'Type', name: { value: 'typeB' } },
            {
              kind: 'Type',
              name: { value: 'wrapper' },
              properties: [],
              mapProperties: {
                kind: 'MapProperties',
                key: {
                  kind: 'MapKey',
                  value: {
                    kind: 'PrimitiveValue',
                    typeName: { value: 'string' },
                  },
                },
                value: {
                  kind: 'MapValue',
                  value: {
                    kind: 'ComplexValue',
                    typeName: { value: 'wrapperMapValues' },
                  },
                },
              },
            },
          ],
          unions: [
            {
              kind: 'SimpleUnion',
              name: { value: 'wrapperMapValues' },
              members: [
                { typeName: { value: 'typeA' } },
                { typeName: { value: 'typeB' } },
              ],
              disjunction: { value: 'inclusive' },
            },
          ],
        }),
      );
    });

    it('handles a referenced anyOf union', async () => {
      // ARRANGE
      const schema = {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        title: 'wrapper',
        additionalProperties: {
          $ref: '#/definitions/unionAB',
        },
        definitions: {
          typeA: {
            type: 'object',
            properties: { a: { type: 'string' } },
          },
          typeB: {
            type: 'object',
            properties: { b: { type: 'number' } },
          },
          unionAB: {
            anyOf: [
              { $ref: '#/definitions/typeA' },
              { $ref: '#/definitions/typeB' },
            ],
          },
        },
      };

      const content = JSON.stringify(schema);

      // ACT
      const result = await parser(content, absoluteSourcePath);

      // ASSERT
      expect(result.service).toEqual(
        partial<Service>({
          kind: 'Service',
          types: [
            { kind: 'Type', name: { value: 'typeA' } },
            { kind: 'Type', name: { value: 'typeB' } },
            {
              kind: 'Type',
              name: { value: 'wrapper' },
              properties: [],
              mapProperties: {
                kind: 'MapProperties',
                key: {
                  kind: 'MapKey',
                  value: {
                    kind: 'PrimitiveValue',
                    typeName: { value: 'string' },
                  },
                },
                value: {
                  kind: 'MapValue',
                  value: {
                    kind: 'ComplexValue',
                    typeName: { value: 'unionAB' },
                  },
                },
              },
            },
          ],
          unions: [
            {
              kind: 'SimpleUnion',
              name: { value: 'unionAB' },
              members: [
                { typeName: { value: 'typeA' } },
                { typeName: { value: 'typeB' } },
              ],
              disjunction: { value: 'inclusive' },
            },
          ],
        }),
      );
    });
  });
});

type DeepPartial<T> = T extends Function
  ? T
  : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends ReadonlyArray<infer U>
      ? ReadonlyArray<DeepPartial<U>>
      : T extends object
        ? { [P in keyof T]?: DeepPartial<T[P]> }
        : T;

const exactSet = new Set<unknown>();
function exact<T>(input: T): T {
  exactSet.add(input);
  return input;
}

function partial<T = any>(input: DeepPartial<T>): any {
  if (exactSet.has(input)) return input;

  if (Array.isArray(input)) {
    return expect.arrayContaining(input.map(partial));
  }

  if (input && typeof input === 'object' && !(input instanceof Date)) {
    const entries = Object.entries(input).map(([key, value]) => [
      key,
      partial(value),
    ]);
    return expect.objectContaining(Object.fromEntries(entries));
  }

  return input;
}
