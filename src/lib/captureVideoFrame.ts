/**
 * Capture a natural-looking still frame from a video file (like a YouTube
 * auto-thumbnail). Grabs a frame a bit into the clip so we avoid black
 * intro frames, and returns it as a JPEG File ready for upload.
 */
export async function captureVideoFrame(
  file: File,
  { fraction = 0.15, minSeconds = 2, maxSeconds = 20 } = {}
): Promise<File | null> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  video.src = objectUrl;

  const cleanup = () => {
    URL.revokeObjectURL(objectUrl);
    video.removeAttribute('src');
  };

  try {
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('metadata timeout')), 20000);
      video.onloadedmetadata = () => { clearTimeout(t); resolve(); };
      video.onerror = () => { clearTimeout(t); reject(new Error('video load error')); };
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const target = duration
      ? Math.min(Math.max(duration * fraction, minSeconds), Math.max(maxSeconds, duration * 0.2), Math.max(duration - 0.2, 0.1))
      : minSeconds;

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('seek timeout')), 20000);
      video.onseeked = () => { clearTimeout(t); resolve(); };
      video.currentTime = target;
    });

    // Give the decoder a moment so we don't grab an empty frame
    await new Promise((r) => setTimeout(r, 120));

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;

    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88)
    );
    if (!blob) return null;

    return new File([blob], `thumb-${Date.now()}.jpg`, { type: 'image/jpeg' });
  } catch (err) {
    console.error('captureVideoFrame failed:', err);
    return null;
  } finally {
    cleanup();
  }
}
