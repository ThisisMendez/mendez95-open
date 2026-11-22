import {readFile, readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {verifyScreenshot} from './screenshot-policy.mjs';
let screenshots = {};
try {screenshots = JSON.parse(await readFile('docs/screenshots/review.json','utf8'));}
catch (error) {if (error.code !== 'ENOENT') throw error;}
const bad=/-----BEGIN (?:OPENSSH |RSA |EC )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,})\b/i;
async function check(dir='.') {
 for(const item of await readdir(dir,{withFileTypes:true})) {
  if(['.git','node_modules','dist','.local','.wrangler','.worker-build','test-results','playwright-report'].includes(item.name))continue;
  const path=join(dir,item.name);
  if(item.isSymbolicLink())throw Error(`Unexpected symlink: ${path}`);
  if(item.isDirectory())await check(path);
  else {
   const normalized=path.replaceAll('\\','/');
   if(Object.hasOwn(screenshots,normalized)){verifyScreenshot(normalized,await readFile(path),screenshots[normalized]);continue;}
   if(/\.(?:jpe?g|png|webp|mp4|mov|webm|pdf|zip)$/i.test(path))throw Error(`Unreviewed public media: ${path}`);
   if(bad.test(await readFile(path,'utf8')))throw Error(`Privacy check failed: ${path} (value withheld)`);
  }
 }
}
await check();console.info('Public edition privacy checks passed.');
