import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const out = fileURLToPath(new URL('../dist/', import.meta.url));
async function list(dir, prefix = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await list(join(dir, entry.name), relative + '/'));
    else if (entry.name !== 'sw.js' && !entry.name.startsWith('.')) files.push(relative);
  }
  return files;
}
const files = (await list(out)).sort();
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(join(out, file)));
const version = hash.digest('hex').slice(0, 16);
const template = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8');
await writeFile(
  join(out, 'sw.js'),
  template
    .replace('__VERSION__', JSON.stringify(version))
    .replace('__FILES__', JSON.stringify(files)),
);
await writeFile(join(out, '.nojekyll'), '');
console.log('Installerbar release: ' + version);
