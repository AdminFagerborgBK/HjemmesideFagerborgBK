// Client-side .mov → browser-safe .mp4 conversion using ffmpeg.wasm (lazy-loaded).
// Important: many phone .mov files contain HEVC/H.265. Renaming/remuxing those to
// .mp4 still gives black video in Chrome/Firefox, so we transcode to H.264 + AAC.

let ffmpegInstance: any | null = null;

async function getFfmpeg() {
  if (ffmpegInstance) return ffmpegInstance;
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { toBlobURL } = await import('@ffmpeg/util');
  const ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

export async function convertMovToMp4(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<File> {
  const { fetchFile } = await import('@ffmpeg/util');
  const ffmpeg = await getFfmpeg();

  const progressHandler = ({ progress }: { progress: number }) => {
    if (onProgress) onProgress(Math.max(0, Math.min(1, progress)));
  };
  ffmpeg.on('progress', progressHandler);

  try {
    await ffmpeg.writeFile('input.mov', await fetchFile(file));
    // Transcode to web-compatible H.264 video + AAC audio.
    // faststart moves the moov atom to the front for better streaming playback.
    await ffmpeg.exec([
      '-i', 'input.mov',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-profile:v', 'high',
      '-level', '4.1',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      'output.mp4',
    ]);
    const data = (await ffmpeg.readFile('output.mp4')) as Uint8Array;
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const newName = file.name.replace(/\.mov$/i, '.mp4');
    return new File([buffer], newName, { type: 'video/mp4' });
  } finally {
    ffmpeg.off('progress', progressHandler);
    try { await ffmpeg.deleteFile('input.mov'); } catch {}
    try { await ffmpeg.deleteFile('output.mp4'); } catch {}
  }
}

export function isMovFile(file: File): boolean {
  return /\.mov$/i.test(file.name) || file.type === 'video/quicktime';
}