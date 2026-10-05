'use client';

import { useRef, useState } from 'react';
import { Play } from 'lucide-react';

// Click-to-play rather than autoplay: this is a narrated ~55s promo (real
// audio, not silent b-roll), so autoplaying it muted would mute the point of
// it, and browsers block unmuted autoplay anyway. Native `controls` only
// show up once playback starts -- before that, the poster frame plus the
// custom play button is the entire UI, matching how a tidy video card looks
// at rest instead of exposing a scrubber for a video that hasn't started.
export function ReelPlayer({ className }: { className?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const handlePlay = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    void video.play();
    setPlaying(true);
  };

  return (
    <div className={className}>
      <video
        className="h-full w-full object-cover"
        controls={playing}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
        playsInline
        poster="/videos/app-preview-reel-poster.jpg"
        ref={videoRef}
      >
        <source src="/videos/app-preview-reel.mp4" type="video/mp4" />
      </video>
      {!playing ? (
        <button
          aria-label="Play the eLLVate promo video"
          className="group absolute inset-0 flex items-center justify-center bg-ink/15 transition hover:bg-ink/25"
          onClick={handlePlay}
          type="button"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-xl transition group-hover:scale-105">
            <Play className="h-6 w-6 translate-x-0.5 text-ink" fill="currentColor" />
          </span>
        </button>
      ) : null}
    </div>
  );
}
