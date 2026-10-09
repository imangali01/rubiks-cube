import { describe, expect, it } from 'vitest';
import { nodePosition } from '../src/graph/layout';
import { tangentAt, tracksFor } from '../src/graph/tracks';
import { chooseMove } from '../src/graph/dragIntent';
import { STICKERS } from '../src/model/facelets';

describe('layout', () => {
  it('places 54 nodes that do not overlap', () => {
    let min = Infinity;
    for (const s of STICKERS) {
      for (const t of STICKERS) {
        if (t.index <= s.index) continue;
        const [ax, ay] = nodePosition(s.index);
        const [bx, by] = nodePosition(t.index);
        min = Math.min(min, Math.hypot(ax - bx, ay - by));
      }
    }
    expect(min).toBeGreaterThan(0.9); // диаметр узла 0.84
  });

  it('every 12-ring is a circle whose nodes go around it in order', () => {
    for (const axis of [0, 1, 2] as const) {
      for (const layer of [-1, 0, 1] as const) {
        const side = tracksFor(axis, layer)[0];
        expect(side.circle).not.toBeNull();
        const { phi } = side;
        for (let i = 1; i < phi.length; i++) expect(phi[i]).toBeGreaterThan(phi[i - 1]);
        expect(phi[phi.length - 1]).toBeLessThan(phi[0] + 2 * Math.PI);
        for (const [x, y] of side.pts) {
          const { c, r } = side.circle!;
          expect(Math.hypot(x - c[0], y - c[1])).toBeCloseTo(r, 6);
        }
      }
    }
  });
});

describe('chooseMove', () => {
  const slot = 19; // F face, top middle: лежит в слоях U (ось y), M (ось x, слой 0) и F (ось z)
  const pull = (t: [number, number], len: number) => chooseMove(slot, t[0] * len, t[1] * len);

  it('click (no movement) turns the sticker face clockwise', () => {
    expect(chooseMove(slot, 0, 0)).toEqual({ axis: 2, layer: 1, turns: 3 });
  });

  it('a short pull does nothing', () => {
    expect(chooseMove(slot, 0.3, 0)).toBeNull();
  });

  it('pulling along the U ring turns the U layer, direction by sign', () => {
    const t = tangentAt(1, 1, slot)!;
    expect(pull(t, 0.9)).toEqual({ axis: 1, layer: 1, turns: 1 });
    expect(pull(t, -0.9)).toEqual({ axis: 1, layer: 1, turns: 3 });
  });

  it('pulling along the middle ring turns the middle slice', () => {
    const t = tangentAt(0, 0, slot)!;
    expect(pull(t, 0.9)).toEqual({ axis: 0, layer: 0, turns: 1 });
  });
});
