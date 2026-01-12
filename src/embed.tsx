import React from "react";
import ReactDOM from "react-dom/client";
import { EdutainversePlayer } from "./components/EdutainversePlayer";
import "./index.css";
import { getEmbedParams } from "./utils/embedParams";

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
