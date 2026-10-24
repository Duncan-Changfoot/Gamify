// Writes the offline file list and version into sw.js from what is on disk.
//   node tools/stamp.js          update sw.js
//   node tools/stamp.js --check  exit 1 if sw.js is out of date (the playtest runs this)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

export function stamp({ check = false } = {}) {
  const files = [
    'index.html', 'manifest.webmanifest',
    ...walk('icons').filter((f) => f.endsWith('.png')),
    ...walk('src').filter((f) => f.endsWith('.js')),
  ].map((f) => f.split(path.sep).join('/')).sort();
  const hash = crypto.createHash('sha1');
  for (const f of files) hash.update(f).update(fs.readFileSync(path.join(root, f)));
  const version = 'gamify-' + hash.digest('hex').slice(0, 10);

  const swPath = path.join(root, 'sw.js');
  const before = fs.readFileSync(swPath, 'utf8');
  const after = before
    .replace(/const VERSION = '[^']*';/, `const VERSION = '${version}';`)
    .replace(/const FILES = \[[^\]]*\];/, `const FILES = [\n${['./', ...files].map((f) => `  '${f}',`).join('\n')}\n];`);
  const stale = after !== before;
  if (stale && !check) fs.writeFileSync(swPath, after);
  return { stale, version };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const { stale, version } = stamp({ check });
  if (check && stale) {
    console.error('sw.js is out of date: run `npm run stamp`');
    process.exit(1);
  }
  console.log(stale ? `sw.js now at ${version}` : `sw.js already at ${version}`);
}
