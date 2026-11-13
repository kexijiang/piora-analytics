import fs from 'node:fs';
import path from 'node:path';
import {emptyMetrics,emptyCoverage} from '../packages/contracts/telemetry.mjs';
const root=path.resolve(import.meta.dirname,'..');
const id=n=>'70000000-0000-4000-8000-'+String(n).padStart(12,'0');
const names=['陈一禾','林予安','周知远','许星澜','宋时雨','陆景行','苏晚晴','顾清和','温书宁','程予舟','叶南乔','沈亦然'];
const departments=['产品研发','平台工程','设计与体验'].map((name,i)=>({id:id(100+i),name,status:'active',revision:1}));
const employees=names.map((name,i)=>({id:id(i+1),name,employee_no:'DEMO-'+String(i+1).padStart(3,'0'),department_id:departments[i%3].id,status:'active',installation_count:i<10?1:0,revision:1}));
const daily=[];
for(let d=0;d<14;d++)for(let i=0;i<10;i++){
 const date='2026-11-'+String(d+1).padStart(2,'0'),q=12+(i*7+d*3)%35,known=(q*3-1)*6900;
 const metrics={...emptyMetrics(),queries:String(q),completed_queries:String(q-2),failed_queries:'1',cancelled_queries:'1',interrupted_queries:'0',pending_queries:'0',opens:String(2+i%4),launches:String(1+i%2),runtime_ms:String((380+i*13)*60000),active_ms:String((90+q*3+i*6)*60000),task_ms:String(q*97000),unknown_task_runs:'0',model_calls:String(q*3),input_tokens:String(known*0.5),output_tokens:String(known*0.2),cache_read_tokens:String(known*0.3),cache_write_tokens:'0',total_tokens:String(known),added_lines:String(q*17+i*12),deleted_lines:String(q*4+i*3),files_created:String(2+i%4),files_touched:String(10+i),file_operations:String(q*2)};
 daily.push({date,employee_id:employees[i].id,employee_name:employees[i].name,department_id:employees[i].department_id,department_name:departments[i%3].name,metrics,coverage:{...emptyCoverage(i%4===0?'partial':'complete'),known_model_calls:String(q*3-1),unknown_model_calls:'1',measured_file_operations:String(q*2-1),unmeasured_file_operations:'1',last_received_at:'2026-11-13T09:42:00.000Z',data_through:'2026-11-13T09:38:00.000Z',warning_codes:i%4===0?['UNKNOWN_USAGE']:[]},app_version:i<7?'0.5.11-beta.4':'0.5.10'});
}
const installations=employees.slice(0,10).map((e,i)=>({id:id(200+i),windows_username:'demo.user'+(i+1),device_label:'DEMO-WIN-'+String(i+1).padStart(2,'0'),employee_id:e.id,app_version:i<7?'0.5.11-beta.4':'0.5.10',status:'active',last_received_at:i===7?'2026-11-13T07:40:00.000Z':'2026-11-13T09:42:00.000Z',last_event_at:'2026-11-13T09:38:00.000Z',reported_queue_events:i===7?'182':'4',coverage:emptyCoverage(),revision:1}));
for(let i=0;i<3;i++)installations.push({...installations[i],id:id(300+i),windows_username:'demo.new'+i,device_label:'DEMO-NEW-'+i,employee_id:null});
fs.mkdirSync(path.join(root,'apps/dashboard/src/demo'),{recursive:true});
fs.writeFileSync(path.join(root,'apps/dashboard/src/demo/data.json'),JSON.stringify({departments,employees,daily,installations},null,2)+'\n');
console.log('Generated explicit synthetic dashboard data.');
