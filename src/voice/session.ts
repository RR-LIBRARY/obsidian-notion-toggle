/**
 * v1.9.0 — voice mode: one dictation session (pure, testable).
 *
 * Pieces are transcribed in parallel but written strictly in the order they
 * were spoken. A piece that fails after retries is kept as audio by the
 * `rescue` callback and a marker is written in its place, so nothing said is
 * ever lost.
 */
import { joinPiece } from "./audio";
import { isUndoCommand } from "./client";

export interface SessionDeps {
  transcribe(wav: ArrayBuffer): Promise<string>;
  /** Write text at the session anchor; returns nothing. */
  write(text: string): void;
  /** Text already before the anchor (for spacing). */
  before(): string;
  rescue(wav: ArrayBuffer, error: Error): Promise<string | null>;
  onPending(count: number): void;
  onError(error: Error): void;
  /** v1.9.9 — remove the last written piece ("pichhla mitao"). */
  undo?(): void;
}

export class DictationSession {
  private next = 0;
  private flushed = 0;
  private results = new Map<number, string>();
  private pending = 0;
  private finals: Array<() => void> = [];
  private ended = false;

  constructor(private readonly d: SessionDeps) {}

  add(wav: ArrayBuffer | null): void {
    const id = this.next++;
    if (!wav) {
      this.results.set(id, "");
      this.drain();
      return;
    }
    this.pending++;
    this.d.onPending(this.pending);
    this.d
      .transcribe(wav)
      .then((t) => this.results.set(id, t))
      .catch(async (e: Error) => {
        this.d.onError(e);
        const path = await this.d.rescue(wav, e).catch(() => null);
        this.results.set(id, path ? `[voice not written — audio saved: ${path}]` : "");
      })
      .finally(() => {
        this.pending--;
        this.d.onPending(this.pending);
        this.drain();
      });
  }

  private drain(): void {
    while (this.results.has(this.flushed)) {
      const t = this.results.get(this.flushed)!;
      this.results.delete(this.flushed);
      this.flushed++;
      if (this.d.undo && isUndoCommand(t)) {
        this.d.undo();
        continue;
      }
      const piece = joinPiece(this.d.before(), t);
      if (piece) this.d.write(piece);
    }
    if (this.ended && this.flushed === this.next) this.finals.splice(0).forEach((f) => f());
  }

  /** Resolves once every piece added so far is written. */
  end(): Promise<void> {
    this.ended = true;
    return new Promise((r) => {
      this.finals.push(r);
      this.drain();
    });
  }
}
