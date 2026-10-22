/**
 * Shows a real frame from the video itself as the cover image (similar to how
 * YouTube picks a frame), used for uploaded video files with no explicit
 * thumbnail. Loads only metadata, so it is cheap.
 */
const VideoFrameThumb = ({ url, className = '' }: { url: string; className?: string }) => {
  const src = url.includes('#t=') ? url : `${url}#t=3`;
  return (
    <video
      src={src}
      preload="metadata"
      muted
      playsInline
      tabIndex={-1}
      className={`w-full h-full object-cover pointer-events-none ${className}`}
    />
  );
};

export default VideoFrameThumb;
