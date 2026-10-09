import { describe, expect, it } from 'vitest';
import { Player, type MoveView } from '../src/app/player';
import { applyMoves, parseMove } from '../src/model/moves';
import { solvedState } from '../src/model/facelets';

const solved = solvedState();

function fakeView() {
  const view: MoveView & { synced: number[][] } = {
    synced: [],
    sync(state) {
      view.synced.push([...state]);
    },
    animate: () => new Promise((r) => setTimeout(r, 0)),
  };
  return view;
}

describe('Player', () => {
  it('applies queued moves in order and syncs the views', async () => {
    const v = fakeView();
    const p = new Player([v], 0);
    for (const n of ['R', 'U', "R'", "U'", 'F2']) p.enqueue(parseMove(n));
    await p.idle();
    expect(p.state).toEqual(applyMoves(solved, "R U R' U' F2"));
    expect(v.synced.at(-1)).toEqual(p.state);
  });

  it('undo reverts the last move; undo on empty history is a no-op', async () => {
    const p = new Player([fakeView()], 0);
    p.undo();
    expect(p.state).toEqual(solved);
    p.enqueue(parseMove('R'));
    await p.idle();
    p.undo();
    await p.idle();
    expect(p.state).toEqual(solved);
    p.undo();
    await p.idle();
    expect(p.state).toEqual(solved);
  });

  it('reset in the middle of a queue lands on the solved state with empty history', async () => {
    const v = fakeView();
    const p = new Player([v], 0);
    for (const n of ['R', 'U', 'F', 'D']) p.enqueue(parseMove(n));
    await p.reset();
    expect(p.state).toEqual(solved);
    expect(v.synced.at(-1)).toEqual(solved);
    p.undo();
    await p.idle();
    expect(p.state).toEqual(solved);
  });

  it('scramble applies 20 moves and keeps 9 stickers per color', async () => {
    const p = new Player([fakeView()], 0);
    p.scramble();
    await p.idle();
    expect(p.state).not.toEqual(solved);
    for (let c = 0; c < 6; c++) expect(p.state.filter((x) => x === c)).toHaveLength(9);
  });

  it('redo replays an undone move; a new move clears the redo stack', async () => {
    const p = new Player([fakeView()], 0);
    p.enqueue(parseMove('R'));
    p.enqueue(parseMove('U'));
    p.undo();
    await p.idle();
    expect(p.state).toEqual(applyMoves(solved, 'R'));
    p.redo();
    await p.idle();
    expect(p.state).toEqual(applyMoves(solved, 'R U'));
    p.undo();
    p.undo();
    p.enqueue(parseMove('F'));
    p.redo(); // после нового хода вперёд идти некуда
    await p.idle();
    expect(p.state).toEqual(applyMoves(solved, 'F'));
  });

  it('undo and redo work while moves are still animating', async () => {
    const p = new Player([fakeView()], 0);
    for (const n of ['R', 'U', 'F']) p.enqueue(parseMove(n));
    p.undo();
    p.undo();
    p.redo();
    await p.idle();
    expect(p.state).toEqual(applyMoves(solved, 'R U'));
  });

  it('redo with nothing to redo is a no-op', async () => {
    const p = new Player([fakeView()], 0);
    p.redo();
    await p.idle();
    expect(p.state).toEqual(solved);
  });
});
