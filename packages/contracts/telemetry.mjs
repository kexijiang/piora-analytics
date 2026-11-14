export const metricNames=['queries','completed_queries','failed_queries','cancelled_queries','interrupted_queries','pending_queries','opens','launches','runtime_ms','active_ms','task_ms','unknown_task_runs','model_calls','input_tokens','output_tokens','cache_read_tokens','cache_write_tokens','total_tokens','added_lines','deleted_lines','files_created','files_touched','file_operations'];
export const tokenNames=['input_tokens','output_tokens','cache_read_tokens','cache_write_tokens','total_tokens'];
export const defaultPolicy={version:1,enabled:true,interval_min_seconds:1500,interval_max_seconds:2100,initial_delay_min_seconds:60,initial_delay_max_seconds:300,reconnect_min_seconds:120,reconnect_max_seconds:600,max_batch_events:500,max_batch_bytes:262144,queue_max_days:30,queue_max_bytes:268435456};
export function emptyMetrics(){return Object.fromEntries(metricNames.map(k=>[k,tokenNames.includes(k)||k==='task_ms'?null:'0']));}
export function emptyCoverage(state='complete'){return {state,known_model_calls:'0',unknown_model_calls:'0',measured_file_operations:'0',unmeasured_file_operations:'0',last_received_at:null,data_through:null,warning_codes:[]};}
export function sumMetrics(rows){
 const out=emptyMetrics();
 for(const k of metricNames){const known=rows.map(x=>x[k]).filter(x=>x!==null&&x!==undefined);out[k]=known.length?known.reduce((s,x)=>s+BigInt(x),0n).toString():out[k];}
 return out;
}
export function sumCoverage(rows){
 const out=emptyCoverage(rows.length?'complete':'no_reports');
 for(const k of ['known_model_calls','unknown_model_calls','measured_file_operations','unmeasured_file_operations'])out[k]=rows.reduce((s,r)=>s+BigInt(r[k]??0),0n).toString();
 for(const k of ['last_received_at','data_through'])out[k]=rows.map(r=>r[k]).filter(Boolean).sort().at(-1)??null;
 out.warning_codes=[...new Set(rows.flatMap(r=>r.warning_codes))];
 if(rows.some(r=>r.state==='partial'||r.state==='unknown')||out.warning_codes.length)out.state='partial';
 return out;
}
export function dayOf(t){return new Date(new Date(t).getTime()+28800000).toISOString().slice(0,10);}
export function splitDays(start,end){
 const parts=[];let a=Date.parse(start);const b=Date.parse(end);
 if(!Number.isFinite(a)||!Number.isFinite(b)||b<a)throw new Error('INVALID_INTERVAL');
 while(a<b){const day=dayOf(a),next=Date.parse(day+'T00:00:00+08:00')+86400000,e=Math.min(b,next);parts.push({day,start:a,end:e});a=e;}
 return parts;
}
export function unionIntervals(ranges){
 const sorted=ranges.map(([a,b])=>[Number(a),Number(b)]).filter(([a,b])=>Number.isFinite(a)&&b>a).sort((a,b)=>a[0]-b[0]);
 const out=[];for(const r of sorted){const prev=out.at(-1);if(prev&&r[0]<=prev[1])prev[1]=Math.max(prev[1],r[1]);else out.push([...r]);}return out;
}
export const intervalMs=ranges=>unionIntervals(ranges).reduce((s,[a,b])=>s+b-a,0);
export function validateInt64(value){
 if(typeof value!=='string'||!/^(0|[1-9][0-9]*)$/.test(value)||BigInt(value)>9223372036854775807n)throw new Error('INVALID_INT64');
 return value;
}
export function validateEventBusiness(e,now=Date.now()){
 const p=e.payload,t=Date.parse(e.occurred_at);
 if(t>now+300000)throw new Error('CLOCK_SUSPECT');
 if(t<now-30*86400000)throw new Error('EVENT_TOO_OLD');
 for(const key of ['accepted_at','started_at','finished_at','start_at','end_at'])if(p[key]!=null){
  const value=Date.parse(p[key]);if(!Number.isFinite(value))throw new Error('INVALID_EVENT');
  if(value>now+300000)throw new Error('CLOCK_SUSPECT');
  if(value<now-30*86400000)throw new Error('EVENT_TOO_OLD');
 }
 if(BigInt(e.event_seq)<1n)throw new Error('INVALID_EVENT');
 function walk(x){if(!x||typeof x!=='object')return;for(const [k,v] of Object.entries(x)){if(v!==null&&(/_tokens$|_ms$|_lines$|^event_seq$|^queue_|^dropped_events$|^quarantined_events$/.test(k))&&typeof v==='string')validateInt64(v);if(typeof v==='object')walk(v);}}walk(e);
 if(e.event_type==='desktop.activity'){
  const a=Date.parse(p.start_at),b=Date.parse(p.end_at),rs=p.active_ranges.map(r=>[Date.parse(r.start_at),Date.parse(r.end_at)]);
  if(p.time_quality==='suspect')throw new Error('CLOCK_SUSPECT');
  if(b<=a||b-a>60000||Number(p.runtime_ms)>b-a||rs.some(([s,e])=>s<a||e>b||s>=e)||intervalMs(rs)>Number(p.runtime_ms)||rs.reduce((s,[a,b])=>s+b-a,0)!==intervalMs(rs))throw new Error('INVALID_EVENT');
 }
 if(e.event_type==='model.finished'){
  if(p.status!=='interrupted'&&(p.finished_at===null||p.duration_ms===null))throw new Error('INVALID_EVENT');
  if(p.finished_at&&Date.parse(p.finished_at)<Date.parse(p.started_at))throw new Error('INVALID_EVENT');
  const known=tokenNames.filter(k=>p[k]!==null);
  if(p.usage_status==='unavailable'&&known.length||p.usage_status==='partial'&&!known.length||p.usage_status==='reported'&&!(known.length===5||known.length===1&&known[0]==='total_tokens'))throw new Error('INVALID_EVENT');
  if(known.length===5&&tokenNames.slice(0,4).reduce((s,k)=>s+BigInt(p[k]),0n)!==BigInt(p.total_tokens))throw new Error('INVALID_EVENT');
 }
 if(e.event_type==='file.changed'){
  if(p.measurement_status==='measured'&&(p.added_lines===null||p.deleted_lines===null||p.kind==='unknown'))throw new Error('INVALID_EVENT');
  if(p.measurement_status!=='measured'&&(p.added_lines!==null||p.deleted_lines!==null))throw new Error('INVALID_EVENT');
  if(p.measurement_status==='measured'&&((p.kind==='created'&&p.deleted_lines!=='0')||(p.kind==='unchanged'&&(p.deleted_lines!=='0'||p.added_lines!=='0'))))throw new Error('INVALID_EVENT');
 }
 if(e.event_type==='query.updated'&&p.revision<1)throw new Error('INVALID_EVENT');
 if(e.event_type==='run.finished'&&p.outcome!=='interrupted'&&(p.duration_ms===null||p.finished_at===null))throw new Error('INVALID_EVENT');
}
export function validatePolicy(p){
 const validInterval=s=>Number.isSafeInteger(s)&&s>0&&Number.isFinite(new Date(Date.now()+s*1000).getTime());
 if(!validInterval(p.interval_min_seconds)||!validInterval(p.interval_max_seconds)||p.interval_max_seconds<p.interval_min_seconds||p.initial_delay_max_seconds<p.initial_delay_min_seconds||p.reconnect_max_seconds<p.reconnect_min_seconds)throw new Error('POLICY_INVALID');
}
/** Old collectors reject intervals outside their original 25–120 / 35–120 minute bounds. */
export function policyForClient(policy,capabilities=''){
 if(String(capabilities).split(',').map(s=>s.trim()).includes('configurable-sync-interval'))return policy;
 const min=Math.min(7200,Math.max(1500,policy.interval_min_seconds));
 return {...policy,interval_min_seconds:min,interval_max_seconds:Math.min(7200,Math.max(2100,min,policy.interval_max_seconds))};
}
export function acknowledgeBatch(sent,response){
 const all=[...response.accepted_event_ids,...response.duplicate_event_ids,...response.rejected_events.map(e=>e.event_id)],expected=new Set(sent);
 if(all.length!==expected.size||new Set(all).size!==all.length||all.some(x=>!expected.has(x)))throw new Error('INVALID_ACK');
 return {remove:[...response.accepted_event_ids,...response.duplicate_event_ids],quarantine:response.rejected_events};
}
export function csvCell(value){let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
