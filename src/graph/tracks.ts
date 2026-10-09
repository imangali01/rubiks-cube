import { ringsFor } from '../model/rings';
import type { Axis, Move } from '../model/moves';
import { circleOf, circlesOf, intersections, nodePosition, type Circle } from './layout';
import { splinePoint, type P } from './spline';

const TAU = 2 * Math.PI;
const mod = (i: number, n: number) => ((i % n) + n) % n;

// Дорожка графа: кольцо вершин слоя. Кольцо из 12 боковых наклеек лежит на окружности (circle),
// кольцо из 8 наклеек грани — на гладкой кривой через позиции вершин.
export interface Track {
  slots: number[];
  pts: P[];
  circle: Circle | null;
  // Для окружности: угол вершины = dir * phi, а phi растёт вдоль кольца (в сторону положительного поворота).
  dir: 1 | -1;
  phi: number[];
}

const cache = new Map<string, Track[]>();

function build(axis: Axis, layer: -1 | 0 | 1, slots: number[], onCircle: boolean): Track {
  const pts = slots.map(nodePosition);
  if (!onCircle) return { slots, pts, circle: null, dir: 1, phi: [] };

  const circle = circleOf(axis, layer);
  const n = slots.length;
  const theta = pts.map(([x, y]) => Math.atan2(y - circle.c[1], x - circle.c[0]));
  const gap = (a: number, b: number, dir: number) => mod(dir * (b - a), TAU);
  const total = (dir: number) => theta.reduce((s, t, i) => s + gap(t, theta[(i + 1) % n], dir), 0);
  const dir: 1 | -1 = Math.abs(total(1) - TAU) < 1e-6 ? 1 : -1;
  const phi = [dir * theta[0]];
  for (let i = 1; i < n; i++) phi.push(phi[i - 1] + gap(theta[i - 1], theta[i], dir));
  return { slots, pts, circle, dir, phi };
}

export function tracksFor(axis: Axis, layer: -1 | 0 | 1): Track[] {
  const key = `${axis},${layer}`;
  let tracks = cache.get(key);
  if (!tracks) {
    tracks = ringsFor(axis, layer).map((slots, i) => build(axis, layer, slots, i === 0));
    cache.set(key, tracks);
  }
  return tracks;
}

// Угол вершины с номером j в кольце (j любое целое: кольцо продолжается по кругу).
export function phiAt(t: Track, j: number): number {
  const n = t.slots.length;
  return t.phi[mod(j, n)] + Math.floor(j / n) * TAU;
}

export function circlePoint(t: Track, phi: number): P {
  const { c, r } = t.circle!;
  const a = t.dir * phi;
  return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
}

// Положение вершины i кольца, которая проехала долю k пути длиной step вершин.
// По окружности едет равномерно по углу, по кривой грани — по её параметру.
export function trackPosition(t: Track, i: number, step: number, k: number): P {
  if (!t.circle) return splinePoint(t.pts, i + step * k);
  const from = phiAt(t, i);
  return circlePoint(t, from + (phiAt(t, i + step) - from) * k);
}

// Дуга окружности между углами a и b (SVG path).
export function arcPath(t: Track, a: number, b: number): string {
  const count = Math.max(1, Math.ceil(Math.abs(b - a) / 0.05));
  let d = '';
  for (let k = 0; k <= count; k++) {
    const [x, y] = circlePoint(t, a + ((b - a) * k) / count);
    d += `${k === 0 ? 'M' : 'L'}${x.toFixed(3)} ${y.toFixed(3)}`;
  }
  return d;
}

// Единичная касательная к дорожке слоя в вершине slot, в сторону положительного поворота.
export function tangentAt(axis: Axis, layer: -1 | 0 | 1, slot: number): P | null {
  for (const t of tracksFor(axis, layer)) {
    const i = t.slots.indexOf(slot);
    if (i < 0) continue;
    let a: P;
    let b: P;
    if (t.circle) {
      a = circlePoint(t, phiAt(t, i) - 0.02);
      b = circlePoint(t, phiAt(t, i) + 0.02);
    } else {
      a = splinePoint(t.pts, i - 0.2);
      b = splinePoint(t.pts, i + 0.2);
    }
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  }
  return null;
}

// Путь вершины только по линиям графа: одна или две дуги окружностей.
export interface Segment {
  circle: Circle;
  a0: number;
  a1: number;
}

const angleOf = (c: Circle, [x, y]: P) => Math.atan2(y - c.c[1], x - c.c[0]);
const sameCircle = (a: Circle, b: Circle) => a.c === b.c && a.r === b.r;

// Короткая дуга окружности от точки p до точки q.
function arcBetween(c: Circle, p: P, q: P): Segment {
  const a0 = angleOf(c, p);
  let d = angleOf(c, q) - a0;
  while (d > Math.PI) d -= TAU;
  while (d <= -Math.PI) d += TAU;
  return { circle: c, a0, a1: a0 + d };
}

const pathCache = new Map<string, Segment[]>();

// Путь вершины from -> to внутри одной грани: по общей окружности, а если общей нет,
// то по двум окружностям через ближайшую точку их пересечения.
export function linePath(from: number, to: number): Segment[] {
  const key = `${from},${to}`;
  const hit = pathCache.get(key);
  if (hit) return hit;

  const pa = nodePosition(from);
  const pb = nodePosition(to);
  const ca = circlesOf(from);
  const cb = circlesOf(to);
  let path: Segment[] | null = null;
  for (const x of ca) for (const y of cb) if (!path && sameCircle(x, y)) path = [arcBetween(x, pa, pb)];
  if (!path) {
    let best = Infinity;
    for (const x of ca) {
      for (const y of cb) {
        for (const v of intersections(x, y) ?? []) {
          const cost = Math.hypot(pa[0] - v[0], pa[1] - v[1]) + Math.hypot(v[0] - pb[0], v[1] - pb[1]);
          if (cost < best) {
            best = cost;
            path = [arcBetween(x, pa, v), arcBetween(y, v, pb)];
          }
        }
      }
    }
  }
  if (!path) throw new Error(`No line path from ${from} to ${to}`);
  pathCache.set(key, path);
  return path;
}

// Точка пути в доле k (по длине дуг).
export function linePathPoint(path: Segment[], k: number): P {
  const len = path.map((s) => Math.abs(s.a1 - s.a0) * s.circle.r);
  let rest = k * len.reduce((a, b) => a + b, 0);
  for (let i = 0; i < path.length; i++) {
    if (rest <= len[i] || i === path.length - 1) {
      const s = path[i];
      const f = len[i] > 0 ? Math.min(1, rest / len[i]) : 1;
      const a = s.a0 + (s.a1 - s.a0) * f;
      return [s.circle.c[0] + s.circle.r * Math.cos(a), s.circle.c[1] + s.circle.r * Math.sin(a)];
    }
    rest -= len[i];
  }
  throw new Error('unreachable');
}

// Как едет каждая вершина слоя при ходе: только по линиям графа.
// Кольцо боковых наклеек — по своей окружности, наклейки грани — по дугам окружностей
// (через общую вершину пересечения, если общей окружности нет).
export interface Motion {
  slot: number;
  to: number;
  at: (k: number) => P;
}

export function motionsFor(move: Move): Motion[] {
  const motions: Motion[] = [];
  for (const tr of tracksFor(move.axis, move.layer)) {
    const n = tr.slots.length;
    const step = move.turns === 3 ? -n / 4 : (move.turns * n) / 4;
    tr.slots.forEach((slot, i) => {
      const to = tr.slots[mod(i + step, n)];
      if (tr.circle) {
        motions.push({ slot, to, at: (k) => trackPosition(tr, i, step, k) });
      } else {
        const path = linePath(slot, to);
        motions.push({ slot, to, at: (k) => linePathPoint(path, k) });
      }
    });
  }
  return motions;
}
