/* Standalone interaction study. No campaign endpoints or real recipients. */
const accessibleLetter=$('accessible');
const initialLetter=$('message').value;
const storedKey='vivid:sending-demo:inbox:v1';
const seed={
  private:[
    {id:'elara',name:'Elara',kind:'NPC · Your guide',messages:[
      {author:'Elara',text:'The road north is watched. Take the river path.',time:'Yesterday',read:true},
      {author:'You',text:'I will look for your signal at dusk.',time:'Yesterday',own:true,read:true},
      {author:'Elara',text:initialLetter,time:'Just now',read:false}]},
    {id:'rowan',name:'Rowan',kind:'Party member',messages:[
      {author:'Rowan',text:'Found our missing map. There is another passage beneath the chapel.',time:'5 min ago',read:false}]},
    {id:'keeper',name:'The Keeper',kind:'NPC · Candlekeep',messages:[
      {author:'The Keeper',text:'Your book is safe in the west archive. Bring the silver key.',time:'Yesterday',read:true},
      {author:'You',text:'Thank you. We will collect it after the council.',time:'Yesterday',own:true,read:true}]}
  ],
  party:[{author:'Rowan',text:'We should rest before we head to the tower.',time:'Earlier'},{author:'Mira',text:'I have enough supplies for everyone.',time:'Earlier'}],
  table:[{author:'GM',text:'We are picking up at the north gate tonight.',time:'Earlier'},{author:'Rowan',text:'Ready when everyone else is!',time:'Earlier'}]
};
let mail=structuredClone(seed);
try{const saved=JSON.parse(sessionStorage.getItem(storedKey));if(saved&&Array.isArray(saved.private)&&Array.isArray(saved.party)&&Array.isArray(saved.table))mail=saved}catch{}
let channel='private',threadId=null,peekId=null,peekTimer=0;
const drafts=new Map();
function saveMail(){try{sessionStorage.setItem(storedKey,JSON.stringify(mail))}catch{}}
function currentThread(){return mail.private.find(t=>t.id===threadId)}
function unreadCount(){return mail.private.reduce((sum,t)=>sum+t.messages.filter(m=>!m.read&&!m.own).length,0)}
function isOpen(){return !$('scroll').classList.contains('closed')}
function updateSeal(){const n=unreadCount();$('private-count').textContent=n?String(n):'';$('dock').classList.toggle('has-unread',n>0);$('dock').querySelector('span:last-child').textContent=n?`${n} unread Sending${n===1?'':'s'}`:'Your correspondence';$('dock').setAttribute('aria-label',n?`Open Sendings, ${n} unread`:'Open your Sendings')}
function stopWriting(){cancelAnimationFrame(raf);active=false;particles=[];trail=[];$('reveal').hidden=true}
function rememberDraft(){if(!$('reply-form').hidden)drafts.set(channel==='private'?threadId:channel,$('reply-text').value)}
function closeComposer(){rememberDraft();$('reply-form').hidden=true;$('reply-error').textContent='';$('reply').hidden=channel==='private'&&!threadId}
function node(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el}
function messageNode(m){const entry=node('article',`message-entry${m.own?' own':''}`);const meta=node('div','message-meta');meta.append(node('strong','',m.own?'You':m.author),node('span','',m.time));entry.append(meta,node('p','message-body',m.text));return entry}
function showInbox(){rememberDraft();stopWriting();channel='private';threadId=null;render()}
function openPanel(){const wasClosed=!isOpen();$('scroll').classList.remove('closed');$('scroll').inert=false;$('scroll').setAttribute('aria-hidden','false');$('dock').hidden=true;$('sending-peek').hidden=true;$('tuck').textContent='Roll up';if(wasClosed)render()}
function foldPanel(){rememberDraft();stopWriting();tuck();updateSeal();$('dock').focus()}
function changeChannel(next){rememberDraft();stopWriting();channel=next;threadId=null;render()}
function renderInbox(){const intro=node('p','inbox-intro','Private letters, kept by sender.');$('letter').append(intro);const ordered=[...mail.private].sort((a,b)=>Number(b.messages.some(m=>!m.read&&!m.own))-Number(a.messages.some(m=>!m.read&&!m.own))||(b.messages.at(-1)?.stamp||0)-(a.messages.at(-1)?.stamp||0));for(const thread of ordered){const last=thread.messages.at(-1),unread=thread.messages.filter(m=>!m.read&&!m.own).length;const row=node('button','sending-row');row.type='button';row.setAttribute('aria-label',`${thread.name}${unread?`, ${unread} unread`:''}: ${last?.text||'Start a Sending'}`);const head=node('span','sending-row-head');if(unread)head.append(node('span','unread-dot'));head.append(node('strong','',thread.name),node('time','',last?.time||''));row.append(head,node('span','sending-excerpt',`${last?.own?'You: ':''}${last?.text||'Write a Sending'}`),node('span','sender-kind',thread.kind));row.onclick=()=>{threadId=thread.id;render();$('back').focus()};$('letter').append(row)}$('status').textContent=unreadCount()?`${unreadCount()} unread. Choose a letter to open.`:'All caught up. Choose a conversation.'}
function render(){
 stopWriting();$('reply-form').hidden=true;$('reply-error').textContent='';$('letter').replaceChildren();$('back').hidden=!(channel==='private'&&threadId);$('thread-note').hidden=false;
 document.querySelectorAll('[data-channel]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.channel===channel)));
 $('reply').hidden=channel==='private'&&!threadId;
 if(channel==='private'&&!threadId){$('from').textContent='Your Sendings';$('thread-note').textContent='Private letters & replies';renderInbox();updateSeal();return}
 const thread=channel==='private'?currentThread():null;
 if(channel==='private'&&!thread){threadId=null;render();return}
 $('from').textContent=thread?thread.name:channel==='party'?'Party correspondence':'Table talk';
 $('thread-note').textContent=thread?'Private Sending':channel==='party'?'In character · Shared with your party':'Out of character · Everyone at the table';
 const messages=thread?thread.messages:mail[channel];
 const fresh=thread?[...messages].reverse().find(m=>!m.read&&!m.own):null;
 for(const m of messages){
   if(m===fresh){const entry=node('article','message-entry magic-entry');const meta=node('div','message-meta');meta.append(node('strong','',m.author),node('span','','New Sending'));entry.append(meta,canvas,accessibleLetter);$('letter').append(entry)}
   else $('letter').append(messageNode(m));
 }
 if(thread){for(const m of messages)m.read=true;saveMail()}
 $('status').textContent='Sample conversation · Replies stay in this demo.';
 updateSeal();
 if(fresh){$('reveal').hidden=false;animateLetter(fresh.text);$('letter').scrollTop=Math.max(0,canvas.offsetTop-25)}
 else $('letter').scrollTop=$('letter').scrollHeight;
}
function openReply(){if(channel==='private'&&!threadId)return;stopWriting();if(canvas.isConnected){skip=true;active=true;frame(performance.now());active=false}$('reply-form').hidden=false;$('reply').hidden=true;$('reply-label').textContent=channel==='private'?`Reply to ${currentThread().name}`:channel==='party'?'Write to your party':'Write to the table';$('reply-text').placeholder=channel==='private'?'Write your Sending…':'Write a message…';$('reply-text').value=drafts.get(channel==='private'?threadId:channel)||'';$('reply-form').querySelector('[type=submit]').textContent=channel==='private'?'Send Sending':'Send message';$('reply-text').focus();$('letter').scrollTop=$('letter').scrollHeight}
function notify(thread){peekId=thread.id;clearTimeout(peekTimer);$('sending-peek').textContent=`A Sending from ${thread.name}. Tap to read.`;$('sending-peek').hidden=false;peekTimer=setTimeout(()=>$('sending-peek').hidden=true,6500)}
function receiveDemo(){const text=$('message').value.trim(),name=$('sender').value.trim();if(!name||!text){$('feedback').textContent='Add a sender and a letter first.';(!name?$('sender'):$('message')).focus();return}let thread=mail.private.find(t=>t.name.toLocaleLowerCase()===name.toLocaleLowerCase());if(!thread){thread={id:`demo-${Date.now()}`,name,kind:'Demo contact',messages:[]};mail.private.unshift(thread)}thread.messages.push({author:thread.name,text,time:'Just now',stamp:Date.now(),read:false});saveMail();updateSeal();$('feedback').textContent=`A sample Sending from ${thread.name} has arrived.`;if(isOpen()&&channel==='private'&&threadId===thread.id){rememberDraft();render()}else{if(isOpen()&&channel==='private'&&!threadId)render();notify(thread)}}
$('reply-form').addEventListener('submit',e=>{e.preventDefault();const text=$('reply-text').value.trim();if(!text){$('reply-error').textContent='Write a few words before sending.';$('reply-text').focus();return}const message={author:'You',text,time:'Just now',stamp:Date.now(),own:true,read:true};if(channel==='private')currentThread().messages.push(message);else mail[channel].push(message);drafts.delete(channel==='private'?threadId:channel);saveMail();render();$('status').textContent='Reply saved in this demo. Nothing was sent to a real player.';$('reply').focus()});
$('cast').onclick=receiveDemo;$('fold').onclick=foldPanel;$('tuck').onclick=()=>isOpen()?foldPanel():openPanel();$('dock').onclick=openPanel;$('back').onclick=showInbox;$('reply').onclick=openReply;$('cancel-reply').onclick=()=>{closeComposer();$('reply').focus()};$('sending-peek').onclick=()=>{rememberDraft();channel='private';threadId=peekId;openPanel();render();$('back').focus()};
$('reveal').onclick=()=>{skip=true;cancelAnimationFrame(raf);frame(performance.now());$('reveal').hidden=true};
document.querySelectorAll('[data-channel]').forEach(b=>b.onclick=()=>changeChannel(b.dataset.channel));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen()){$('reply-form').hidden?foldPanel():closeComposer()}});
$('ink').onchange=()=>{$('feedback').textContent='Ink selected. It will colour the next new Sending.'};$('speed').onchange=()=>{$('feedback').textContent='Writing pace selected for the next new Sending.'};
$('cast').textContent='Simulate new Sending';document.querySelector('.hint').textContent='Interactive inbox demo · Sample conversations only. Open a conversation to read and reply, or try Party and Table talk. Simulate a new Sending to try magical writing and tucked notifications.';
const resetDemo=node('button','control secondary','Reset sample inbox');resetDemo.type='button';resetDemo.onclick=()=>{rememberDraft();stopWriting();mail=structuredClone(seed);drafts.clear();channel='private';threadId=null;clearTimeout(peekTimer);$('sending-peek').hidden=true;saveMail();openPanel();render();$('feedback').textContent='Sample inbox reset. Open Elara to see the magical letter.'};document.querySelector('.actions').append(resetDemo);
updateSeal();openPanel();
