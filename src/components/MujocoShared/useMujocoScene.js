import { useEffect, useRef, useState } from 'react';
import { getMujoco } from './mujocoLoader.js';
import { MujocoThreeView } from './mujocoThreeView.js';

/**
 * Loads MuJoCo, creates a simulation with `createSim(mujoco)`, and renders its
 * model into `containerRef` with a MujocoThreeView. `onFrame(dt, sim, view)` runs
 * every animation frame (advance the physics there); the view is synced and
 * drawn afterwards. Physics and rendering pause while the canvas is off-screen.
 *
 * The sim must expose `model`, `data` and `dispose()`.
 */
export function useMujocoScene(containerRef, createSim, viewOptions, onFrame) {
  const simRef = useRef(null);
  const viewRef = useRef(null);
  const onFrameRef = useRef(onFrame);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');

  onFrameRef.current = onFrame;

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let visible = true;
    const container = containerRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    observer.observe(container);

    getMujoco()
      .then((mujoco) => {
        if (cancelled) return;
        const sim = createSim(mujoco);
        const view = new MujocoThreeView(container, sim.model, viewOptions);
        view.sync(sim.data);
        simRef.current = sim;
        viewRef.current = view;
        setStatus('ready');

        let last = performance.now();
        const loop = (now) => {
          const dt = Math.min((now - last) / 1000, 0.05);
          last = now;
          if (visible) {
            onFrameRef.current?.(dt, sim, view);
            view.sync(sim.data);
            view.render();
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(String(err?.message ?? err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      viewRef.current?.dispose();
      simRef.current?.dispose();
      viewRef.current = null;
      simRef.current = null;
    };
    // createSim / viewOptions are fixed for the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { status, error, simRef, viewRef };
}
