import { describe, expect, it } from 'vitest';
import { ringsFor } from '../src/model/rings';
import { moveTable, type Axis } from '../src/model/moves';

const layers = [-1, 0, 1] as const;
const axes: Axis[] = [0, 1, 2];

describe('rings', () => {
  it('outer layers have a 12-ring and an 8-ring, middle layers only a 12-ring', () => {
    for (const axis of axes) {
      for (const layer of layers) {
        const sizes = ringsFor(axis, layer).map((r) => r.length);
        expect(sizes).toEqual(layer === 0 ? [12] : [12, 8]);
      }
    }
  });

  it('a positive quarter turn moves every sticker a quarter of the ring forward', () => {
    for (const axis of axes) {
      for (const layer of layers) {
        const to = new Map(moveTable({ axis, layer, turns: 1 }).pairs);
        for (const ring of ringsFor(axis, layer)) {
          const n = ring.length;
          ring.forEach((slot, i) => {
            expect(to.get(slot)).toBe(ring[(i + n / 4) % n]);
          });
        }
      }
    }
  });
});
