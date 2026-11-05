import test from 'node:test';
import assert from 'node:assert/strict';
import {ChatView,conversationItems} from '../chat-view.js';
test('final text stays visible until the server has persisted it after playback',()=>{
  const chat=new ChatView();chat.render=()=>{};
  chat.event({type:'reply.delta',turn_id:'a',text:'正在回答'});
  chat.event({type:'reply.final',turn_id:'a',text:'完整回答。'});
  chat.history([],{events:[],active_turn_id:'a'});
  assert.equal(chat.partials.get('a'),'完整回答。');
  chat.history([{role:'assistant',turn_id:'a',content:'完整回答。'}],{events:[],active_turn_id:null});
  assert.equal(chat.partials.size,0);
});
test('speech interruption does not discard tool evidence or a background result',()=>{
  const chat=new ChatView();chat.render=()=>{};
  chat.tasks([{id:'job',status:'running'}]);
  chat.event({type:'tool.started',turn_id:'a',background:true});
  chat.event({type:'reply.delta',turn_id:'a',text:'播报片段'});
  chat.event({type:'playback.clear',interrupted_turn_id:'a'});
  assert.equal(chat.partials.size,0);assert.equal(chat.operations[0].status,'running');
  assert.equal(chat.events[0].type,'tool.started');
});

test('each task stays inside the original assistant reply across newer questions',()=>{
  const rows=[{role:'user',turn_id:'a',content:'天气'},{role:'assistant',turn_id:'a',content:'我来查看。'},{role:'user',turn_id:'b',content:'新闻'}];
  const tasks=[{id:'job-a',turn_id:'a',text:'晴天',delivery:'interrupted'},{id:'job-b',turn_id:'b',status:'running'}];
  const items=conversationItems(rows,new Map([['b','我来查新闻。']]),tasks);
  assert.deepEqual(items.map(r=>r.turn_id),['a','a','b','b']);
  assert.equal(items[1].operations[0].text,'晴天');assert.equal(items[1].operations[0].delivery,'interrupted');
  assert.equal(items[3].content,'我来查新闻。');assert.equal(items[3].operations[0].id,'job-b');
  assert.equal(items[0].operations,undefined);
});
