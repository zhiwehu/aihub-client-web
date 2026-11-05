import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
const files=new Map(['index.html','client.js','audio.js','capture.js','style.css'].map(name=>[name,new URL(name,root)]));
const types={html:'text/html',js:'text/javascript',css:'text/css'};
createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  const name=path==='/'||path==='/demo/'?'index.html':path.startsWith('/demo/assets/')?path.slice('/demo/assets/'.length):'';
  if(!files.has(name)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':types[name.split('.').at(-1)],'Cache-Control':'no-store'});
  res.end(await readFile(files.get(name)));
}).listen(Number(process.env.PORT||8788),'127.0.0.1',()=>console.log('Client dev: http://127.0.0.1:'+(process.env.PORT||8788)+'/demo/'));
