import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
let checked=0;
function walk(dir){
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
  if(['node_modules','.git','.local','.verification','dist','test-results','playwright-report'].includes(entry.name))continue;
  const full=path.join(dir,entry.name);
  if(entry.isDirectory()){walk(full);continue;}
  if(!entry.name.endsWith('.md'))continue;
  for(const match of fs.readFileSync(full,'utf8').matchAll(/\]\(([^)]+)\)/g)){
   const ref=match[1].split('#')[0].split(' "')[0];
   if(!ref||/^[a-z]+:\/\//i.test(ref)||ref.startsWith('mailto:'))continue;
   assert(fs.existsSync(path.resolve(path.dirname(full),decodeURIComponent(ref))),'Broken link in '+path.relative(root,full)+': '+ref);checked++;
  }
 }
}
walk(root);
assert.equal(fs.readdirSync(path.join(root,'docs/ui/screenshots')).filter(x=>x.endsWith('.png')).length,10);
console.log('Documentation links and 10 UI screenshots verified: '+checked+' local references.');

// Compose interpolation and file-loaded application settings share one documented contract.
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const composeVars = new Set([...read('compose.yaml').matchAll(/\$\{([A-Z][A-Z0-9_]*)[^}]*\}/g)].map(m => m[1]));
const exampleVars = new Set([...read('.env.docker.example').matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(m => m[1]));
const documentedVars = new Set([...read('docs/deployment.md').matchAll(/^\| `([A-Z][A-Z0-9_]*)` \|/gm)].map(m => m[1]));
const externalVars = new Set(['CONFIG_DIR']); // Selected before the env file can be read.
for (const name of externalVars) assert(!exampleVars.has(name), `${name} must stay outside .env`);
for (const name of composeVars) assert(exampleVars.has(name) || externalVars.has(name), `Missing template configuration: ${name}`);
for (const name of new Set([...composeVars, ...exampleVars])) assert(documentedVars.has(name), `Missing configuration table row: ${name}`);
for (const name of documentedVars) assert(exampleVars.has(name) || externalVars.has(name), `Stale configuration table row: ${name}`);
console.log('Deployment configuration template and table verified.');
