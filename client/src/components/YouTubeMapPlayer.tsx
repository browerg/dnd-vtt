import { useEffect, useRef } from "react";

interface YouTubePlayerApi {
  destroy(): void;
  mute(): void;
  unMute(): void;
  setVolume(volume: number): void;
  playVideo(): void;
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      width: number;
      height: number;
      videoId: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: (event: { target: YouTubePlayerApi }) => void;
        onStateChange?: (event: { data: number; target: YouTubePlayerApi }) => void;
      };
    }
  ) => YouTubePlayerApi;
  PlayerState: { ENDED: number };
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT) resolve(window.YT);
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return apiPromise;
}

interface Props {
  videoId: string;
  title: string;
  soundEnabled: boolean;
  volume: number;
}

export default function YouTubeMapPlayer({
  videoId,
  title,
  soundEnabled,
  volume,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerApi | null>(null);
  const soundRef = useRef(soundEnabled);
  const volumeRef = useRef(volume);

  soundRef.current = soundEnabled;
  volumeRef.current = volume;

  const applyAudioState = (player: YouTubePlayerApi) => {
    const shouldMute = !soundRef.current || volumeRef.current <= 0;
    if (shouldMute) {
      player.setVolume(0);
      player.mute();
      window.setTimeout(() => {
        player.setVolume(0);
        player.mute();
      }, 60);
      window.setTimeout(() => {
        player.setVolume(0);
        player.mute();
      }, 250);
      return;
    }
    player.setVolume(Math.round(volumeRef.current * 100));
    player.unMute();
  };

  useEffect(() => {
    let cancelled = false;
    let player: YouTubePlayerApi | null = null;

    void loadYouTubeApi().then((YT) => {
      if (cancelled || !mountRef.current) return;

      player = new YT.Player(mountRef.current, {
        width: 1920,
        height: 1080,
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          loop: 1,
          playlist: videoId,
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          disablekb: 1,
          fs: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: ({ target }) => {
            playerRef.current = target;
            applyAudioState(target);
            target.playVideo();
          },
          onStateChange: ({ data, target }) => {
            applyAudioState(target);
            if (data === YT.PlayerState.ENDED) target.playVideo();
          },
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current = null;
      player?.destroy();
    };
  }, [videoId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    applyAudioState(player);
    if (soundEnabled && volume > 0) player.playVideo();
  }, [soundEnabled, volume]);

  return (
    <div className="yt-stage stable-youtube-stage" style={{ width: 1920, height: 1080 }}>
      <div ref={mountRef} title={title} />
    </div>
  );
}
