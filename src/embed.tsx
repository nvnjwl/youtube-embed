import React from "react";
import ReactDOM from "react-dom/client";
import { EdutainversePlayer } from "./components/EdutainversePlayer";
import "./index.css";

type EmbedParams = {
  videoId?: string;
  userId?: string;
  courseId?: string;
  moduleId?: string;
};

const QUERY_KEYS = ["videoid", "userid", "courseid", "moduleid"] as const;

const parseEmbedParams = (query: string): EmbedParams => {
  const params: EmbedParams = {};
  const normalizedQuery = query.startsWith("?") ? query.slice(1) : query;
  const pattern = new RegExp(`(?:^|&)?(${QUERY_KEYS.join("|")})=`, "gi");
  const matches = [...normalizedQuery.matchAll(pattern)];

  matches.forEach((match, index) => {
    const key = match[1]?.toLowerCase() as (typeof QUERY_KEYS)[number] | undefined;
    if (!key) {
      return;
    }
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? normalizedQuery.length : normalizedQuery.length;
    const rawValue = normalizedQuery.slice(start, end).replace(/^&/, "").replace(/&$/, "");
    const value = rawValue ? decodeURIComponent(rawValue) : undefined;
    if (!value) {
      return;
    }
    if (key === "videoid") {
      params.videoId = value;
    }
    if (key === "userid") {
      params.userId = value;
    }
    if (key === "courseid") {
      params.courseId = value;
    }
    if (key === "moduleid") {
      params.moduleId = value;
    }
  });

  return params;
};

const getEmbedParams = (): EmbedParams => {
  if (typeof window === "undefined") {
    return {};
  }
  return parseEmbedParams(window.location.search);
};

const EmbedApp = () => {
  const { videoId, userId, courseId, moduleId } = getEmbedParams();
  const analyticsContext = {
    userId: userId ?? "anonymous",
    courseId: courseId ?? "unknown-course",
    moduleId: moduleId ?? "unknown-module",
  };

  if (!videoId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-black text-white">
        <div className="text-center">
          <p className="text-xl font-semibold">Video unavailable</p>
          <p className="mt-2 text-sm text-white/70">Missing videoid query parameter.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black">
      <EdutainversePlayer
        videoId={videoId}
        autoplay={false}
        muted={false}
        controls={false}
        nativeControls
        fill
        onPlay={() => console.info("play", analyticsContext)}
        onPause={() => console.info("pause", analyticsContext)}
        onEnd={() => console.info("end", analyticsContext)}
        onProgress={(currentTime, duration) =>
          console.info("progress", {
            ...analyticsContext,
            currentTime: Math.round(currentTime),
            duration: Math.round(duration),
          })
        }
      />
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <EmbedApp />
  </React.StrictMode>,
);
