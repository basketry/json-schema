import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { format } from 'prettier';
import parser from '..';

const schema = readFileSync(
  join(process.cwd(), 'src', 'snapshot', 'schema.json'),
).toString();

const prettierOptions = JSON.parse(
  readFileSync(join(process.cwd(), '.prettierrc')).toString('utf8'),
);

const example = parser(schema, 'schema.json').service;

const exampleSnapshot = format(JSON.stringify(example), {
  ...prettierOptions,
  parser: 'json',
});

writeFileSync(
  join(process.cwd(), 'src', 'snapshot', 'snapshot.json'),
  exampleSnapshot,
);
