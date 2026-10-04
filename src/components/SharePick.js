import React, { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../discovery';
import { buildAbsoluteUrl } from '../siteConfig';
import { trackProductEvent } from '../analytics';
export default function SharePick({ movie, why = '', prompt = '', disabled = false }) {
 const dialog=useRef(null);const cached=useRef(new Map());
 const [isOpen,setIsOpen]=useState(false);const [includeRequest,setIncludeRequest]=useState(false);
 const [status,setStatus]=useState('');const [sharing,setSharing]=useState(false);const [preparing,setPreparing]=useState(false);
 const [sharedUrl,setSharedUrl]=useState('');const [attempt,setAttempt]=useState(0);const [failed,setFailed]=useState(false);
 const nativeShare=typeof navigator.share==='function';
 useEffect(()=>{dialog.current?.close?.();setIsOpen(false);setIncludeRequest(false);setStatus('');setSharedUrl('');cached.current.clear();},[movie.id]);
 useEffect(()=>{
  if(!isOpen)return undefined;
  const brief=includeRequest ? prompt.trim().slice(0,500) : '';
  const snapshot={v:1,id:Number(movie.id),why:String(why || 'ReelBot chose this movie for your request.').trim().slice(0,1200),brief};
  const key=JSON.stringify(snapshot);setStatus('');setFailed(false);setSharedUrl('');
  if(cached.current.has(key)){setSharedUrl(cached.current.get(key));setPreparing(false);return undefined;}
  const controller=new AbortController();setPreparing(true);
  fetch(`${API_BASE_URL}/reelbot/shares`,{method:'POST',headers:{'Content-Type':'application/json'},body:key,signal:controller.signal})
   .then(async response=>{if(!response.ok)throw Error('Share unavailable');return response.json();})
   .then(data=>{if(controller.signal.aborted)return;if(!/^\/p\/[A-Za-z0-9_-]{12}$/.test(data.path))throw Error('Invalid share link');const url=buildAbsoluteUrl(data.path);cached.current.set(key,url);setSharedUrl(url);})
   .catch(error=>{if(error.name!=='AbortError' && !controller.signal.aborted){setFailed(true);setStatus('Couldn’t prepare your link. Please try again.');}})
   .finally(()=>{if(!controller.signal.aborted)setPreparing(false);});
  return ()=>controller.abort();
 },[isOpen,movie.id,why,prompt,includeRequest,attempt]);
 const share=async(copyOnly=false)=>{
  if(sharing || preparing || disabled || !sharedUrl)return;
  setSharing(true);setStatus('');
  try {
   if(!copyOnly && nativeShare){await navigator.share({title:`Tonight’s pick: ${movie.title}`,text:`ReelBot picked ${movie.title} for me. What do you think?`,url:sharedUrl});setStatus('Shared');}
   else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(sharedUrl);setStatus('Link copied. Ready to send.');}
   else setStatus('Select the link above to copy it.');
   trackProductEvent('pick_shared',{movie_id:Number(movie.id),includes_request:includeRequest});
  }catch(error){if(error.name!=='AbortError')setStatus('Couldn’t share. Try copying the link.');}
  finally{setSharing(false);}
 };
 const close=()=>{dialog.current.close();setIsOpen(false);};
 return <>
  <button className="pick-share-trigger" type="button" disabled={disabled} onClick={()=>{setIsOpen(true);dialog.current.showModal();}}><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 15V3m-4 4 4-4 4 4M5 11v9h14v-9" /></svg>Share this pick</button>
  <dialog ref={dialog} className="pick-share-dialog" aria-labelledby="share-pick-title" onClose={()=>{setIsOpen(false);setStatus('');}}>
   <button className="pick-share-close" type="button" aria-label="Close sharing" onClick={close}>×</button>
   <p className="pick-share-eyebrow">A PICK WORTH SHARING</p><h2 id="share-pick-title">Share your pick</h2>
   <div className="pick-share-preview">{movie.poster_path ? <img src={`https://image.tmdb.org/t/p/w185${movie.poster_path}`} alt="" /> : null}<div><span className="pick-share-preview-label">REELBOT’S PICK</span><strong>{movie.title}</strong><p>The movie and why ReelBot chose it.</p><p className="pick-share-note">Anyone with this link can see the pick{includeRequest ? ' and your request' : ''}.</p></div></div>
   {prompt.trim() ? <label className="pick-share-option"><input type="checkbox" checked={includeRequest} onChange={event=>setIncludeRequest(event.target.checked)} /><span>Include what I asked for<small>Give them the mood behind the movie.</small></span></label> : null}
   {includeRequest ? <blockquote>{prompt}</blockquote> : null}
   <div className="pick-share-link-preview" aria-live="polite">{preparing ? 'Preparing your link…' : sharedUrl ? sharedUrl.replace(/^https:\/\//,'') : 'Your link will appear here.'}</div>
   <div className="pick-share-dialog-actions"><button className="reelbot-inline-button reelbot-inline-button--solid" type="button" disabled={preparing || sharing || !sharedUrl} onClick={()=>share(!nativeShare)}>{nativeShare ? 'Share pick' : 'Copy link'}</button>{nativeShare ? <button className="reelbot-inline-button" type="button" disabled={preparing || sharing || !sharedUrl} onClick={()=>share(true)}>Copy link</button> : sharedUrl ? <a className="pick-share-open-link" href={sharedUrl}>Open shared pick <span aria-hidden="true">↗</span></a> : null}</div>
   {status ? <p className="pick-share-feedback" role="status">{status}{failed ? <> <button type="button" className="pick-share-retry" onClick={()=>setAttempt(value=>value+1)}>Try again</button></> : null}</p> : null}
  </dialog>
 </>;
}
