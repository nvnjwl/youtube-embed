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

const readParam = (query: string, key: string) => {
  const searchParams = new URLSearchParams(query);
  const value = searchParams.get(key);
  if (value) {
    return value;
  }
  const match = query.match(new RegExp(`${key}=([^&]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
};

const getEmbedParams = (): EmbedParams => {
  if (typeof window === "undefined") {
    return {};
  }
  const query = window.location.search;
  return {
    videoId: readParam(query, "videoid"),
    userId: readParam(query, "userid"),
    courseId: readParam(query, "courseid"),
    moduleId: readParam(query, "moduleid"),
  };
};

const EmbedApp = () => {
  const { videoId, userId, courseId, moduleId } = getEmbedParams();

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
        fill
        onPlay={() => console.info("play", { userId, courseId, moduleId })}
        onPause={() => console.info("pause", { userId, courseId, moduleId })}
        onEnd={() => console.info("end", { userId, courseId, moduleId })}
        onProgress={(currentTime, duration) =>
          console.info("progress", {
            userId,
            courseId,
            moduleId,
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
