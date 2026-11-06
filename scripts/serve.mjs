// Serve the built artifact for a browser on this machine (localhost keeps the
// microphone available), pointing it at a server elsewhere on the LAN.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
const root=new URL('../dist/',import.meta.url);
const files=new Map(['index.html','client.js','chat-view.js','minutes-view.js','tool-calls.mjs',
  'audio.js','capture.js','style.css'].map(name=>[name,new URL(name,root)]));
const types={html:'text/html',js:'text/javascript',mjs:'text/javascript',css:'text/css'};
const port=Number(process.env.PORT||8788);
createServer(async(req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  const name=path==='/'||path==='/demo/'?'index.html'
    :path.startsWith('/demo/assets/')?path.slice('/demo/assets/'.length):'';
  if(!files.has(name)){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':types[name.split('.').at(-1)],'Cache-Control':'no-store'});
  res.end(await readFile(files.get(name)));
}).listen(port,'127.0.0.1',()=>console.log('Client: http://127.0.0.1:'+port+'/demo/'));
