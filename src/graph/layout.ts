import { STICKERS } from '../model/facelets';
import type { P } from './spline';

// Граф устроен как на схеме групп: три семейства концентрических окружностей (по одному на ось кубика,
// по окружности на каждый из трёх слоёв), а 54 вершины стоят в точках пересечения окружностей двух семейств.
// Окружность (axis, layer) — это дорожка, по которой едут 12 боковых наклеек слоя.
const RHO = 2.4; // расстояние от центра картинки до центров семейств
const BASE_R = 4.8; // радиус средней окружности семейства
const DELTA = 0.9; // шаг радиусов между слоями
const ANGLES = [-90, 30, 150]; // направление центра семейства для осей x, y, z

export interface Circle {
  c: P;
  r: number;
}

const CENTERS: P[] = ANGLES.map((a) => [RHO * Math.cos((a * Math.PI) / 180), RHO * Math.sin((a * Math.PI) / 180)]);

export const circleOf = (axis: number, layer: number): Circle => ({ c: CENTERS[axis], r: BASE_R + layer * DELTA });

// Две точки пересечения окружностей; null, если окружности не пересекаются (например, концентрические).
export function intersections(a: Circle, b: Circle): [P, P] | null {
  const dx = b.c[0] - a.c[0];
  const dy = b.c[1] - a.c[1];
  const d = Math.hypot(dx, dy);
  if (d < 1e-9) return null;
  const along = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
  const h2 = a.r * a.r - along * along;
  if (h2 < 0) return null;
  const h = Math.sqrt(h2);
  const bx = a.c[0] + (along * dx) / d;
  const by = a.c[1] + (along * dy) / d;
  return [
    [bx - (h * dy) / d, by + (h * dx) / d],
    [bx + (h * dy) / d, by - (h * dx) / d],
  ];
}

// Наклейка лежит на дорожках двух осей, перпендикулярных её нормали; из двух точек пересечения
// выбираем ту, что соответствует знаку нормали (так порядок вершин на каждой дорожке совпадает с кольцом).
const POSITIONS: P[] = STICKERS.map((s) => {
  const n = s.normal.findIndex((c) => c !== 0);
  const p = (n + 1) % 3;
  const q = (n + 2) % 3;
  const [first, second] = intersections(circleOf(p, s.pos[p]), circleOf(q, s.pos[q]))!;
  return s.normal[n] < 0 ? first : second;
});

export const nodePosition = (slot: number): P => POSITIONS[slot];

// Две окружности (дорожки), на которых лежит наклейка: по одной для двух осей, перпендикулярных её нормали.
export function circlesOf(slot: number): Circle[] {
  const s = STICKERS[slot];
  const n = s.normal.findIndex((c) => c !== 0);
  return [1, 2].map((d) => circleOf((n + d) % 3, s.pos[(n + d) % 3]));
}

export const VIEWBOX = '-8.8 -8.8 17.6 17.6';
