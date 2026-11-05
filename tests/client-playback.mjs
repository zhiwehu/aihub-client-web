import test from 'node:test';
import assert from 'node:assert/strict';
import {ClientAudio} from '../audio.js';
test('music uses its own volume gain while voice replies keep the normal output',async()=>{
  const sources=[],gains=[];
  globalThis.AudioContext=class {
    currentTime=0;destination={name:'speaker'};
    async resume(){}
    createGain(){const g={gain:{value:1},connect(){}};gains.push(g);return g;}
    createBuffer(channels,length,rate){return {duration:length/rate,getChannelData:()=>new Float32Array(length)};}
    createBufferSource(){const s={connect(to){this.output=to;},start(){},stop(){}};sources.push(s);return s;}
  };
  const audio=new ClientAudio(()=>{},()=>{});audio.setMusicVolume(.25);
  await audio.event({type:'audio.start',turn_id:'music',purpose:'music',sample_rate:16000});
  await audio.event({type:'audio.chunk',turn_id:'music',data:'AAAAAA=='});
  assert.equal(sources[0].output,gains[0]);assert.equal(gains[0].gain.value,.25);
  audio.setMusicVolume(.75);assert.equal(gains[0].gain.value,.75);
  await audio.event({type:'playback.clear'});
  await audio.event({type:'audio.start',turn_id:'voice',sample_rate:16000});
  await audio.event({type:'audio.chunk',turn_id:'voice',data:'AAAAAA=='});
  assert.equal(sources[1].output,audio.context.destination);assert.equal(gains.length,1);
  audio.clear();delete globalThis.AudioContext;
});
