import { useEffect, useRef, useState } from "react";
import useDialogFocus from "../hooks/useDialogFocus";
import { getSupabaseClient, isSupabaseConfigured } from "../lib/supabaseClient";

const TYPES = [["feature","Feature request"],["recommendation","Recommendation issue"],["bug","Bug report"],["other","Something else"]];

export default function FeedbackModal({ open, onClose }) {
  const [type,setType]=useState("feature");
  const [message,setMessage]=useState("");
  const [email,setEmail]=useState("");
  const [status,setStatus]=useState("idle");
  const dialogRef=useRef(null);
  useDialogFocus(open, dialogRef);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown=(event)=>event.key==="Escape"&&onClose();
    document.addEventListener("keydown",onKeyDown);
    window.requestAnimationFrame(()=>dialogRef.current?.focus());
    return ()=>document.removeEventListener("keydown",onKeyDown);
  },[open,onClose]);

  if (!open) return null;

  const submit=async(event)=>{
    event.preventDefault();
    const cleanMessage=message.trim();
    if(!cleanMessage||status==="submitting") return;
    setStatus("submitting");
    try {
      if(!isSupabaseConfigured) throw new Error("Feedback service unavailable.");
      const supabase = await getSupabaseClient();
      const {error}=await supabase.from("feedback").insert({
        type,message:cleanMessage,email:email.trim()||null,page_url:window.location.href,user_agent:navigator.userAgent
      });
      if(error) throw error;
      setStatus("success"); setMessage(""); setEmail("");
    } catch(error) {
      console.error("Feedback submission failed",error);
      setStatus("error");
    }
  };

  return <div className="feedback-modal-backdrop" role="presentation" onMouseDown={(e)=>e.target===e.currentTarget&&onClose()}>
    <section className="feedback-modal" role="dialog" aria-modal="true" aria-labelledby="feedback-title" tabIndex="-1" ref={dialogRef}>
      <button className="feedback-modal-close" type="button" onClick={onClose} aria-label="Close feedback">×</button>
      {status==="success" ? <div className="feedback-success">
        <span className="browse-kicker">Sent</span><h2 id="feedback-title">Thanks. That helps.</h2>
        <p>Feedback like this is how ReelBot gets better.</p>
        <button type="button" className="reelbot-inline-button reelbot-inline-button--solid" onClick={onClose}>Done</button>
      </div> : <>
        <h2 id="feedback-title">What should we improve?</h2>
        <p className="feedback-modal-intro">Found something off or have an idea? Send it straight to us.</p>
        <form className="feedback-form" onSubmit={submit}>
          <div className="feedback-type-grid">{TYPES.map(([value,label])=><button key={value} type="button" className={`feedback-type${type===value?" is-active":""}`} onClick={()=>setType(value)}>{label}</button>)}</div>
          <label className="feedback-field"><span>Tell us more</span><textarea value={message} onChange={(e)=>setMessage(e.target.value)} maxLength="2000" placeholder={type==="bug"?"What happened? What did you expect?":"What would make ReelBot better?"} required /></label>
          <label className="feedback-field"><span>Email <small>optional</small></span><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Only if you'd like a reply" /></label>
          {status==="error"?<p className="feedback-error" role="alert">Couldn't send that just now. Please try again.</p>:null}
          <button type="submit" className="reelbot-inline-button reelbot-inline-button--solid feedback-submit" disabled={!message.trim()||status==="submitting"}>{status==="submitting"?"Sending…":"Send feedback"}</button>
        </form>
      </>}
    </section>
  </div>;
}
