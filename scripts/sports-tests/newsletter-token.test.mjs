import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueNewsletterToken, verifyNewsletterToken } from '../../supabase/functions/_shared/newsletterToken.mjs';
const id = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const secret = 'controlled-test-signing-key-not-a-production-secret';
test('signed preference token authorizes only its own member', async () => {
  const token = await issueNewsletterToken(id, secret, 1792677600000);
  assert.equal(await verifyNewsletterToken(token, secret, 1792677600000), id);
  assert.equal(await verifyNewsletterToken(token.replace(id, other), secret, 1792677600000), null);
});
test('expired, invalid and differently signed newsletter tokens are rejected', async () => {
  const token = await issueNewsletterToken(id, secret, 1792677600000);
  assert.equal(await verifyNewsletterToken(token, secret, 1792677600000 + 180 * 86400000), null);
  assert.equal(await verifyNewsletterToken(token, secret + 'changed', 1792677600000), null);
  assert.equal(await verifyNewsletterToken('member-id-and-email', secret), null);
});