import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deliverRecorded} from '../../supabase/functions/send-newsletter/delivery.mjs';
test('failed intent persistence never contacts email provider',async()=>{
  let calls=0;
  await assert.rejects(deliverRecorded({recordIntent:async()=>{throw new Error('db down');},send:async()=>{calls++;},recordOutcome:async()=>{}}));
  assert.equal(calls,0);
});
test('provider success with failed outcome persistence leaves durable pending intent',async()=>{
  const rows=[];
  await assert.rejects(deliverRecorded({recordIntent:async()=>{rows.push({id:1,status:'pending'});return 1;},send:async()=>({id:'accepted-123'}),recordOutcome:async()=>{throw new Error('db down');}}));
  assert.deepEqual(rows,[{id:1,status:'pending'}]);
});
test('successful delivery retains provider outcome on recorded recipient',async()=>{
  const row={status:'pending',provider:null};
  await deliverRecorded({recordIntent:async()=>row,send:async()=>({id:'accepted-123'}),recordOutcome:async(r,v)=>{r.status='sent';r.provider=v.id;}});
  assert.deepEqual(row,{status:'sent',provider:'accepted-123'});
});