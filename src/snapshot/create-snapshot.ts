import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { format } from 'prettier';
import { parseService } from './test-utils';

(async () => {
  const example = await parseService();

  const prettierOptions = JSON.parse(
    readFileSync(join(process.cwd(), '.prettierrc')).toString('utf8'),
  );

  const exampleSnapshot = await format(JSON.stringify(example), {
    ...prettierOptions,
    parser: 'json',
  });

  writeFileSync(
    join(process.cwd(), 'src', 'snapshot', 'snapshot.json'),
    exampleSnapshot,
  );
})();
