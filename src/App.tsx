import { EdutainversePlayer } from "./components/EdutainversePlayer";

const DEFAULT_VIDEO_ID = "dQw4w9WgXcQ";

const App = () => {
  const videoId = import.meta.env.VITE_YOUTUBE_VIDEO_ID || DEFAULT_VIDEO_ID;

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edutainverse Player</h1>
          <p className="text-sm text-white/70">Distraction-free YouTube lessons.</p>
        </div>
        <div className="text-xs text-white/50">iframe + custom controls</div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-12">
        <div className="rounded-2xl border border-white/10 bg-black/60 p-4 md:p-6">
          <EdutainversePlayer
            videoId={videoId}
            autoplay={false}
            startTime={10}
            endTime={300}
            muted={false}
            controls
            progressInterval={5}
            onPlay={() => console.info("play")}
            onPause={() => console.info("pause")}
            onSeek={(time) => console.info("seek", time)}
            onEnd={() => console.info("end")}
            onProgress={(current, duration) =>
              console.info("progress", { current: Math.round(current), duration: Math.round(duration) })
            }
          />
        </div>

        <section className="mt-8 grid gap-4 text-sm text-white/70 md:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-base font-semibold text-white">Lesson Range</h2>
            <p className="mt-2">Seeking is bounded to the lesson window for focused viewing.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-base font-semibold text-white">Analytics Hooks</h2>
            <p className="mt-2">Play, pause, seek, and progress events are ready for your SDK.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <h2 className="text-base font-semibold text-white">TV Ready</h2>
            <p className="mt-2">Large targets, keyboard support, and calm overlays for distance viewing.</p>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
