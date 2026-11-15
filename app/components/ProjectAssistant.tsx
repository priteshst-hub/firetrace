'use client';
import {useEffect,useRef,useState} from 'react';
import {MessageCircle,X,Send,RotateCcw} from 'lucide-react';
import {getGlobeChatContext} from './globe-chat-context';
type Source={title:string;url:string};type Message={role:'user'|'assistant';content:string;sources?:Source[]};
const prompts=['What is FireTrace useful for?','How do I use the globe?','Why does VIIRS show more detections?','Is calibration finished?'];
export default function ProjectAssistant({open,onOpen,onClose}:{open:boolean;onOpen:()=>void;onClose:()=>void}){
 const [messages,setMessages]=useState<Message[]>([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const input=useRef<HTMLTextAreaElement>(null),end=useRef<HTMLDivElement>(null),request=useRef<AbortController|null>(null),launcher=useRef<HTMLButtonElement>(null);
 useEffect(()=>{if(!open)return;const f=requestAnimationFrame(()=>input.current?.focus());return()=>cancelAnimationFrame(f);},[open]);
 useEffect(()=>{if(!open)return;const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){onClose();launcher.current?.focus();}};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[open,onClose]);
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest'});},[messages,busy]);
 useEffect(()=>()=>request.current?.abort(),[]);
 function close(){onClose();launcher.current?.focus();}
 function clear(){request.current?.abort();request.current=null;setBusy(false);setError('');setMessages([]);setDraft('');input.current?.focus();}
 async function ask(question:string){
  if(busy||!question.trim())return;const q=question.trim();const controller=new AbortController();request.current=controller;
  const next:Message[]=[...messages,{role:'user',content:q}];setMessages(next);setDraft('');setError('');setBusy(true);
  const timeout=setTimeout(()=>controller.abort('timeout'),45000);
  try{const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:next.slice(-7).map(({role,content})=>({role,content:content.slice(0,1500)})),globeContext:getGlobeChatContext()}),signal:controller.signal});const result=await r.json() as {answer?:string;error?:string;sources?:Source[]};if(!r.ok||!result.answer)throw Error(result.error||'The assistant could not answer. Please try again.');if(request.current===controller)setMessages([...next,{role:'assistant',content:result.answer,sources:result.sources}]);}
  catch(e){if(request.current!==controller)return;setMessages(messages);setDraft(d=>d||q);setError(controller.signal.aborted?'The assistant took too long. Try again, or read the project guide.':e instanceof Error?e.message:'Connection failed. Try again.');}
  finally{clearTimeout(timeout);if(request.current===controller){setBusy(false);request.current=null;}}
 }
 return <><button ref={launcher} className="assistant-launcher" aria-label="Ask FireTrace AI" aria-expanded={open} aria-controls="project-assistant" onClick={open?close:onOpen}><MessageCircle size={19}/><span>Ask FireTrace AI</span></button>{open&&<aside id="project-assistant" className="project-assistant" aria-label="FireTrace AI assistant">
 <header><div><span className="tiny">YOUR PROJECT GUIDE</span><h2>Ask FireTrace AI</h2></div><button aria-label="Start a new chat" onClick={clear}><RotateCcw size={17}/></button><button aria-label="Close assistant" onClick={close}><X size={19}/></button></header>
 <div className="assistant-scroll"><p className="assistant-intro">Questions about the project? Ask about sensors, data, results or how to explore.</p><p className="assistant-note">AI can make mistakes. Check the project references. Historical 2019–2020 data; no live fire alerts.</p>{!messages.length&&<div className="assistant-prompts">{prompts.map(q=><button key={q} disabled={busy} onClick={()=>ask(q)}>{q} ↗</button>)}</div>}
 <div role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions">{messages.map((m,i)=><article key={i} className={`assistant-message ${m.role}`}><strong>{m.role==='user'?'You':'FireTrace AI'}</strong><p>{m.content}</p>{m.sources&&<div className="assistant-sources"><span>Project references</span>{m.sources.filter(s=>['/reports/firetrace-guide.md','/reports/history-validation.json'].includes(s.url)).map(s=><a key={s.url} href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a>)}</div>}</article>)}{busy&&<p role="status" className="assistant-thinking">Reading the project reference…</p>}</div>{error&&<div role="alert" className="assistant-error">{error} <a href="/reports/firetrace-guide.md" target="_blank" rel="noreferrer">Read guide ↗</a></div>}<div ref={end}/></div>
 <form onSubmit={e=>{e.preventDefault();void ask(draft);}}><label htmlFor="assistant-question">Your project question</label><div><textarea ref={input} id="assistant-question" rows={2} maxLength={1500} value={draft} placeholder="Ask about FireTrace…" onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void ask(draft);}}}/><button type="submit" aria-label="Send question" disabled={busy||!draft.trim()}><Send size={18}/></button></div><p>Sent to Cloudflare Workers AI. FireTrace keeps chat in page memory; refreshing clears it. Don’t share personal details.</p></form>
 </aside>}</>;
}
