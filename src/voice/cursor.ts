/**
 * v1.9.7 — where the next spoken piece is written. Starts at the cursor; if
 * the user taps somewhere else (or types) while recording, writing continues
 * from the new cursor position instead of the old spot.
 */
export class CursorAnchor {
  private placed: number;
  constructor(public offset: number) {
    this.placed = offset;
  }
  /** Call with the editor's current cursor offset before writing. */
  follow(cursor: number): number {
    if (cursor !== this.placed) this.offset = cursor;
    return this.offset;
  }
  /** Call after inserting `length` characters at the anchor. */
  wrote(length: number): number {
    this.offset += length;
    this.placed = this.offset;
    return this.offset;
  }
}
