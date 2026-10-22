// Schema-only replay: managed scheduling, HTTP and cryptographic functions are INERT TEST STUBS.
// Never use this baseline for production or security/crypto validation.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs'; import path from 'node:path';
const root=process.cwd(); const db=new PGlite();
const files=(dir)=>fs.readdirSync(path.join(root,dir)).filter(x=>x.endsWith('.sql')).sort().map(x=>[`${dir}/${x}`,fs.readFileSync(path.join(root,dir,x),'utf8')]);
const skipped=[];
async function go(sql,label){try{await db.exec(sql)}catch(e){throw Error(`${label}: ${e.message}\n${sql.slice(0,450)}`)}}
await go(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA extensions; CREATE SCHEMA cron; CREATE SCHEMA net;
CREATE TABLE auth.users(id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
CREATE TABLE storage.buckets(id text primary key, name text, public boolean default false);
CREATE TABLE storage.objects(id uuid default gen_random_uuid(), bucket_id text, name text);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT null::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT null::text $$;
CREATE FUNCTION net.http_post(url text, headers jsonb default '{}', body jsonb default '{}') RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
CREATE TABLE cron.job(jobid serial primary key, jobname text, schedule text, command text);
CREATE FUNCTION cron.schedule(jobname text, schedule text, command text) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
CREATE FUNCTION cron.schedule(text,text) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
CREATE FUNCTION cron.unschedule(text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE FUNCTION cron.alter_job(bigint, command text) RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE FUNCTION extensions.crypt(text,text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT $1 $$; CREATE FUNCTION extensions.gen_salt(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'stub' $$; CREATE FUNCTION extensions.gen_random_bytes(integer) RETURNS bytea LANGUAGE sql VOLATILE AS $$ SELECT decode(repeat('01',$1),'hex') $$; CREATE FUNCTION extensions.digest(bytea,text) RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT $1 $$; CREATE FUNCTION extensions.digest(text,text) RETURNS bytea LANGUAGE sql IMMUTABLE AS $$ SELECT convert_to($1,'UTF8') $$;`,'baseline stubs');
const migrate=async (dir)=>{for(const [name,src] of files(dir)){
let sql=src.replace(/^\s*CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?pg_(?:cron|net)\b[^;]*;/gim,m=>{skipped.push(`${name}: skipped ${m.trim()}`);return ''}).replace(/^\s*CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?pgcrypto\b[^;]*;/gim,m=>{skipped.push(`${name}: pgcrypto schema-only stub, not crypto verification`);return '';});
// do not invoke external schedulers: turn direct cron scheduling/alter/unschedule calls into inert selects
sql=sql.replace(/cron\.(schedule|unschedule|alter_job)\s*\(/gi,(m,fn)=>{skipped.push(`${name}: cron.${fn} call neutralized`);return `cron.${fn}(`});
try{await db.exec(sql)}catch(e){console.log(`FAIL ${name}: ${e.message}`);throw e}
console.log('OK',name)
}};
await migrate('supabase/migrations'); await migrate('drizzle/migrations');
await go(fs.readFileSync(path.join(root,'scripts/setup/sports-season-seed.sql'),'utf8'),'sports seed');
console.log('REPLAY OK');
console.log('SKIPS',JSON.stringify(skipped,null,2));
console.log('TABLES',JSON.stringify((await db.query("select schemaname,tablename from pg_tables where schemaname not in ('pg_catalog','information_schema') order by 1,2")).rows,null,2));

await db.close();
