import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type EdutainversePlayerProps = {
  videoId: string;
  autoplay?: boolean;
  startTime?: number;
  endTime?: number;
  muted?: boolean;
  controls?: boolean;
  progressInterval?: number;
  fill?: boolean;
  className?: string;
  onPlay?: () => void;
  onPause?: () => void;
  onEnd?: () => void;
  onSeek?: (time: number) => void;
  onProgress?: (currentTime: number, duration: number) => void;
};

const DEFAULT_PROGRESS_INTERVAL = 5;
const UI_UPDATE_INTERVAL = 250;
const READY_TIMEOUT_MS = 8000;
const SEEK_STEP_SECONDS = 5;
const STORAGE_PREFIX = "edutainverse:yt";

const PLAYER_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
};

type PlayerInfo = {
  currentTime: number;
  duration: number;
  loadedFraction: number;
};

const formatTime = (time: number) => {
  if (!Number.isFinite(time)) {
    return "0:00";
  }
  const clamped = Math.max(0, Math.floor(time));
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const seconds = clamped % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const parseMessage = (payload: unknown) => {
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (typeof payload === "object" && payload !== null) {
    return payload;
  }
  return null;
};

export const EdutainversePlayer: React.FC<EdutainversePlayerProps> = ({
  videoId,
  autoplay = false,
  startTime = 0,
  endTime,
  muted = false,
  controls = true,
  progressInterval = DEFAULT_PROGRESS_INTERVAL,
  fill = false,
  className,
  onPlay,
  onPause,
  onEnd,
  onSeek,
  onProgress,
}) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const playerStateRef = useRef<number>(PLAYER_STATE.UNSTARTED);
  const lastUiUpdateRef = useRef<number>(0);
  const lastProgressRef = useRef<number>(0);
  const readyRef = useRef<boolean>(false);
  const seekingRef = useRef<boolean>(false);
  const initialSeekDoneRef = useRef<boolean>(false);

  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerInfo, setPlayerInfo] = useState<PlayerInfo>({
    currentTime: startTime,
    duration: 0,
    loadedFraction: 0,
  });
  const [deviceKind, setDeviceKind] = useState<"mobile" | "desktop" | "tv">("desktop");
  const [isMuted, setIsMuted] = useState(muted);

  const storageKey = useMemo(() => `${STORAGE_PREFIX}:${videoId}`, [videoId]);

  const postCommand = useCallback((func: string, args: unknown[] = []) => {
    if (!iframeRef.current?.contentWindow) {
      return;
    }
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({
        event: "command",
        func,
        args,
      }),
      "https://www.youtube.com",
    );
  }, []);

  const allowedStart = startTime;
  const allowedEnd = (endTime ?? playerInfo.duration) || undefined;
  const effectiveEnd = (allowedEnd ?? playerInfo.duration) || allowedStart + 1;
  const rangeDuration = Math.max(effectiveEnd - allowedStart, 1);

  const iframeSrc = useMemo(() => {
    const params = new URLSearchParams({
      autoplay: autoplay ? "1" : "0",
      controls: "0",
      modestbranding: "1",
      rel: "0",
      fs: "0",
      disablekb: "1",
      playsinline: "1",
      iv_load_policy: "3",
      enablejsapi: "1",
      start: Math.floor(startTime).toString(),
    });

    if (endTime !== undefined) {
      params.set("end", Math.floor(endTime).toString());
    }

    if (muted) {
      params.set("mute", "1");
    }

    if (typeof window !== "undefined") {
      params.set("origin", window.location.origin);
    }

    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
  }, [autoplay, endTime, muted, startTime, videoId]);

  const updateDeviceKind = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const width = window.innerWidth;
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;
    if (width >= 1280 && isCoarse) {
      setDeviceKind("tv");
    } else if (width < 768) {
      setDeviceKind("mobile");
    } else {
      setDeviceKind("desktop");
    }
  }, []);

  useEffect(() => {
    updateDeviceKind();
    let resizeTimeout: number | undefined;
    const handleResize = () => {
      if (resizeTimeout) {
        window.clearTimeout(resizeTimeout);
      }
      resizeTimeout = window.setTimeout(updateDeviceKind, 150);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimeout) {
        window.clearTimeout(resizeTimeout);
      }
    };
  }, [updateDeviceKind]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const timeout = window.setTimeout(() => {
      if (!readyRef.current) {
        setHasError(true);
      }
    }, READY_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") {
        return;
      }
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }
      const payload = parseMessage(event.data) as any;
      if (!payload) {
        return;
      }

      if (payload.event === "onReady") {
        readyRef.current = true;
        setIsReady(true);
        if (autoplay) {
          postCommand("playVideo");
        }
        if (muted) {
          postCommand("mute");
        }
        postCommand("getDuration");
        postCommand("getCurrentTime");
        postCommand("getVideoLoadedFraction");
      }

      if (payload.event === "onStateChange") {
        const state = Number(payload.info);
        const wasPlaying = playerStateRef.current === PLAYER_STATE.PLAYING;
        playerStateRef.current = state;
        if (state === PLAYER_STATE.PLAYING) {
          setIsPlaying(true);
          if (!wasPlaying) {
            onPlay?.();
          }
        }
        if (state === PLAYER_STATE.PAUSED) {
          setIsPlaying(false);
          if (wasPlaying) {
            onPause?.();
          }
        }
        if (state === PLAYER_STATE.ENDED) {
          setIsPlaying(false);
          onEnd?.();
        }
      }

      if (payload.event === "onError") {
        setHasError(true);
      }

      if (payload.event === "infoDelivery" && payload.info) {
        const { currentTime, duration, videoLoadedFraction } = payload.info;
        setPlayerInfo((prev) => {
          const next: PlayerInfo = {
            currentTime: typeof currentTime === "number" ? currentTime : prev.currentTime,
            duration: typeof duration === "number" ? duration : prev.duration,
            loadedFraction:
              typeof videoLoadedFraction === "number" ? videoLoadedFraction : prev.loadedFraction,
          };
          const now = Date.now();
          const timeDelta = Math.abs(next.currentTime - prev.currentTime);
          const shouldUpdate =
            now - lastUiUpdateRef.current > UI_UPDATE_INTERVAL ||
            timeDelta >= 1 ||
            next.duration !== prev.duration ||
            next.loadedFraction !== prev.loadedFraction;
          if (shouldUpdate) {
            lastUiUpdateRef.current = now;
            return next;
          }
          return prev;
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [autoplay, muted, onEnd, onPause, onPlay, postCommand]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const pollInterval = window.setInterval(() => {
      postCommand("getCurrentTime");
      postCommand("getDuration");
      postCommand("getVideoLoadedFraction");
    }, UI_UPDATE_INTERVAL);

    return () => {
      window.clearInterval(pollInterval);
    };
  }, [isReady, postCommand]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    const heartbeatInterval = window.setInterval(() => {
      if (!readyRef.current) {
        return;
      }
      const now = Date.now();
      if (now - lastProgressRef.current < progressInterval * 1000) {
        return;
      }
      lastProgressRef.current = now;
      onProgress?.(playerInfo.currentTime, playerInfo.duration);
      try {
        const storedValue = JSON.stringify({
          time: playerInfo.currentTime,
          updatedAt: Date.now(),
        });
        window.localStorage.setItem(storageKey, storedValue);
      } catch {
        // Ignore storage errors (private mode or quota limits).
      }
    }, 1000);

    return () => {
      window.clearInterval(heartbeatInterval);
    };
  }, [isReady, onProgress, playerInfo.currentTime, playerInfo.duration, progressInterval, storageKey]);

  useEffect(() => {
    if (!isReady || initialSeekDoneRef.current) {
      return;
    }
    try {
      const storedValue = window.localStorage.getItem(storageKey);
      if (storedValue) {
        const parsed = JSON.parse(storedValue) as { time?: number } | null;
        const resumeTime = parsed?.time ?? 0;
        if (resumeTime > allowedStart + 1 && (!allowedEnd || resumeTime < allowedEnd - 1)) {
          postCommand("seekTo", [resumeTime, true]);
        }
      }
    } catch {
      // Ignore storage errors.
    }
    initialSeekDoneRef.current = true;
  }, [allowedEnd, allowedStart, isReady, postCommand, storageKey]);

  useEffect(() => {
    if (!isReady || seekingRef.current || !allowedEnd) {
      return;
    }
    if (playerInfo.currentTime < allowedStart - 0.5) {
      postCommand("seekTo", [allowedStart, true]);
    }
    if (playerInfo.currentTime > allowedEnd + 0.5) {
      postCommand("seekTo", [allowedEnd, true]);
      postCommand("pauseVideo");
    }
  }, [allowedEnd, allowedStart, isReady, playerInfo.currentTime, postCommand]);

  useEffect(() => {
    if (!isReady) {
      return;
    }
    if (muted) {
      postCommand("mute");
      setIsMuted(true);
    } else {
      postCommand("unMute");
      setIsMuted(false);
    }
  }, [isReady, muted, postCommand]);

  const togglePlay = useCallback(() => {
    if (!isReady) {
      return;
    }
    if (playerStateRef.current === PLAYER_STATE.PLAYING) {
      postCommand("pauseVideo");
    } else {
      postCommand("playVideo");
    }
  }, [isReady, postCommand]);

  const handleSeek = useCallback(
    (time: number) => {
      if (!isReady) {
        return;
      }
      const max = (allowedEnd ?? playerInfo.duration) || time;
      const nextTime = clamp(time, allowedStart, max);
      onSeek?.(nextTime);
      postCommand("seekTo", [nextTime, true]);
    },
    [allowedEnd, allowedStart, isReady, onSeek, playerInfo.duration, postCommand],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        togglePlay();
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleSeek(playerInfo.currentTime + SEEK_STEP_SECONDS);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handleSeek(playerInfo.currentTime - SEEK_STEP_SECONDS);
      }
    },
    [handleSeek, playerInfo.currentTime, togglePlay],
  );

  const progressPercentage = clamp(
    ((playerInfo.currentTime - allowedStart) / rangeDuration) * 100,
    0,
    100,
  );
  const bufferedTime = playerInfo.loadedFraction * playerInfo.duration;
  const bufferedPercentage = clamp(
    ((Math.min(bufferedTime, effectiveEnd) - allowedStart) / rangeDuration) * 100,
    0,
    100,
  );

  const shouldShowControls = controls && showControls;
  const controlHeight =
    deviceKind === "mobile" ? "h-16" : deviceKind === "tv" ? "h-20" : "h-14";
  const timeTextSize =
    deviceKind === "mobile" ? "text-base" : deviceKind === "tv" ? "text-lg" : "text-sm";
  const iconSize = deviceKind === "tv" ? "h-7 w-7" : deviceKind === "mobile" ? "h-6 w-6" : "h-5 w-5";

  useEffect(() => {
    if (!controls) {
      return;
    }
    let hideTimeout: number | undefined;
    const scheduleHide = () => {
      if (hideTimeout) {
        window.clearTimeout(hideTimeout);
      }
      const timeout = deviceKind === "mobile" ? 2000 : deviceKind === "tv" ? 5000 : 3500;
      hideTimeout = window.setTimeout(() => setShowControls(false), timeout);
    };

    const handleActivity = () => {
      setShowControls(true);
      scheduleHide();
    };

    scheduleHide();
    const container = iframeRef.current?.parentElement;
    container?.addEventListener("mousemove", handleActivity);
    container?.addEventListener("touchstart", handleActivity);
    container?.addEventListener("keydown", handleActivity as EventListener);

    return () => {
      container?.removeEventListener("mousemove", handleActivity);
      container?.removeEventListener("touchstart", handleActivity);
      container?.removeEventListener("keydown", handleActivity as EventListener);
      if (hideTimeout) {
        window.clearTimeout(hideTimeout);
      }
    };
  }, [controls, deviceKind]);

  const handleFullscreen = useCallback(() => {
    const container = iframeRef.current?.parentElement;
    if (!container) {
      return;
    }
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined);
    } else {
      container.requestFullscreen().catch(() => undefined);
    }
  }, []);

  return (
    <div
      className={`relative w-full ${fill ? "h-full" : "aspect-video"} bg-black text-white ${
        className ?? ""
      }`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Edutainverse YouTube player"
    >
      <iframe
        ref={iframeRef}
        className="absolute inset-0 h-full w-full"
        src={iframeSrc}
        title="Edutainverse player"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />

      {!isReady && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-center px-6">
          <div className="max-w-md">
            <p className="text-lg font-semibold">Loading video</p>
            <p className="mt-2 text-sm text-white/80">Preparing your lesson player.</p>
          </div>
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-center px-6">
          <div className="max-w-md">
            <p className="text-lg font-semibold">Video unavailable</p>
            <p className="mt-2 text-sm text-white/80">
              We couldn&apos;t load this YouTube embed. Please check the connection or try another video.
            </p>
          </div>
        </div>
      )}

      {controls && (
        <div
          className={`absolute inset-x-0 bottom-0 transition-opacity duration-200 ${
            shouldShowControls ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className={`bg-black/70 backdrop-blur-sm ${controlHeight} px-4 md:px-6 flex items-center gap-3`}>
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" className={iconSize} aria-hidden="true" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className={iconSize} aria-hidden="true" fill="currentColor">
                  <path d="M8 5.5a1 1 0 0 1 1.5-.86l10 6.5a1 1 0 0 1 0 1.72l-10 6.5A1 1 0 0 1 8 18.5v-13z" />
                </svg>
              )}
            </button>

            <span className={`${timeTextSize} tabular-nums`} aria-label="Current time">
              {formatTime(playerInfo.currentTime)}
            </span>

            <div className="flex-1">
              <div className="relative h-3 md:h-2.5">
                <input
                  type="range"
                  min={allowedStart}
                  max={effectiveEnd}
                  step={0.1}
                  value={playerInfo.currentTime}
                  onChange={(event) => {
                    seekingRef.current = true;
                    handleSeek(Number(event.target.value));
                  }}
                  onMouseUp={() => {
                    seekingRef.current = false;
                  }}
                  onTouchEnd={() => {
                    seekingRef.current = false;
                  }}
                  className="absolute inset-0 h-full w-full appearance-none bg-transparent cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, rgba(255,255,255,0.95) ${progressPercentage}%, rgba(255,255,255,0.55) ${progressPercentage}%, rgba(255,255,255,0.55) ${bufferedPercentage}%, rgba(255,255,255,0.2) ${bufferedPercentage}%)`,
                  }}
                  aria-label="Seek"
                />
              </div>
            </div>

            <span className={`${timeTextSize} tabular-nums`} aria-label="Total duration">
              {formatTime(allowedEnd ?? playerInfo.duration)}
            </span>

            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isMuted) {
                    postCommand("unMute");
                    setIsMuted(false);
                  } else {
                    postCommand("mute");
                    setIsMuted(true);
                  }
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
                aria-label="Volume"
              >
                <svg viewBox="0 0 24 24" className={iconSize} aria-hidden="true" fill="currentColor">
                  <path d="M5 9v6h4l5 4V5L9 9H5z" />
                  {!isMuted && (
                    <path d="M16 8a1 1 0 0 1 1.5-.87 6 6 0 0 1 0 9.74A1 1 0 0 1 16 15a4 4 0 0 0 0-7z" />
                  )}
                </svg>
              </button>
            </div>

            <button
              type="button"
              className="hidden md:flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              aria-label="Settings"
            >
              <svg viewBox="0 0 24 24" className={iconSize} aria-hidden="true" fill="currentColor">
                <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5zm8.5 3.5a6.5 6.5 0 0 0-.1-1l2-1.5-2-3.5-2.3.7a6.4 6.4 0 0 0-1.7-1l-.3-2.4H9.9L9.6 5.7c-.6.2-1.2.5-1.7 1L5.6 6 3.6 9.5l2 1.5a6.5 6.5 0 0 0 0 2l-2 1.5 2 3.5 2.3-.7c.5.4 1.1.7 1.7 1l.3 2.4h4.2l.3-2.4c.6-.2 1.2-.5 1.7-1l2.3.7 2-3.5-2-1.5c.1-.3.1-.7.1-1z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={handleFullscreen}
              className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
              aria-label="Fullscreen"
            >
              <svg viewBox="0 0 24 24" className={iconSize} aria-hidden="true" fill="currentColor">
                <path d="M7 3H3v4h2V5h2V3zm14 0h-4v2h2v2h2V3zM7 21H3v-4h2v2h2v2zm14-4h-2v2h-2v2h4v-4z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
