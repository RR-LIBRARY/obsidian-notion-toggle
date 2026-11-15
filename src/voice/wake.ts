/** v1.9.26 — waking the audio engine without ever hanging (pure, testable). */
/** How long to wait for the audio engine to wake before carrying on anyway. */
export const RESUME_WAIT_MS = 1500;

/**
 * v1.9.26 — wake the audio engine, but never wait forever. On Android a
 * context's resume() can stay unanswered (no fresh tap), which used to freeze
 * voice mode in "starting" until Obsidian was restarted.
 */
export async function resumeWithin(ctx: Pick<AudioContext, "state" | "resume">, ms: number): Promise<boolean> {
  if (ctx.state === "running") return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<void>((r) => { timer = setTimeout(r, ms); });
  try {
    await Promise.race([ctx.resume().catch(() => undefined), late]);
  } finally {
    clearTimeout(timer);
  }
  return (ctx.state as AudioContextState) === "running";
}
