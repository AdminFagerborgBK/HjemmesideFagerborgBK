const encoder = new TextEncoder();
const lifetime = 180 * 24 * 60 * 60;
const hex = bytes => Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
async function signature(value, secret) {
  if (!secret) throw new Error('Newsletter signing is not configured');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(`newsletter-preferences:${value}`))));
}
export async function issueNewsletterToken(memberId, secret, now = Date.now()) {
  const payload = `${memberId}.${Math.floor(now / 1000) + lifetime}`;
  return `${payload}.${await signature(payload, secret)}`;
}
export async function verifyNewsletterToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || !/^[0-9a-f-]{36}\.\d{10}\.[0-9a-f]{64}$/.test(token)) return null;
  const [id, expiry, mac] = token.split('.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) || Number(expiry) <= Math.floor(now / 1000)) return null;
  const expected = await signature(`${id}.${expiry}`, secret);
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ mac.charCodeAt(i);
  return difference === 0 ? id : null;
}