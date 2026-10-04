import React from 'react';
// Inline emphasis only: copy remains text, never HTML or executable markup.
export default function MovieCopy({ children, titles = [] }) {
 const text=String(children || '');
 const escaped=titles.filter(Boolean).sort((a,b)=>b.length-a.length).map(title=>String(title).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 const pattern=new RegExp(`\\*{1,2}([^*\\n]+)\\*{1,2}${escaped.length ? '|(?<![\\p{L}\\p{N}])(?:'+escaped.join('|')+')(?![\\p{L}\\p{N}])' : ''}`,'gu');
 const parts=[];let cursor=0;let match;
 while ((match=pattern.exec(text))) { if(match.index>cursor) parts.push(text.slice(cursor,match.index));parts.push(<em key={match.index}>{match[1] || match[0]}</em>);cursor=pattern.lastIndex; }
 parts.push(text.slice(cursor));return <>{parts}</>;
}
