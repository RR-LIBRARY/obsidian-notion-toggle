import { describe, it, expect } from "bun:test";
import { DictationSession } from "../src/voice/session";

const wav = () => new ArrayBuffer(8);
function mk(write: (t: string) => void | Promise<void>, texts: string[]) {
  let note = "";
  const errors: string[] = [];
  let i = 0;
  const s = new DictationSession({
    transcribe: async () => texts[i++],
    write: async (t) => { await write(t); note += t; },
    before: () => note,
    rescue: async () => null,
    onPending: () => {},
    onError: (e) => errors.push(e.message),
  });
  return { s, get note() { return note; }, errors };
}

describe("voice text always reaches the note (1.9.19)", () => {
  it("one failed write does not stop later pieces", async () => {
    let n = 0;
    const m = mk(() => { if (n++ === 0) throw new Error("editor gone"); }, ["Pehla.", "Doosra.", "Teesra."]);
    m.s.add(wav()); m.s.add(wav()); m.s.add(wav());
    await m.s.end();
    expect(m.note).toBe("Doosra. Teesra.");
    expect(m.errors).toEqual(["editor gone"]);
  });
  it("slow writes still keep spoken order", async () => {
    const m = mk((t) => new Promise((r) => setTimeout(r, t.startsWith("A") ? 30 : 1)), ["A one.", "B two.", "C three."]);
    m.s.add(wav()); m.s.add(wav()); m.s.add(wav());
    await m.s.end();
    expect(m.note).toBe("A one. B two. C three.");
  });
  it("finish waits until the last piece is written", async () => {
    const m = mk(() => new Promise((r) => setTimeout(r, 20)), ["Aakhri baat."]);
    m.s.add(wav());
    await m.s.end();
    expect(m.note).toBe("Aakhri baat.");
  });
});
