import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {copyFile, lstat, mkdir, mkdtemp, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';

// Official Gitleaks release, pinned by archive checksum. Downloads stay in temp.
const version = '8.30.1';
const archives = {
  darwin_arm64: 'b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5',
  darwin_x64: 'dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709',
  linux_arm64: 'e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080',
  linux_x64: '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb',
};
const platform = `${process.platform}_${process.arch}`, expected = archives[platform];
if (!expected) throw Error('Run secret scanning on a supported macOS/Linux machine or in GitHub Actions.');
const root = process.cwd(), temporary = await mkdtemp(join(tmpdir(), 'mendez95-secret-scan-'));
const skipped = new Set(['.git','node_modules','dist','.local','.wrangler','.worker-build','test-results','playwright-report']);
async function walk(path = '') {
  const files = [];
  for (const item of await readdir(join(root, path), {withFileTypes: true})) {
    if (skipped.has(item.name)) continue;
    if (item.isSymbolicLink()) throw Error('Source symlinks are not supported');
    const file = join(path, item.name);
    if (item.isDirectory()) files.push(...await walk(file)); else files.push(file);
  }
  return files;
}
try {
  const archive = `gitleaks_${version}_${platform}.tar.gz`;
  const response = await fetch(`https://github.com/gitleaks/gitleaks/releases/download/v${version}/${archive}`);
  if (!response.ok) throw Error('Could not download the official secret scanner');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== expected) throw Error('Secret scanner checksum mismatch');
  await writeFile(join(temporary, archive), bytes);
  execFileSync('tar', ['-xzf', join(temporary, archive), '-C', temporary, 'gitleaks']);
  let files;
  try {files = execFileSync('git', ['ls-files','--cached','--others','--exclude-standard','-z'], {cwd: root, stdio: ['ignore','pipe','ignore']}).toString().split('\0').filter(Boolean);}
  catch {files = await walk();}
  const source = join(temporary, 'source'); await mkdir(source);
  for (const file of files) {
    const info = await lstat(join(root, file));
    if (!info.isFile() || info.isSymbolicLink()) throw Error(`Unexpected source entry: ${file}`);
    await mkdir(dirname(join(source, file)), {recursive: true});
    await copyFile(join(root, file), join(source, file));
  }
  execFileSync(join(temporary, 'gitleaks'), ['dir',source,'--config',join(root,'.gitleaks.toml'),'--redact','--no-banner'], {stdio: 'inherit'});
} finally {await rm(temporary, {recursive: true, force: true});}
