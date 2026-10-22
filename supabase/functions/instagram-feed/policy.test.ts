import { assertEquals, assertThrows } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { CACHE_MS, normalizePosts, retryDelay } from './policy.ts';
Deno.test('cache lifetime is six hours', () => assertEquals(CACHE_MS, 21600000));
Deno.test('failure backoff starts at 15 minutes and caps at six hours', () => { assertEquals(retryDelay(1), 900000); assertEquals(retryDelay(9), 21600000); assertEquals(retryDelay(1, true), 21600000); });
Deno.test('only three latest media with Reel thumbnails and original links', () => {
 const posts = normalizePosts([1,4,2,3].map(n => ({ id: `${n}`, timestamp: `2026-10-0${n}T12:00:00Z`, media_type: n === 4 ? 'VIDEO' : 'IMAGE', thumbnail_url: 'https://example.com/thumb', media_url: 'https://example.com/image', permalink: `https://www.instagram.com/p/post${n}/` })));
 assertEquals(posts.map(p => p.id), ['4','3','2']); assertEquals(posts[0].image_url, 'https://example.com/thumb'); assertEquals(posts[0].instagram_url, 'https://www.instagram.com/p/post4/');
});
Deno.test('invalid media never replaces valid feed', () => { assertThrows(() => normalizePosts([{ id: '1', permalink: 'https://evil.example/' }])); });
