/**
 * v1.9.0 — voice mode: talks to the transcription endpoint.
 *
 * Transport is injected (Obsidian's requestUrl in the app — it bypasses CORS
 * on desktop and mobile — and a stub in tests).
 */
export interface VoiceSettings {
  voiceEndpoint: string;
  voiceKey: string;
  /** Comma separated ISO-639-1 hints, e.g. "hi,en". */
  voiceLanguages: string;
  /** "roman" = Hinglish in Latin letters, "native" = each language's own script. */
  voiceScript: "roman" | "native";
  /** Literal words you often say (names, subjects) — improves accuracy. */
  voiceKeywords: string;
  /** Floating mic button on notes. */
  voiceFab: boolean;
  /** v1.9.4 — how far the voice card is lifted from its normal spot (px; long-press to drag). */
  voiceBarLift: number;
  /** "full" shows the live text box, "compact" only wave + buttons. */
  voiceBarStyle: "full" | "compact";
  voiceBarWave: "muted" | "accent";
  /** Keep the screen on while recording (mobile). */
  voiceKeepAwake: boolean;
  /** Folder for recordings that could not be transcribed (never lose audio). */
  voiceRescueFolder: string;
  /** v1.9.9 — today's spoken seconds (credit awareness). */
  voiceUsageDay: string;
  voiceUsageSec: number;
  /** v1.9.9 — recordings saved while offline / failing, retried automatically. */
  voicePending: Array<{ path: string; note: string }>;
  /** v1.9.9 — link spoken words that match existing note names. */
  voiceAutoLink: boolean;
}

export const DEFAULT_VOICE_ENDPOINT = "https://notion-toggle-voice.lovable.app/api/public/transcribe";

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceEndpoint: DEFAULT_VOICE_ENDPOINT,
  voiceKey: "",
  voiceLanguages: "hi,en",
  voiceScript: "roman",
  voiceKeywords: "",
  voiceFab: true,
  voiceBarLift: 0,
  voiceBarStyle: "full",
  voiceBarWave: "muted",
  voiceKeepAwake: true,
  voiceRescueFolder: "Voice recordings",
  voiceUsageDay: "",
  voiceUsageSec: 0,
  voicePending: [],
  voiceAutoLink: true,
};

export interface VoiceRequest {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: ArrayBuffer;
  contentType: string;
}
export type VoiceTransport = (req: VoiceRequest) => Promise<{ status: number; text: string }>;

export class VoiceError extends Error {
  constructor(message: string, public readonly status = 0) {
    super(message);
    this.name = "VoiceError";
  }
  get retryable(): boolean {
    return this.status === 0 || this.status === 429 || this.status >= 500;
  }
}

/** v1.9.9 — plain-language messages for credit / limit / key problems. */
export function friendlyError(status: number, msg: string): string {
  if (status === 402) return "Lovable workspace ke AI credits khatam ho gaye. Credits add karein — audio save kar diya gaya hai, baad me apne aap likh diya jayega.";
  if (status === 429) return "Abhi bahut zyada requests ho gayi. Thodi der me apne aap dobara try hoga.";
  if (status === 401) return "Voice key galat hai. Settings → Voice mode me sahi key daalein.";
  if (status === 0) return "Internet nahi hai. Audio save ho gaya — net aate hi apne aap likh diya jayega.";
  return msg;
}

/** v1.9.9 — "pichhla mitao" / "undo last" spoken on its own removes the last written piece. */
export function isUndoCommand(text: string): boolean {
  return /^(pichh?la|last|aakhri)\s+(wala\s+)?(mitao|hatao|delete\s*karo|delete|undo|remove)[.!।]?$/i.test(text.trim());
}

/** Seconds of speech in a 16-bit mono WAV. */
export function wavSeconds(wav: ArrayBuffer, rate = 16000): number {
  return Math.max(0, (wav.byteLength - 44) / (rate * 2));
}

/** v1.9.9 — note title + the text just before the cursor help the recogniser pick the right words. */
export function buildContext(title: string, before: string): string {
  const tail = before.replace(/\s+/g, " ").trim().slice(-200);
  return [title ? `Note title: ${title}.` : "", tail ? `Text just before: "${tail}"` : ""].filter(Boolean).join(" ");
}

export function buildPrompt(s: Pick<VoiceSettings, "voiceScript" | "voiceKeywords">, context = ""): string {
  const parts = [
    "Dictated personal notes for Obsidian. Write clean, punctuated sentences.",
    s.voiceScript === "roman"
      ? "Write Hindi words in Roman (Latin) letters as Hinglish, e.g. 'aaj ki meeting mein humne baat ki'. Keep English words in English."
      : "Write each language in its own script.",
  ];
  if (s.voiceKeywords.trim()) parts.push(`Words that may appear: ${s.voiceKeywords.trim()}.`);
  if (context) parts.push(context);
  return parts.join(" ");
}

/** Hand-built multipart body (requestUrl has no FormData support). */
export function buildMultipart(fields: Record<string, string>, wav: ArrayBuffer): { body: ArrayBuffer; contentType: string } {
  const boundary = "----ntvoice" + Math.random().toString(16).slice(2);
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (!v) continue;
    parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }
  parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="speech.wav"\r\nContent-Type: audio/wav\r\n\r\n`));
  parts.push(new Uint8Array(wav));
  parts.push(enc.encode(`\r\n--${boundary}--\r\n`));
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return { body: out.buffer, contentType: `multipart/form-data; boundary=${boundary}` };
}

export async function transcribe(transport: VoiceTransport, s: VoiceSettings, wav: ArrayBuffer, context = ""): Promise<string> {
  if (!s.voiceEndpoint.trim() || !s.voiceKey.trim()) throw new VoiceError("Add the voice key in Settings → Notion Toggle → Voice mode.", 401);
  const { body, contentType } = buildMultipart({ prompt: buildPrompt(s, context), languages: s.voiceLanguages, script: s.voiceScript, polish: "1" }, wav);
  let res: { status: number; text: string };
  try {
    res = await transport({ url: s.voiceEndpoint.trim(), method: "POST", headers: { "x-voice-key": s.voiceKey.trim() }, body, contentType });
  } catch (e) {
    throw new VoiceError(`No connection (${(e as Error).message || "network"})`, 0);
  }
  let data: { text?: string; error?: string } = {};
  try {
    data = JSON.parse(res.text);
  } catch {
    /* non-JSON */
  }
  if (res.status < 200 || res.status >= 300) throw new VoiceError(data.error || `Transcription failed (${res.status})`, res.status);
  return String(data.text ?? "").trim();
}

/** Up to 3 tries with backoff for network / 429 / 5xx; other errors stop at once. */
export async function transcribeWithRetry(
  transport: VoiceTransport,
  s: VoiceSettings,
  wav: ArrayBuffer,
  context = "",
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))
): Promise<string> {
  let last: VoiceError | null = null;
  for (let i = 0; i < 3; i++) {
    try {
      return await transcribe(transport, s, wav, context);
    } catch (e) {
      last = e instanceof VoiceError ? e : new VoiceError(String(e));
      if (!last.retryable) throw last;
      if (i < 2) await sleep(1500 * 2 ** i);
    }
  }
  throw last!;
}

/**
 * v1.9.9 — turn spoken words that match an existing note name into [[Note]].
 * Longest names first, whole words only, case-insensitive, first match per
 * name, never inside an existing [[link]], code, or URL; names under 3 letters skipped.
 */
export function autoLink(text: string, titles: string[], skip = ""): string {
  const names = [...new Set(titles.map((t) => t.trim()))]
    .filter((t) => t.length >= 3 && t.toLowerCase() !== skip.toLowerCase())
    .sort((a, b) => b.length - a.length);
  if (!names.length || !text) return text;
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const protect = /\[\[[^\]]*\]\]|`[^`]*`|https?:\/\/\S+/g;
  const parts: Array<{ t: string; lock: boolean }> = [];
  let i = 0;
  for (const m of text.matchAll(protect)) {
    parts.push({ t: text.slice(i, m.index), lock: false }, { t: m[0], lock: true });
    i = m.index! + m[0].length;
  }
  parts.push({ t: text.slice(i), lock: false });
  for (const name of names) {
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])(${esc(name)})(?=$|[^\\p{L}\\p{N}])`, "iu");
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k];
      if (p.lock) continue;
      const m = re.exec(p.t);
      if (!m) continue;
      const at = m.index + m[1].length;
      const said = m[2];
      const link = said === name ? `[[${name}]]` : `[[${name}|${said}]]`;
      parts.splice(k, 1, { t: p.t.slice(0, at), lock: false }, { t: link, lock: true }, { t: p.t.slice(at + said.length), lock: false });
      break;
    }
  }
  return parts.map((p) => p.t).join("");
}
