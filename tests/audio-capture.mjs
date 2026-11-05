import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../capture.js',import.meta.url),'utf8');
for(const rate of [44100,48000])test('capture emits 16k mono PCM at hardware rate '+rate,()=>{
  const output=[];let Processor;
  vm.runInNewContext(source,{sampleRate:rate,Int16Array,AudioWorkletProcessor:class{constructor(){this.port={postMessage:value=>{if(typeof value?.byteLength==='number')output.push(value);}};}},registerProcessor:(_name,type)=>{Processor=type;}});
  const processor=new Processor();
  for(let offset=0;offset<rate;offset+=128)processor.process([[new Float32Array(Math.min(128,rate-offset)).fill(.5)]]);
  assert.equal(output.reduce((n,b)=>n+b.byteLength/2,0),16000);
  assert.ok(output.every(b=>new Int16Array(b).every(v=>v>=16383&&v<=16384)));
});
