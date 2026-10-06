import React, {useState} from 'react';
import {formatAdminDate} from '../adminTime';
const channels={paid:'Paid',organic:'Organic search',referral:'Referral',direct:'Direct / unknown'};
export default function AdminRequestLog({rows=[]}) {
 const [source,setSource]=useState('all');const [visitor,setVisitor]=useState('all');
 const visible=rows.filter(row=>(source==='all'||row.acquisition?.channel===source)&&(visitor==='all'||row.authenticated===(visitor==='signed_in')));
 return <section className="admin-card admin-card--full">
  <div className="admin-card-head"><h2>Prompts & results</h2><span>{visible.length} requests</span></div>
  <div className="admin-request-filters">
   <label>Source <select value={source} onChange={event=>setSource(event.target.value)}><option value="all">All sources</option>{Object.entries(channels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
   <label>Visitors <select value={visitor} onChange={event=>setVisitor(event.target.value)}><option value="all">Guests & signed in</option><option value="guest">Guests</option><option value="signed_in">Signed in</option></select></label>
  </div>
  <p className="rb-ops-note">Last 7 days, up to 200 recorded requests. Starts with this release and includes analytics-consenting visits only. Obvious contact details and links are redacted. Anonymous private windows cannot be identified as yours.</p>
  {!visible.length?<p>No recorded requests match these filters yet.</p>:<div className="admin-table-wrap"><table className="admin-table admin-request-table"><thead><tr><th>Visit</th><th>Source</th><th>Prompt</th><th>Result</th></tr></thead><tbody>{visible.map(row=><tr key={row.id}>
   <td><time>{formatAdminDate(row.time)}</time><br/>{row.authenticated?'Signed in':'Guest'}{row.is_mine?' · Yours':''}<br/><small>Session {row.session} · {row.page?.replaceAll('_',' ')}</small></td>
   <td>{channels[row.acquisition?.channel]||channels.direct}<br/><small>{row.acquisition?.source}</small>{row.acquisition?.campaign?<><br/><small>Campaign: {row.acquisition.campaign}</small></>:null}<br/><small>Landing: {row.acquisition?.landing_path||'—'}</small></td>
   <td>{row.prompt||'Surprise me / no typed prompt'}</td>
   <td>{row.movie_title?<strong>{row.movie_title}</strong>:<strong>{row.kind==='answer'&&row.outcome!=='failed'?'Answer':row.outcome==='no_match'?'No match':row.outcome==='failed'?'Request failed':'Result'}</strong>}{row.result_text?<p>{row.result_text}</p>:null}{row.alternate_titles?<details><summary>Alternatives</summary>{row.alternate_titles}</details>:null}{row.actions?.length?<p>{row.actions.join(' · ')}</p>:null}<small>{row.kind} · {row.latency_ms!=null?`${(row.latency_ms/1000).toFixed(1)}s`:'—'}</small></td>
  </tr>)}</tbody></table></div>}
 </section>;
}
