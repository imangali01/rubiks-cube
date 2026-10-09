const easeInOut = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2; // sine: без рывков на старте и финише

export function tween(ms: number, onFrame: (t: number) => void): Promise<void> {
  if (ms <= 0) {
    onFrame(1);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      onFrame(easeInOut(k));
      if (k < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}
