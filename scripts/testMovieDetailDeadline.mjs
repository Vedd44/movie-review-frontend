// Local-only real-adapter regression: never contacts production or external APIs.
// Run: node scripts/testMovieDetailDeadline.mjs http (then xhr).
import http from 'node:http';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const mode=process.argv[2]||'http';
assert.ok(['http','xhr'].includes(mode),'Use http or xhr');
let dom;
if(mode==='xhr'){const {JSDOM}=await import('jsdom');dom=new JSDOM('',{url:'http://localhost/'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.XMLHttpRequest=dom.window.XMLHttpRequest;}
const cwd=fileURLToPath(new URL('../',import.meta.url)).replace(/\/$/,'');
const axiosURL=pathToFileURL(require.resolve('axios')).href;
const source=(await fs.readFile(cwd+'/src/services/movieDetailRequest.js','utf8')).replace('"axios"',JSON.stringify(axiosURL));
const {requestMovieDetails}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
let active=0;let calls=0;let aborted=0;let slowCalls=0;
const sockets=new Set();
const server=http.createServer((req,res)=>{
 active++;calls++;res.setHeader('Access-Control-Allow-Origin','*');
 res.on('close',()=>{active--;if(!res.writableEnded)aborted++;});
 if(req.url==='/slow429'&&++slowCalls===1){const timer=setTimeout(()=>{res.statusCode=429;res.setHeader('Content-Type','application/json');res.end('{"retry_after_seconds":3}');},10000);res.on('close',()=>clearTimeout(timer));}
 if(req.url==='/ok'){res.setHeader('Content-Type','application/json');res.end('{"id":1637,"title":"Speed"}');}
});
server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const results=[];
try {
 let start=performance.now();
 await assert.rejects(requestMovieDetails(base+'/stall'),error=>error.code==='ECONNABORTED');
 const ms=Math.round(performance.now()-start);assert.ok(ms>=14500&&ms<17000,`elapsed ${ms}`);assert.equal(calls,1);
 await new Promise(r=>setTimeout(r,50));assert.equal(active,0);assert.equal(aborted,1);
 results.push({case:'actual Axios HTTP adapter stalls with no response',milliseconds:ms,calls,active,aborted,pass:true});
 const controller=new AbortController();start=performance.now();
 const p=requestMovieDetails(base+'/stall',{signal:controller.signal});setTimeout(()=>controller.abort(),50);
 await assert.rejects(p,error=>error.name==='AbortError');
 await new Promise(r=>setTimeout(r,50));assert.equal(active,0);assert.equal(aborted,2);
 results.push({case:'caller abort cancels real socket before timeout',milliseconds:Math.round(performance.now()-start),active,aborted,pass:true});
 start=performance.now();const response=await requestMovieDetails(base+'/ok');assert.equal(response.data.title,'Speed');if(mode==='xhr')assert.equal(response.request.constructor.name,'XMLHttpRequest');assert.equal(calls,3);
 results.push({case:'explicit subsequent retry succeeds',milliseconds:Math.round(performance.now()-start),calls,pass:true});
 start=performance.now();await assert.rejects(requestMovieDetails(base+'/slow429'),error=>error.code==='ECONNABORTED');
 const totalMs=Math.round(performance.now()-start);await new Promise(r=>setTimeout(r,50));assert.ok(totalMs>=14500&&totalMs<17000);assert.equal(slowCalls,2);assert.equal(active,0);
 results.push({case:'delayed 429 plus retry shares whole 15-second deadline',milliseconds:totalMs,requests:slowCalls,active,pass:true});
 console.log(JSON.stringify({adapter:mode,results},null,2));
}finally{for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));dom?.window.close();}
