import { solvedState } from '../model/facelets';
import { MOVE_NAMES, applyMove, invertMove, parseMove, type Move } from '../model/moves';

export interface MoveView {
  sync(state: readonly number[]): void;
  animate(move: Move, ms: number): Promise<void>;
}

interface Job {
  move: Move;
  ms: number;
}

export class Player {
  state: number[] = solvedState();
  // История и «вперёд» ведутся по поставленным в очередь ходам, поэтому назад/вперёд работают и во время анимации.
  private history: Move[] = [];
  private redoStack: Move[] = [];
  private queue: Job[] = [];
  private busy = false;
  private epoch = 0;
  private current: Promise<void> = Promise.resolve();

  constructor(
    private views: MoveView[],
    private duration = 420,
  ) {
    this.sync();
  }

  // Новый ход пользователя: попадает в историю и сбрасывает «вперёд».
  enqueue(move: Move, opts: { ms?: number } = {}): void {
    this.history.push(move);
    this.redoStack.length = 0;
    this.push(move, opts.ms ?? this.duration);
  }

  undo(): void {
    const last = this.history.pop();
    if (!last) return;
    this.redoStack.push(last);
    this.push(invertMove(last), this.duration);
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.history.push(next);
    this.push(next, this.duration);
  }

  scramble(n = 20): void {
    let prev = '';
    for (let i = 0; i < n; i++) {
      let name: string;
      do name = MOVE_NAMES[Math.floor(Math.random() * MOVE_NAMES.length)];
      while (name[0] === prev);
      prev = name[0];
      this.enqueue(parseMove(name), { ms: Math.min(this.duration, 160) });
    }
  }

  async reset(): Promise<void> {
    this.epoch++;
    this.queue.length = 0;
    await this.current; // дожидаемся текущей анимации
    this.queue.length = 0;
    this.history.length = 0;
    this.redoStack.length = 0;
    this.state = solvedState();
    this.sync();
  }

  idle(): Promise<void> {
    return this.current;
  }

  private push(move: Move, ms: number): void {
    this.queue.push({ move, ms });
    if (!this.busy) this.current = this.pump();
  }

  private sync(): void {
    for (const v of this.views) v.sync(this.state);
  }

  private async pump(): Promise<void> {
    this.busy = true;
    const epoch = this.epoch;
    try {
      while (this.queue.length) {
        const job = this.queue.shift()!;
        await Promise.all(this.views.map((v) => v.animate(job.move, job.ms)));
        if (epoch !== this.epoch) return; // reset сам синхронизирует виды
        this.state = applyMove(this.state, job.move);
        this.sync();
      }
    } finally {
      this.busy = false;
    }
  }
}
