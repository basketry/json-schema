import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { NodeEngine, Service } from 'basketry';
import { jsonSchemaParser } from '../json-schema-parser';

export async function parseService(): Promise<Service | undefined> {
  const sourcePath = join(process.cwd(), 'src', 'snapshot', 'schema.json');
  const sourceContent = readFileSync(sourcePath).toString();

  const { engines } = await NodeEngine.load({
    sourcePath,
    sourceContent,
    parser: jsonSchemaParser,
    options: {},
  });

  const engine = engines[0];

  await engine.runParser();

  return engine.service;
}

export function loadSnapshot(): Service {
  const snapshotPath = join(process.cwd(), 'src', 'snapshot', 'snapshot.json');
  const snapshotContent = readFileSync(snapshotPath).toString();
  return JSON.parse(snapshotContent);
}
