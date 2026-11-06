import {ClientAudio} from './audio.js';
import {ChatView} from './chat-view.js';
const $=id=>document.getElementById(id);
const chat=new ChatView();
let previousPage='chat';
function page(){
  const name=location.hash==='#recordings'?'recordings':location.hash==='#connection'?'connection':'chat';
  if(name!=='connection')previousPage=name;
  $('chat-page').hidden=name!=='chat';$('recordings-page').hidden=name!=='recordings';$('connection-panel').hidden=name!=='connection';
  $('page-title').textContent={chat:'对话',recordings:'会议录音',connection:'连接设置'}[name];
  $('page-kicker').textContent={chat:'和声桥一起',recordings:'记录每一个重点',connection:'管理当前网页的连接'}[name];
  for(const a of document.querySelectorAll('[data-page]')){if(a.dataset.page===name)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
  $('error').textContent='';
}
window.addEventListener('hashchange',page);page();
let base=location.origin, token='', socket, sid, resume, ready=false, recording=null, selected=null, audioURL=null, ping, poll, transcriptLines=[], recordingTab='transcript', recordingNoticeTimer;
const audio=new ClientAudio(send, packet=>{
  if(ready&&socket?.readyState===WebSocket.OPEN){
    if(socket.bufferedAmount>64000){disconnect();error(Error('音频上传积压，请重新连接。'));return;}
    socket.send(packet);
  }
});
$('server').value=base;
function error(e){$('error').textContent=e.message||String(e);}
function send(value){if(ready&&socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(value));}
async function api(path, options={}){
  const response=await fetch(base+'/client/v1/'+path,{...options,credentials:'omit',headers:{Authorization:'Bearer '+token,...(options.body?{'Content-Type':'application/json'}:{}),...options.headers}});
  if(!response.ok){let data;try{data=await response.json();}catch{}throw Error(data?.error?.message||data?.error?.code||'请求失败（'+response.status+'）');}
  return response.json();
}
function controls(){
  for(const id of ['send','mic','interrupt','refresh-recordings'])$(id).disabled=!ready;
  $('disconnect').disabled=!socket;
  $('connection-badge').textContent=ready?'已连接':'未连接';$('connection-badge').classList.toggle('connected',ready);
  $('start-recording').disabled=!ready||!!recording;
  $('empty-start-recording').disabled=!ready||!!recording;
  $('pause-recording').disabled=!ready||!recording;
  $('stop-recording').disabled=!ready||!recording;
  $('pause-recording').textContent=recording?.paused?'继续':'暂停';
  $('send').disabled=!ready||!!recording;
  $('mic').disabled=!ready||!!recording;
  $('recording-state').textContent=recording?(recording.paused?'已暂停':'录音中'):'未开始';
  $('recording-state').classList.toggle('active',!!recording);
}
function disconnect(){
  $('mic').textContent='开启语音';$('music-panel').hidden=true;
  ready=false;clearInterval(ping);clearInterval(poll);audio.clear();audio.stopMic();socket?.close();socket=null;recording=null;
  controls();$('status').textContent='已断开；录音状态请重新连接后刷新确认。';
}
let historyVersion=0;
async function history(){
  if(!sid)return;
  const current=sid,version=++historyVersion;
  const [rows,evidence]=await Promise.all([api('sessions/'+current+'/messages'),api('sessions/'+current+'/tool-calls')]);
  if(current===sid&&version===historyVersion)chat.history(rows,evidence);
}
async function tasks(){const data=await api('operations');chat.tasks(data.operations.filter(r=>r.session_id===sid));}
function formatClock(seconds){
  seconds=Math.max(0,Math.floor(Number(seconds)||0));
  const minutes=Math.floor(seconds/60),rest=seconds%60;
  return String(minutes).padStart(2,'0')+':'+String(rest).padStart(2,'0');
}
function formatDuration(milliseconds){
  const seconds=Math.round((Number(milliseconds)||0)/1000);
  if(seconds<60)return seconds+' 秒';
  return formatClock(seconds);
}
function recordingSource(row){
  return row.client_type==='web'?'网页录音':row.client_type==='device'?'设备录音':'';
}
function transcriptObject(value){
  const stamp=String(value?.stamp||'');
  let elapsed=Number.isFinite(value?.elapsed_ms)?value.elapsed_ms:null;
  if(elapsed===null&&/^\d{1,2}:\d{2}$/.test(stamp)){
    const [minutes,seconds]=stamp.split(':').map(Number);elapsed=(minutes*60+seconds)*1000;
  }
  return {stamp,elapsed_ms:elapsed,text:String(value?.text||''),
          speaker:value?.speaker?String(value.speaker):null,
          speaker_id:Number.isFinite(value?.speaker_id)?value.speaker_id:null};
}
function normalizeTranscript(transcript){
  if(Array.isArray(transcript?.lines)&&transcript.lines.length)return transcript.lines.map(transcriptObject);
  return String(transcript?.text||'').split('\n').filter(Boolean).map(text=>transcriptObject({text}));
}
async function recordings(){
  const data=await api('recordings');$('recordings').replaceChildren();
  $('recordings-count').textContent=data.recordings.length+' 个';
  recording=data.recordings.find(r=>r.session_id===sid&&r.status==='active')||null;controls();
  if(!data.recordings.length)$('recordings').textContent='还没有录音。';
  for(const row of data.recordings){
    const b=document.createElement('button');
    const duration=formatDuration(row.duration_ms||(row.samples?row.samples/16000*1000:0));
    const speakers=row.speaker_count?' · '+row.speaker_count+' 人':'';
    const state=row.status==='active'?(row.paused?' · 已暂停':' · 录音中'):'';
    const source=recordingSource(row)?' · '+recordingSource(row):'';
    b.textContent=new Date(row.started_at*1000).toLocaleString()+' · '+duration+speakers+state+source;
    b.className=(row.id===recording?.id?'active ':'')+(row.id===selected?.id?'selected':'');
    b.onclick=()=>openRecording(row).catch(error);$('recordings').append(b);
  }
  if(selected){const fresh=data.recordings.find(r=>r.id===selected.id);if(fresh)selected={...selected,...fresh};}
  if(recording&&!selected)await openRecording(recording).catch(error);
}
async function openRecording(row){
  selected=row;$('detail').hidden=false;$('detail-empty').hidden=true;$('detail-body').hidden=false;
  $('detail-date').textContent=new Date(row.started_at*1000).toLocaleString();
  $('detail-title').textContent=recordingSource(row)||'录音详情';
  $('detail-meta').textContent=[formatDuration(row.duration_ms||(row.samples?row.samples/16000*1000:0)),
    row.speaker_count?row.speaker_count+' 人':'',recordingSource(row)].filter(Boolean).join(' · ');
  $('detail-state').textContent=row.status==='active'?(row.paused?'已暂停':'录音中'):'已保存';
  $('detail-state').classList.toggle('active',row.status==='active');
  transcriptLines=[];$('live-state').hidden=row.status!=='active';$('live-state').textContent='正在录音，停顿后文字会实时出现在下面。';
  $('player').pause();$('player').removeAttribute('src');$('player').hidden=row.status==='active';
  $('download-raw').disabled=true;$('download-ready').disabled=row.status==='active';
  if(audioURL)URL.revokeObjectURL(audioURL);audioURL=null;
  if(row.status!=='active'){
    const response=await fetch(base+'/client/v1/recordings/'+row.id+'/audio',{credentials:'omit',headers:{Authorization:'Bearer '+token}});
    if(response.ok){audioURL=URL.createObjectURL(await response.blob());$('player').src=audioURL;$('player').load();$('download-raw').disabled=false;}
  }
  setRecordingTab('transcript');
  const transcript=await api('recordings/'+row.id+'/transcript');transcriptLines=normalizeTranscript(transcript);renderTranscript();
  $('minutes-generate').disabled=row.status==='active';
  try{const data=await api('meeting-templates');$('templates').replaceChildren();for(const t of data.templates){const option=document.createElement('option');option.value=t.template_id;option.textContent=t.name;$('templates').append(option);}}catch(e){error(e);}
  await minutes();
}
function recordingNotice(message,isError=false){
  const el=$('recording-notice');
  clearTimeout(recordingNoticeTimer);
  if(!message){el.hidden=true;el.textContent='';return;}
  el.textContent=message;el.hidden=false;el.classList.toggle('error',!!isError);
  recordingNoticeTimer=setTimeout(()=>{el.hidden=true;el.textContent='';},8000);
}
function setRecordingTab(name){
  recordingTab=name;
  for(const button of document.querySelectorAll('[data-recording-tab]')){
    const active=button.dataset.recordingTab===name;
    button.setAttribute('aria-selected',active?'true':'false');
  }
  $('tab-transcript').hidden=name!=='transcript';
  $('tab-summary').hidden=name!=='summary';
  if(name==='summary')minutes().catch(error);
}
for(const button of document.querySelectorAll('[data-recording-tab]'))
  button.onclick=()=>setRecordingTab(button.dataset.recordingTab);
function transcriptEmpty(title,hint){
  const box=document.createElement('div');box.className='transcript-empty';
  const strong=document.createElement('strong');strong.textContent=title;box.append(strong);
  const p=document.createElement('p');p.textContent=hint;box.append(p);return box;
}
function renderTranscript(){
  const target=$('transcript');target.replaceChildren();
  $('export-transcript').disabled=!transcriptLines.length;
  if(!transcriptLines.length){
    target.append(transcriptEmpty(selected?.status==='active'?'正在聆听…':'还没有文字',
      selected?.status==='active'?'声音正在保存；文字会按自然停顿陆续出现。':'这条录音还没有可用的转写。'));
    return;
  }
  transcriptLines.forEach((line,index)=>{
    const row=document.createElement('div');row.className='transcript-line';row.dataset.index=index;
    if(line.elapsed_ms!==null)row.dataset.elapsed=line.elapsed_ms;
    if(line.stamp){const time=document.createElement('time');time.textContent='['+line.stamp+']';row.append(time);}
    if(line.speaker){const speaker=document.createElement('span');speaker.className='speaker';speaker.textContent=line.speaker;row.append(speaker);}
    const text=document.createElement('span');text.className='text';text.textContent=line.text;row.append(text);
    if(selected?.status==='active'||line.elapsed_ms===null)row.classList.add('unseekable');
    else row.onclick=()=>{$('player').currentTime=line.elapsed_ms/1000;$('player').play().catch(()=>{});};
    target.append(row);
  });
}
function highlightTranscriptLine(){
  if(!selected||selected.status==='active')return;
  const rows=[...$('transcript').querySelectorAll('.transcript-line')];if(!rows.length)return;
  const at=$('player').currentTime*1000;let active=-1;
  rows.forEach((row,index)=>{const elapsed=Number(row.dataset.elapsed);if(Number.isFinite(elapsed)&&elapsed<=at)active=index;});
  rows.forEach((row,index)=>row.classList.toggle('active',index===active));
}
function applyTranscript(event){
  if(!selected||event.recording_id!==selected.id)return;
  const index=(Number(event.line)||1)-1;
  if(event.merged){
    if(index>=0&&index<transcriptLines.length)transcriptLines[index]={...transcriptLines[index],...transcriptObject(event)};
    else{reloadTranscript(selected).catch(error);return;}
  }else if(index===transcriptLines.length)transcriptLines.push(transcriptObject(event));
  else if(index<transcriptLines.length)transcriptLines[index]={...transcriptLines[index],...transcriptObject(event)};
  else{reloadTranscript(selected).catch(error);return;}
  renderTranscript();highlightTranscriptLine();
}
async function reloadTranscript(row){
  const transcript=await api('recordings/'+row.id+'/transcript');transcriptLines=normalizeTranscript(transcript);renderTranscript();highlightTranscriptLine();
}
async function minutes(){
  if(!selected)return;
  const data=await api('recordings/'+selected.id+'/minutes');
  if(!data.jobs?.length){$('minutes').textContent='还没有摘要，点击上方“生成摘要”创建。';return;}
  const job=await api('recordings/'+selected.id+'/minutes/'+data.jobs[0].id);
  $('minutes').textContent=job.job?.result?(job.job.edited_markdown||job.job.result.markdown||JSON.stringify(job.job.result,null,2)):('状态：'+(job.job?.status||'未知')+(job.job?.error?' · '+JSON.stringify(job.job.error):''));
}
$('connection').onsubmit=async event=>{
  event.preventDefault();$('error').textContent='';disconnect();
  try{
    const next=new URL($('server').value);
    if(!['http:','https:'].includes(next.protocol)||next.username||next.password||next.search||next.hash)throw Error('请输入无凭证的 HTTP/HTTPS 服务端地址。');
    if(base!==next.origin||token!==$('token').value.trim()){sid=resume=null;selected=null;}
    base=next.origin;token=$('token').value.trim();
    await api('sessions');await audio.ready();
    const ws=socket=new WebSocket(base.replace(/^http/,'ws')+'/ws');controls();$('status').textContent='正在连接…';
    ws.onopen=()=>{if(socket!==ws)return;ws.send(JSON.stringify({type:'hello',version:1,token,wake_mode:'manual',...(sid?{session_id:sid,resume_token:resume}:{}),audio:{format:'pcm_s16le',sample_rate:16000},capabilities:{echo_cancellation:true}}));};
    ws.onmessage=async event=>{if(socket!==ws)return;try{
      const e=JSON.parse(event.data);
      if(e.type==='hello'){sid=e.session_id;resume=e.resume_token;ready=true;send({type:'music.volume.set',volume:Number($('music-volume').value)});chat.reset(sid);controls();location.hash='#'+previousPage;await history();await recordings();await tasks();ping=setInterval(()=>send({type:'ping'}),20000);poll=setInterval(()=>Promise.all([recordings(),tasks()]).catch(error),3000);$('status').textContent='已连接';}
      if(e.type==='error'){if(e.code==='invalid_resume'){sid=resume=null;}throw Error(e.message||e.code);}
      if(e.type==='session.state')$('status').textContent={standby:'已连接 · 待机',listening:'聆听中',thinking:'思考中',speaking:'回复中',recording:'录音中'}[e.state]||e.state;
      if(e.type==='music.volume'){
        audio.setMusicVolume(e.volume/100);$('music-volume').value=String(e.volume);
        send({type:'music.volume.applied',request_id:e.request_id,volume:e.volume});
      }
      if(e.type==='music.state'){
        if(e.state==='playing')$('status').textContent='音乐播放中';
        else if(e.state==='paused')$('status').textContent='已连接 · 音乐已暂停';
        $('music-panel').hidden=e.state==='stopped'&&!e.title;
        $('music-title').textContent=e.title||'本地音乐';
        $('music-state').textContent={queued:'准备播放',playing:'正在播放',paused:'已暂停',stopped:'播放结束',failed:'播放失败，请换首歌重试'}[e.state]||e.state;
        $('music-pause').textContent=e.state==='paused'?'继续':'暂停';
        $('music-pause').disabled=!['playing','paused'].includes(e.state);$('music-stop').disabled=e.state==='stopped';
      }
      chat.event(e);
      if(['message.user','reply.final','turn.completed','playback.clear'].includes(e.type))await history();
      if(e.type.startsWith('tool.'))tasks().catch(error);
      if(e.type==='recording.stopped'){audio.stopMic();$('mic').textContent='开启语音';}
      if(e.type==='recording.transcript'){applyTranscript(e);}
      else if(e.type==='recording.transcription_unavailable'){if(selected?.status==='active'){$('live-state').hidden=false;$('live-state').textContent=e.message||'实时转写暂时不可用。';}if(e.message)recordingNotice(e.message,true);}
      else if(e.type==='recording.started'){
        if(e.recording)recording=e.recording.status==='active'?e.recording:null;
        controls();await recordings();if(recording)await openRecording(recording).catch(error);if(e.message)recordingNotice(e.message);
      }else if(e.type==='recording.stopped'){
        if(e.recording)recording=null;controls();await recordings();
        if(selected&&e.recording&&selected.id===e.recording.id){selected={...selected,...e.recording};await openRecording(e.recording).catch(error);}
        if(e.message)recordingNotice(e.message);
      }else if(e.type.startsWith('recording.')){
        if(e.recording)recording=e.recording.status==='active'?e.recording:null;
        if(e.type==='recording.diarized'&&selected&&selected.id===e.recording_id)await reloadTranscript(selected).catch(error);
        controls();await recordings();if(e.message)recordingNotice(e.message,e.type==='recording.finalize_failed');
      }
      await audio.event(e);
    }catch(e){error(e);}};
    ws.onclose=()=>{if(socket!==ws)return;$('music-panel').hidden=true;$('mic').textContent='开启语音';ready=false;clearInterval(ping);clearInterval(poll);audio.clear();audio.stopMic();controls();$('status').textContent='连接已断开，请重新连接。';};
    ws.onerror=()=>{if(socket===ws)error(Error('连接失败，请检查服务地址和连接码。'));};
  }catch(e){error(e);}
};
$('disconnect').onclick=disconnect;
$('text-form').onsubmit=event=>{event.preventDefault();const text=$('text').value.trim();if(text&&ready&&!recording){send({type:'input.text',text});$('text').value='';}};
$('mic').onclick=async()=>{try{if($('mic').textContent==='关闭语音'){audio.stopMic();$('mic').textContent='开启语音';return;}await audio.microphone();send({type:'session.activate'});$('mic').textContent='关闭语音';}catch(e){error(e);}};
$('interrupt').onclick=()=>{audio.clear();send({type:'interrupt'});};
async function startRecording(){try{await audio.microphone();send({type:'recording.start'});}catch(e){error(e);}}
$('start-recording').onclick=startRecording;
$('empty-start-recording').onclick=startRecording;
$('pause-recording').onclick=()=>send({type:recording?.paused?'recording.resume':'recording.pause'});
$('stop-recording').onclick=()=>send({type:'recording.stop'});
$('refresh-recordings').onclick=()=>recordings().catch(error);
$('player').addEventListener('timeupdate',highlightTranscriptLine);
function saveBlob(blob,name){
  const url=URL.createObjectURL(blob);const link=document.createElement('a');
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('download-raw').onclick=()=>{
  if(!audioURL)return;
  const link=document.createElement('a');link.href=audioURL;link.download='recording-'+selected?.id+'.wav';link.click();
};
$('download-ready').onclick=async()=>{
  if(!selected||selected.status==='active')return;
  const button=$('download-ready'),label=button.textContent;button.disabled=true;button.textContent='生成中…';
  try{
    const response=await fetch(base+'/client/v1/recordings/'+selected.id+'/ready',{credentials:'omit',headers:{Authorization:'Bearer '+token}});
    if(!response.ok)throw Error('精简音频生成失败（'+response.status+'）');
    saveBlob(await response.blob(),'recording-'+selected.id+'-ready.wav');
  }catch(e){error(e);}finally{button.textContent=label;button.disabled=selected.status==='active';}
};
$('export-transcript').onclick=()=>{
  const body=transcriptLines.map(line=>[line.stamp?'['+line.stamp+']':'',line.speaker?line.speaker+':':'',line.text].filter(Boolean).join(' ')).join('\n');
  if(!body)return;
  const url=URL.createObjectURL(new Blob([body+'\n'],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='transcript-'+selected?.id+'.txt';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('minutes-refresh').onclick=()=>minutes().catch(error);
$('minutes-generate').onclick=async()=>{if(!selected)return;try{await api('recordings/'+selected.id+'/minutes',{method:'POST',body:JSON.stringify({template_id:$('templates').value})});await minutes();}catch(e){error(e);}};
window.addEventListener('pagehide',()=>{disconnect();if(audioURL)URL.revokeObjectURL(audioURL);});

$('text').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();$('text-form').requestSubmit();}});

$('music-pause').onclick=()=>send({type:'music.control',action:$('music-pause').textContent==='继续'?'resume':'pause'});
$('music-stop').onclick=()=>send({type:'music.control',action:'stop'});
$('music-volume').oninput=event=>audio.setMusicVolume(Number(event.target.value)/100);

$('music-volume').onchange=event=>send({type:'music.volume.set',volume:Number(event.target.value)});
$('music-next').onclick=()=>send({type:'music.control',action:'next'});
