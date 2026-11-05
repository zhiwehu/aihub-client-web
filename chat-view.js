import {toolCallsForTurn} from './tool-calls.mjs';
const $=id=>document.getElementById(id);
const element=(tag,className,text)=>{const e=document.createElement(tag);e.className=className||'';if(text!==undefined)e.textContent=text;return e;};
const phases={running:'正在执行',completed:'已完成',failed:'执行失败',cancelled:'已停止',unknown:'状态待核实'};
const toolNames={music:'本地音乐',calendar:'日程',timer:'计时提醒',weather:'天气查询',workflow:'多步处理'};
const statuses={queued:'等待处理',running:'正在处理',completed:'已完成',failed:'未能完成',waiting:'等待确认',cancelled:'已取消',unknown:'需要核实'};
// Attach background state to its original assistant turn, even when newer messages exist.
export function conversationItems(rows,partials,operations,toolTurns=[]){
  const items=rows.map(row=>({...row}));
  const turns=new Set([...operations.map(op=>op.turn_id),...toolTurns,...partials.keys()].filter(Boolean));
  for(const tid of turns){
    let target=items.find(row=>row.role==='assistant'&&row.turn_id===tid);
    if(!target){
      const user=items.findIndex(row=>row.role==='user'&&row.turn_id===tid);
      if(user<0&&!partials.has(tid))continue;
      target={role:'assistant',turn_id:tid,content:partials.get(tid)||''};
      if(user>=0)items.splice(user+1,0,target);else items.push(target);
    }
    target.operations=operations.filter(op=>op.turn_id===tid);
  }
  return items;
}
export class ChatView {
  constructor(){this.rows=[];this.events=[];this.operations=[];this.partials=new Map();this.sid=null;this.active=null;}
  reset(sid){this.sid=sid;this.rows=[];this.events=[];this.operations=[];this.partials.clear();this.active=null;this.render();}
  history(rows,evidence){this.rows=rows;this.active=evidence.active_turn_id;this.events=[...evidence.events,...this.events.filter(e=>!e.payload)].slice(-600);for(const row of rows)if(row.role==='assistant')this.partials.delete(row.turn_id);this.render();}
  event(e){
    if(!e.type.startsWith('tool.')&&!['reply.delta','reply.final','turn.started','playback.clear','turn.completed','error'].includes(e.type))return;
    if(e.type==='reply.delta')this.partials.set(e.turn_id,(this.partials.get(e.turn_id)||'')+e.text);
    if(e.type==='turn.started')this.active=e.turn_id;
    if(e.type==='reply.final')this.partials.set(e.turn_id,e.text);
    if(e.type==='playback.clear')this.partials.delete(e.interrupted_turn_id);
    if(e.type.startsWith('tool.')||['playback.clear','turn.completed','error'].includes(e.type))this.events.push(e);
    this.events=this.events.slice(-600);this.render();
  }
  tasks(rows){this.operations=rows;this.render();}
  render(){
    const scroller=$('conversation-scroll'),nearEnd=scroller.scrollHeight-scroller.scrollTop-scroller.clientHeight<100;
    const expanded=new Set([...$('messages').querySelectorAll('details[open]')].map(e=>e.dataset.key));
    const fragment=document.createDocumentFragment();
    const toolTurns=[...new Set(this.events.filter(e=>e.type.startsWith('tool.')).map(e=>e.turn_id))];
    const items=conversationItems(this.rows,this.partials,this.operations,toolTurns);
    for(const row of items){
      const article=element('article','message '+(row.role==='user'?'user':'assistant'));
      if(row.role!=='user')article.append(element('div','avatar','声'));
      const body=element('div','message-body');body.append(element('span','speaker',row.role==='user'?'你':'声桥'),element('p','',row.content));
      if(row.role==='assistant')for(const call of toolCallsForTurn(this.events,this.sid,row.turn_id,this.active)){
        const detail=element('details','tool-call');detail.dataset.key=row.turn_id+':'+call.name;detail.open=expanded.has(detail.dataset.key);
        detail.append(element('summary',call.phase==='running'?'running':'',`${phases[call.phase]||call.phase} · ${toolNames[call.name]||call.name}${call.elapsed!=null?' · '+(call.elapsed/1000).toFixed(1)+' 秒':''}`));
        if(call.background&&call.phase==='running')detail.append(element('p','','任务继续处理中，可以继续聊天。'));
        if(call.arguments)detail.append(element('pre','',JSON.stringify(call.arguments,null,2)));
        if(call.code)detail.append(element('p','','说明：'+call.code));body.append(detail);
      }
      for(const op of row.operations||[]){
        const card=element('details','task'),head=element('summary','task-header');
        card.dataset.key=op.id;card.open=expanded.has(op.id)||['interrupted','muted'].includes(op.delivery);
        head.append(element('span','', '处理进度'),element('span','task-state '+(['running','queued'].includes(op.status)?'running':''),statuses[op.status]||op.status));card.append(head);
        if(op.text)card.append(element('p','',op.text));
        if(['interrupted','muted'].includes(op.delivery))card.append(element('small','','已停止播报，结果保留在这条对话里，不会再次自动播放。'));
        body.append(card);
      }
      article.append(body);fragment.append(article);
    }
    $('messages').replaceChildren(fragment);
    $('chat-empty').hidden=!!items.length;
    if(nearEnd)scroller.scrollTop=scroller.scrollHeight;
  }
}
