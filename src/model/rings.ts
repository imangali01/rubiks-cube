import { STICKERS } from './facelets';
import type { Axis } from './moves';

const cache = new Map<string, number[][]>();

// Циклы наклеек, которые двигает слой (axis, layer): кольцо из 12 боковых наклеек
// и (для крайнего слоя) кольцо из 8 наклеек самой грани.
// Наклейки в каждом кольце идут по возрастанию угла вокруг +оси, то есть
// положительный четвертьоборот сдвигает наклейку на четверть кольца вперёд.
export function ringsFor(axis: Axis, layer: -1 | 0 | 1): number[][] {
  const key = `${axis},${layer}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const a = (axis + 1) % 3;
  const b = (axis + 2) % 3;
  const angle = (i: number) => {
    const s = STICKERS[i];
    return Math.atan2(s.pos[b] + 0.5 * s.normal[b], s.pos[a] + 0.5 * s.normal[a]);
  };

  const side: number[] = [];
  const face: number[] = [];
  for (const s of STICKERS) {
    if (s.pos[axis] !== layer) continue;
    if (s.normal[axis] === 0) side.push(s.index);
    else if (s.pos.some((c, i) => i !== axis && c !== 0)) face.push(s.index); // без центра
  }
  const rings = [side, face].filter((r) => r.length > 0).map((r) => r.sort((x, y) => angle(x) - angle(y)));
  cache.set(key, rings);
  return rings;
}
