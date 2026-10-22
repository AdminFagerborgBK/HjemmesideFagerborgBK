/** Shared helpers for detecting and normalizing video URLs. */
export const isEmbeddableVideo = (url: string | null) => {
  if (!url) return false;
  return /youtube\.com|youtu\.be|vimeo\.com|supabase\.co|\/__l5e\/assets-v1\/|\/videos\//i.test(url) && !/veo\.co/i.test(url);
};

export const isDirectVideoFile = (url: string) =>
  /\.(mp4|mov|webm|m4v|ogg)(\?|$)/i.test(url) ||
  /\/storage\/v1\/object\/public\//i.test(url) ||
  /\/__l5e\/assets-v1\//i.test(url) ||
  /\/videos\//i.test(url);

export const getVideoEmbedUrl = (url: string) => {
  const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
  if (youtubeMatch) return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  const ytLive = url.match(/youtube\.com\/live\/([a-zA-Z0-9_-]+)/);
  if (ytLive) return `https://www.youtube.com/embed/${ytLive[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return url;
};