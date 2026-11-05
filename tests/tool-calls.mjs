import test from 'node:test';
import assert from 'node:assert/strict';
import {toolCallsForTurn} from '../tool-calls.mjs';
const event=(type,extra={})=>({type,session_id:'mine',turn_id:'request',timestamp:1,tool:'search',...extra});
test('background tools continue after a speech interruption and retain their result',()=>{
  const events=[event('tool.started',{background:true,arguments:{query:'天气'}}),event('playback.clear',{timestamp:2,interrupted_turn_id:'request'}),event('turn.completed',{timestamp:3})];
  assert.equal(toolCallsForTurn(events,'mine','request',null)[0].phase,'running');
  events.push(event('tool.completed',{timestamp:4,background:true,elapsed_ms:3000}));
  const call=toolCallsForTurn(events,'mine','request',null)[0];assert.equal(call.phase,'completed');assert.equal(call.elapsed,3000);assert.deepEqual(call.arguments,{query:'天气'});
});
test('persisted events are ordered and scoped to the request and session',()=>{
  const events=[event('tool.completed',{timestamp:3,elapsed_ms:2000}),{type:'tool.started',session_id:'mine',turn_id:'request',created:1,payload:{tool:'search',background:true}},event('tool.failed',{session_id:'other',timestamp:4})];
  assert.equal(toolCallsForTurn(events,'mine','request',null)[0].phase,'completed');assert.deepEqual(toolCallsForTurn(events,'mine','unrelated',null),[]);
});
test('interrupted foreground tools do not stay running',()=>{
  const events=[event('tool.started'),event('playback.clear',{timestamp:2,interrupted_turn_id:'request'})];
  assert.equal(toolCallsForTurn(events,'mine','request',null)[0].phase,'cancelled');
});
