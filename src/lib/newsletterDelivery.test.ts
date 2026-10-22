import {it,expect} from 'vitest';
import {deliveryOutcome,assertTestRecipient} from '../../supabase/functions/send-newsletter/policy';
it('provider failure never reports full success',()=>{
  expect(deliveryOutcome(4,1)).toEqual({success:false,status:'partial',sent_count:4,failed_count:1});
});
it('test sends only to the signed-in admin, never a real recipient list',()=>{
  expect(assertTestRecipient('admin@example.test')).toEqual(['admin@example.test']);
  expect(()=>assertTestRecipient(undefined)).toThrow();
});