import { readFileSync } from 'fs';
import { join } from 'path';

import { ReturnValue, validate } from 'basketry';
import parser from '.';
import { loadSnapshot, parseService } from './snapshot/test-utils';

describe('parser', () => {
  it('recreates a valid exhaustive snapshot', async () => {
    // ARRANGE
    const snapshot = loadSnapshot();

    // ACT
    const service = JSON.parse(JSON.stringify(await parseService()));

    // ASSERT
    expect(service).toStrictEqual(snapshot);
  });

  it('creates a type for every local typeName', () => {
    // ARRANGE

    const sourcePath = join('src', 'snapshot', 'schema.json');
    const sourceContent = readFileSync(sourcePath).toString();

    // ACT
    const result = parser(sourceContent, sourcePath).service;

    // ASSERT
    const fromMethodParameters = new Set(
      result.interfaces
        .map((i) => i.methods)
        .reduce((a, b) => a.concat(b), [])
        .map((i) => i.parameters)
        .reduce((a, b) => a.concat(b), [])
        .filter((p) => p.value.kind === 'ComplexValue')
        .map((p) => p.value.typeName.value),
    );

    const fromMethodReturnValues = new Set(
      result.interfaces
        .map((i) => i.methods)
        .reduce((a, b) => a.concat(b), [])
        .map((i) => i.returns)
        .filter((t): t is ReturnValue => !!t)
        .filter((p) => p.value.kind === 'ComplexValue')
        .map((p) => p.value.typeName.value),
    );

    const fromTypes = new Set(
      result.types
        .map((t) => t.properties)
        .reduce((a, b) => a.concat(b), [])
        .filter((p) => p.value.kind === 'ComplexValue')
        .map((p) => p.value.typeName.value),
    );

    const typeNames = new Set([
      ...result.types.map((t) => t.name.value),
      ...result.enums.map((e) => e.name.value),
    ]);

    for (const localTypeName of [
      ...fromMethodParameters,
      ...fromMethodReturnValues,
      ...fromTypes,
    ]) {
      expect(typeNames.has(localTypeName)).toEqual(true);
    }
  });

  it('creates types with unique names', () => {
    // ARRANGE

    const sourcePath = join('src', 'snapshot', 'schema.json');
    const sourceContent = readFileSync(sourcePath).toString();

    // ACT
    const result = parser(sourceContent, sourcePath).service;

    // ASSERT
    const typeNames = result.types.map((t) => t.name);

    expect(typeNames.length).toEqual(new Set(typeNames).size);
  });

  it('creates a valid service', () => {
    // ARRANGE
    const sourcePath = join('src', 'snapshot', 'schema.json');
    const sourceContent = readFileSync(sourcePath).toString();

    const service = parser(sourceContent, sourcePath).service;

    // ACT
    const errors = validate(service).errors;

    // ASSERT
    expect(errors).toEqual([]);
  });
});
