import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
test('invoice claims allow one worker and never replay ambiguous or sent states',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE TABLE public.goal_club_invoices(id uuid PRIMARY KEY,email_state text,email_error text);`);
 await db.exec(readFileSync('drizzle/migrations/0019_goal_club_atomic_invoice_claim.sql','utf8'));
 const id='11111111-1111-4111-8111-111111111111';
 await db.query('INSERT INTO goal_club_invoices VALUES($1,$2,$3,null)',[id,'pending',null]);
 const results=await Promise.all([db.query('SELECT * FROM claim_goal_club_invoice($1)',[id]),db.query('SELECT * FROM claim_goal_club_invoice($1)',[id])]);
 assert.equal(results.reduce((n,r)=>n+r.rows.length,0),1);
 for(const state of ['sending','uncertain','sent']){
 await db.query('UPDATE goal_club_invoices SET email_state=$1 WHERE id=$2',[state,id]);
 assert.equal((await db.query('SELECT * FROM claim_goal_club_invoice($1)',[id])).rows.length,0);
 }
 await db.query('UPDATE goal_club_invoices SET email_state=$1 WHERE id=$2',['failed',id]);
 assert.equal((await db.query('SELECT * FROM claim_goal_club_invoice($1)',[id])).rows.length,1);
 assert.equal((await db.query("SELECT has_function_privilege('authenticated','claim_goal_club_invoice(uuid)','EXECUTE') AS allowed")).rows[0].allowed,false);
 }finally{await db.close();}
});