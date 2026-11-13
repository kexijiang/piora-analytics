import assert from 'node:assert/strict';
import {testDatabase} from '../tests/support/postgres.mjs';
import {uuid} from '../apps/api/src/core.mjs';
const db=await testDatabase();
try{
 const c=db.pool,o=uuid(),other=uuid(),e=uuid(),i=uuid(),day='2026-11-13';
 await c.query("INSERT INTO organizations(id,name) VALUES($1,'测试'),($2,'第二组织')",[o,other]);
 await c.query("INSERT INTO employees(id,org_id,name) VALUES($1,$2,'合成员工')",[e,o]);
 await c.query("INSERT INTO installations(id,org_id,registration_id,registration_hash,windows_username,device_label,app_version,sdk_version,capabilities) VALUES($1,$2,$3,$4,'demo','demo','1','1',ARRAY[]::text[])",[i,o,uuid(),Buffer.from('a')]);
 await c.query("INSERT INTO installation_bindings(id,org_id,installation_id,employee_id,valid_days,reason) VALUES($1,$2,$3,$4,daterange($5::date,NULL,'[)'),'test')",[uuid(),o,i,e,day]);
 await assert.rejects(c.query("INSERT INTO installation_bindings(id,org_id,installation_id,employee_id,valid_days,reason) VALUES($1,$2,$3,$4,daterange($5::date,NULL,'[)'),'test')",[uuid(),o,i,e,day]),{code:'23P01'});
 await assert.rejects(c.query("INSERT INTO installation_bindings(id,org_id,installation_id,employee_id,valid_days,reason) VALUES($1,$2,$3,$4,daterange('2026-01-01','2026-01-02','[)'),'test')",[uuid(),other,i,e]),{code:'23503'});
 const union=await c.query("SELECT sum(extract(epoch FROM upper(r)-lower(r)))::text AS seconds FROM (SELECT unnest(range_agg(v)) AS r FROM (VALUES(tstzrange('2026-11-13 01:00Z','2026-11-13 01:10Z','[)')),(tstzrange('2026-11-13 01:05Z','2026-11-13 01:15Z','[)'))) t(v)) s");
 assert.equal(Number(union.rows[0].seconds),900);
 console.log('PostgreSQL 18 migration, tenant foreign keys, exclusion constraint and interval union passed.');
}finally{await db.close();}
