import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Engine, Service } from 'basketry';
import { jsonSchemaParser } from '../json-schema-parser';

export async function parseService(): Promise<Service | undefined> {
  const sourcePath = join(process.cwd(), 'src', 'snapshot', 'schema.json');
  const sourceContent = readFileSync(sourcePath).toString();

  const { engines } = await Engine.load({
    sourcePath,
    sourceContent,
    parser: jsonSchemaParser,
    options: {},
  });

  const engine = engines[0];

  engine.runParser();

  return engine.service;
}

export function loadSnapshot(): Service {
  const snapshotPath = join(process.cwd(), 'src', 'snapshot', 'snapshot.json');
  const snapshotContent = readFileSync(snapshotPath).toString();
  return JSON.parse(snapshotContent);
}
