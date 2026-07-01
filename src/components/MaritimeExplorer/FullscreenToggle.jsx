import { useCallback, useEffect, useState } from 'react';

export default function FullscreenToggle({ targetRef }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === targetRef.current);
      requestAnimationFrame(() => {
        window.dispatchEvent(new Event('maritime-explorer-resize'));
      });
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [targetRef]);

  const toggleFullscreen = useCallback(async () => {
    const el = targetRef.current;
    if (!el) return;

    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      // Browser may block fullscreen without user gesture or unsupported API.
    }
  }, [targetRef]);

  return (
    <button
      type="button"
      onClick={toggleFullscreen}
      className="maritime-hud-interactive absolute right-3 top-14 z-20 flex items-center gap-1.5 rounded-lg border border-slate-600/80 bg-slate-950/75 px-2.5 py-1.5 text-xs font-medium text-slate-200 backdrop-blur-sm transition hover:border-pacificCyan/50 hover:text-white"
      aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
    >
      <span aria-hidden="true">{isFullscreen ? '⤡' : '⤢'}</span>
      {isFullscreen ? 'Exit' : 'Fullscreen'}
    </button>
  );
}
