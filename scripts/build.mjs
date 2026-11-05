import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const output=resolve(process.argv[2]||resolve(root,'dist'));
const manifest={protocol_version:1,files:{}};
await mkdir(output,{recursive:true});
for(const name of ['index.html','client.js','audio.js','capture.js','style.css','LICENSE']){
  const data=await readFile(resolve(root,name));
  await writeFile(resolve(output,name),data);
  manifest.files[name]=createHash('sha256').update(data).digest('hex');
}
await writeFile(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Client artifact:',output);
