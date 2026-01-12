import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom/client";
import { EdutainversePlayer } from "./components/EdutainversePlayer";
import "./index.css";
import { getEmbedParams } from "./utils/embedParams";

type LogEntry = {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
};

const DEFAULT_VIDEO_ID = "LMDujnLiq_k";

const formatTimestamp = () => new Date().toISOString();

const DebugApp = () => {
  const { videoId, userId, courseId, moduleId } = getEmbedParams();
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const analyticsContext = useMemo(
    () => ({
      userId: userId ?? "anonymous",
      courseId: courseId ?? "unknown-course",
      moduleId: moduleId ?? "unknown-module",
    }),
    [courseId, moduleId, userId],
  );

  const appendLog = useCallback((entry: Omit<LogEntry, "id" | "timestamp">) => {
    setLogs((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: formatTimestamp(),
        ...entry,
      },
      ...prev,
    ]);
  }, []);

  useEffect(() => {
    appendLog({
      level: "info",
      message: `Debug session started. videoid=${videoId ?? "(missing)"}`,
    });
  }, [appendLog, videoId]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== "https://www.youtube.com") {
        return;
      }
      const payload = typeof event.data === "string" ? event.data : JSON.stringify(event.data ?? {});
      appendLog({ level: "info", message: `YT postMessage: ${payload}` });
    };

    const handleError = (event: ErrorEvent) => {
      appendLog({ level: "error", message: `Window error: ${event.message}` });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason ? JSON.stringify(event.reason) : "(unknown)";
      appendLog({ level: "error", message: `Unhandled rejection: ${reason}` });
    };

    window.addEventListener("message", handleMessage);
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("message", handleMessage);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [appendLog]);

  const resolvedVideoId = videoId ?? DEFAULT_VIDEO_ID;

  return (
    <div className="flex h-screen w-screen bg-black text-white">
      <div className="flex w-4/5 items-center justify-center bg-black">
        <EdutainversePlayer
          videoId={resolvedVideoId}
          autoplay={false}
          muted={false}
          controls={false}
          nativeControls
          fill
          onPlay={() => appendLog({ level: "info", message: `play ${JSON.stringify(analyticsContext)}` })}
          onPause={() => appendLog({ level: "info", message: `pause ${JSON.stringify(analyticsContext)}` })}
          onEnd={() => appendLog({ level: "info", message: `end ${JSON.stringify(analyticsContext)}` })}
          onProgress={(currentTime, duration) =>
            appendLog({
              level: "info",
              message: `progress ${Math.round(currentTime)}/${Math.round(duration)} ${JSON.stringify(analyticsContext)}`,
            })
          }
        />
      </div>

      <aside className="flex w-1/5 flex-col border-l border-white/10 bg-neutral-950">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Debug Console</p>
            <p className="text-xs text-white/50">Verbose player + iframe logs</p>
            {!videoId && <p className="text-xs text-yellow-400">Missing videoid, using default.</p>}
          </div>
          <button
            type="button"
            onClick={() => setLogs([])}
            className="rounded-md border border-white/20 px-2 py-1 text-xs text-white/80 hover:border-white/40"
          >
            Clear
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {logs.length === 0 ? (
            <p className="text-xs text-white/50">No logs yet.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {logs.map((log) => (
                <li key={log.id} className="rounded-md border border-white/10 bg-white/5 p-2">
                  <div className="flex items-center justify-between text-[10px] text-white/50">
                    <span>{log.timestamp}</span>
                    <span className="uppercase">{log.level}</span>
                  </div>
                  <p className="mt-1 break-words font-mono text-white/80">{log.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DebugApp />
  </React.StrictMode>,
);
