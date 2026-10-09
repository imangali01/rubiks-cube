export type P = [number, number];

const mod = (i: number, n: number) => ((i % n) + n) % n;
const lerp = (a: P, b: P, ta: number, tb: number, t: number): P => {
  const w = (t - ta) / (tb - ta);
  return [a[0] * (1 - w) + b[0] * w, a[1] * (1 - w) + b[1] * w];
};
const dist = (a: P, b: P) => Math.sqrt(Math.hypot(a[0] - b[0], a[1] - b[1]));

// Центростремительный Catmull-Rom (Barry-Goldman): без петель и перелётов при неравных расстояниях.
function segment(p0: P, p1: P, p2: P, p3: P, f: number): P {
  const t0 = 0;
  const t1 = t0 + dist(p0, p1);
  const t2 = t1 + dist(p1, p2);
  const t3 = t2 + dist(p2, p3);
  const t = t1 + (t2 - t1) * f;
  const a1 = lerp(p0, p1, t0, t1, t);
  const a2 = lerp(p1, p2, t1, t2, t);
  const a3 = lerp(p2, p3, t2, t3, t);
  const b1 = lerp(a1, a2, t0, t2, t);
  const b2 = lerp(a2, a3, t1, t3, t);
  return lerp(b1, b2, t1, t2, t);
}

// Точка замкнутой кривой через pts; u — вещественный индекс (u = i даёт ровно pts[i]).
export function splinePoint(pts: P[], u: number): P {
  const n = pts.length;
  const i = Math.floor(u);
  return segment(pts[mod(i - 1, n)], pts[mod(i, n)], pts[mod(i + 1, n)], pts[mod(i + 2, n)], u - i);
}

// Ломаная вдоль кривой от u0 до u1 (SVG path).
export function splinePath(pts: P[], u0: number, u1: number, step = 0.1): string {
  const count = Math.max(1, Math.ceil(Math.abs(u1 - u0) / step));
  let d = '';
  for (let k = 0; k <= count; k++) {
    const [x, y] = splinePoint(pts, u0 + ((u1 - u0) * k) / count);
    d += `${k === 0 ? 'M' : 'L'}${x.toFixed(3)} ${y.toFixed(3)}`;
  }
  return d;
}
