import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const secretPath = resolve('.local/owner-review-password');
await mkdir(resolve('.local'), { recursive: true, mode: 0o700 });
let password;
try { password = (await readFile(secretPath, 'utf8')).trim(); }
catch {
  password = randomBytes(32).toString('base64url');
  await writeFile(secretPath, `${password}\n`, { mode: 0o600, flag: 'wx' });
}
if (!password) throw new Error('Local review password file is empty.');
console.info('Mendez OS owner review password is stored at .local/owner-review-password (mode 600).');
const child = spawn('npm', ['run', 'dev'], { stdio: 'inherit', env: { ...process.env, MENDEZ_OS_OWNER_PASSWORD: password, MENDEZ_OS_LOCAL_REVIEW: '1', MENDEZ_OS_MODEL_ENABLED: 'false' } });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => process.exit(code ?? 1));
