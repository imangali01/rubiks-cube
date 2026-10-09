import { STICKERS } from '../model/facelets';
import { parseMove, type Axis, type Move } from '../model/moves';
import { tangentAt } from './tracks';

const CLICK = 0.15; // меньше — это клик
const PULL = 0.6; // меньше — вершина вернётся на место без хода
const MIN_COS = 0.7;

// dx, dy — смещение мыши в единицах шага между вершинами.
// Вершину тянут вдоль одной из дорожек, по которым она ездит; выбираем самую подходящую.
export function chooseMove(slot: number, dx: number, dy: number): Move | null {
  const len = Math.hypot(dx, dy);
  if (len < CLICK) return parseMove(STICKERS[slot].face);
  if (len < PULL) return null;

  let best: { axis: Axis; layer: -1 | 0 | 1; cos: number } | null = null;
  for (const axis of [0, 1, 2] as const) {
    const layer = STICKERS[slot].pos[axis] as -1 | 0 | 1;
    const t = tangentAt(axis, layer, slot);
    if (!t) continue;
    const cos = (dx * t[0] + dy * t[1]) / len;
    if (!best || Math.abs(cos) > Math.abs(best.cos)) best = { axis, layer, cos };
  }
  if (!best || Math.abs(best.cos) < MIN_COS) return null;
  return { axis: best.axis, layer: best.layer, turns: best.cos > 0 ? 1 : 3 };
}
