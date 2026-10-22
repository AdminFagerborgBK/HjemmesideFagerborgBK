export const CACHE_MS = 6 * 60 * 60 * 1000;
export const ACCOUNT = 'fagerborg_bk';
export function retryDelay(failures: number, authorization = false) {
  return authorization ? CACHE_MS : Math.min(CACHE_MS, 15 * 60 * 1000 * 2 ** Math.max(0, failures - 1));
}
export function normalizePosts(items: Record<string, unknown>[]) {
  return [...items].sort((a, b) => Date.parse(String(b.timestamp)) - Date.parse(String(a.timestamp))).slice(0, 3).map(item => {
    const image = item.media_type === 'VIDEO' ? item.thumbnail_url : item.media_url;
    const link = String(item.permalink ?? '');
    if (typeof image !== 'string' || !image.startsWith('https://') || !/^https:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//.test(link)) throw new Error('Instagram returnerte ufullstendig innhold');
    const caption = String(item.caption || 'Fra @fagerborg_bk').replace(/\s+/g, ' ').trim();
    return { id: String(item.id), title: caption.slice(0, 120), alt_text: caption.slice(0, 200), image_url: image, instagram_url: link, is_video: item.media_type === 'VIDEO', focus_x: 50, focus_y: 50 };
  });
}
