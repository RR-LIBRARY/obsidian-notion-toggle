# Voice mode — manual (Notion Toggle 1.9.8+)

Bol kar Obsidian note likhiye. Aap bolte rahiye, text har kuch second me note me cursor ki jagah likhta jaata hai.

## 1. Setup (ek baar)

1. Plugin update kariye (BRAT → "Check for updates") aur Obsidian restart kariye.
2. Koi note kholiye aur **mic** button dabaiye (neeche-daayein gol button, left ribbon, ya command "Voice mode: start / finish").
3. Pehli baar ek chhota box khulega: apni **voice key** paste kariye (Lovable → project → Settings → Secrets → `VOICE_PLUGIN_KEY`) aur **Connect & start** dabaiye.
4. Microphone permission maange to **Allow** kariye.

## 2. Roz ka use

| Kaam | Kaise |
| --- | --- |
| Shuru | Mic button dabaiye |
| Rokna / dobara chalu | Beech wala ⏸ button |
| Khatam karke likhna | ✓ (kaala gol button) |
| Sab chhod dena | ✕ (bina likhe band) |
| Kahan likhe | Jahan cursor hai; recording ke beech dusri jagah tap karein to agla text wahan jaayega |
| Card hilana | Card ko long-press karke upar/neeche khiskaiye (jagah yaad rahti hai) |

## 3. Bol kar formatting (voice commands)

| Boliye | Note me banega |
| --- | --- |
| "Periodic Table ko link karo" / "link Periodic Table" | `[[Periodic Table]]` |
| "bullet …" / "naya point …" | `- …` |
| "number list …" / "pehla point, doosra point" | `1. …`, `2. …` |
| "checkbox …" / "task …" | `- [ ] …` |
| "heading Aaj ke topics" | `## Aaj ke topics` |
| "chhota heading …" | `### …` |
| "bold …" | `**…**` |
| "nayi line" / "naya paragraph" | line break / khaali line |
| "table banao, columns subject aur marks. Row maths ninety. Row physics eighty five." | Markdown table |

Numbers aur symbols apne aap: "saat baje" → 7 baje, "do plus teen barabar paanch" → 2 + 3 = 5, "pachattar pratishat" → 75%, "teen hazaar rupaye" → ₹3000, "H two O" → H2O.
"uh, um, aaa, hmm" jaisi awaazein hata di jaati hain. Kuch bhi apni taraf se nahi joda jaata — agar clean-up koi number badle ya extra baat jode, to original suna hua text hi likha jaata hai.

## 4. Settings (Settings → Notion Toggle → Voice mode)

- **Languages** — jaise `hi,en`.
- **Hindi written as** — Hinglish (Roman) ya Devanagari.
- **Special words** — naam/technical shabd jo aap aksar bolte hain (accuracy badhti hai).
- **Voice card look** — live text ke saath / compact, grey / colour wave, Reset position.
- **Floating mic button**, **Keep screen on while recording**, **Rescue folder**, **Test connection**.

## 5. Limitations (zaroor padhiye)

- **Internet zaroori hai.** Awaaz Lovable par likhi jaati hai; offline kaam nahi karta. Net chala jaaye to 3 baar koshish hoti hai, phir audio **Rescue folder** ("Voice recordings") me save ho jaata hai — kuch khota nahi.
- **Lovable workspace credits lagte hain.** Har bola hua tukda (har kuch second) ek transcription + ek clean-up request hai, jo us Lovable workspace ke **AI credits** se kat-ta hai jisme "Notion Toggle Voice" project hai. Har mahine thoda free AI allowance milta hai; uske baad workspace ke normal credits use hote hain. Credits khatam → voice mode error dikhayega jab tak credits na aayein. Usage dekhne ke liye: Lovable → Settings → Usage / project ka AI tab.
- **Screen band:** zyada-tar phones screen lock hone par Obsidian ka mic rok dete hain. Plugin tab tak bola hua turant bhej deta hai aur wapas aane par mic khud chalu karta hai, lekin lock ke dauraan ki awaaz record hone ki guarantee nahi. Isliye "Keep screen on while recording" ON rakhiye.
- **Shor:** bahut tez shor ya door se bolne par galtiyan ho sakti hain. Phone ko muh ke paas rakhiye.
- **Voice commands** AI samajhta hai — kabhi-kabhi command normal shabd ki tarah likh sakta hai. Saaf bolein: "bullet", "heading", "table banao".
- **Lamba tukda:** ek tukda max ~12 second ka hota hai; lamba bolne par kai tukdon me likha jaata hai (sahi order me).
- **Key private rakhiye.** Jiske paas key hai woh aapke credits use kar sakta hai. Key leak ho to Lovable me `VOICE_PLUGIN_KEY` badal dijiye aur plugin me nayi paste kariye.
- **Desktop + mobile** dono par chalta hai; mic permission OS se deni padti hai.

## 6. Problem? 

| Dikh raha hai | Kya karein |
| --- | --- |
| "Wrong voice key" | Settings me key dobara paste → Test connection |
| Text nahi aa raha | Internet check karein; Rescue folder dekhein |
| Mic nahi dikh raha | Plugin update + restart; ya command palette me "voice" search |
| Credits / 402 error | Lovable workspace me credits check karein |


## New in 1.9.9
- **Auto-link:** say a note's name (e.g. "physics") and it becomes `[[Physics|physics]]`. Names under 3 letters and the current note are skipped. Turn off in Settings → Auto-link note names.
- **Self-test:** command palette → "Voice mode: self-test (5 sec)". Speak for 5 seconds; a report (mic, voice level, server time, text) is written into the note. Send a screenshot if something shows ❌.
- **Offline / no credits:** audio is saved in the rescue folder and written into the same note automatically when internet returns or on "Voice mode: write saved recordings now".
- **Undo:** say only "pichhla mitao" to remove the last written piece.
- **Usage:** Settings shows minutes spoken today (each minute uses Lovable workspace AI credits).


## Thinking mode (1.9.11, advanced)
Settings → "Advanced: link terms from other notes". When ON, a specific word you speak (7+ letters, found in only 1–3 notes, e.g. *ophthalmologist*) becomes `[[That note|word]]`. Common words are skipped, max 3 such links per piece, current note skipped. Default OFF; normal note-name linking is unchanged.


## Line linking (1.9.12, advanced)
Settings → "Advanced: link matching lines". A spoken run of 4+ words that is written in another note becomes `[[Note#Heading|spoken words]]` and opens at that heading. Lines found in 3+ notes are skipped as common; max 2 per piece; current note skipped; me/mein, nahi/nahin, hai/he count as the same word. Default OFF.

Tips: keep the term switch and line switch both ON for best "thinking mode"; write key ideas under clear headings so links land at the right place; if links feel too many, turn off the term switch and keep only lines.


## Term link sliders (1.9.13)
- **Shortest word** (default 7): words shorter than this never link. Lower = more links, more noise.
- **Max notes** (default 3): a word written in more notes than this is treated as common. Small vault: 2, big vault: 5.


## Presets & Auto (1.9.14)
- **Term link: preset** — Balanced (7, auto), Medical/technical (9, auto), More links (5, 5), Fewer links (9, 2).
- **Max notes = 0 (Auto)** — follows vault size: under 100 notes → 2, up to 1000 → 3, bigger → 5.


## Lambi recording / screen lock / dusri app (1.9.17)
Android screen lock hone par ya dusri app kholne par Obsidian ka mic rok deta hai — ye phone ka niyam hai. Iska pakka hal:
1. Phone ke **Voice Recorder** app me record kariye — lock screen aur dusri apps ke beech bhi chalta rahta hai, jitni der chahein.
2. Audio file vault me daaliye (share → Obsidian, ya vault folder me copy).
3. File par long-press → **Voice: transcribe to note**, ya command **"Voice mode: transcribe audio file"**.
4. Ek naya note "<file> — transcript" banta hai: upar audio, neeche poora text (punctuation, numbers, symbols, auto-links). Pause par ~10–20 s ke hisson me kaatta hai, shabd nahi kat-te.
5. Net/credits beech me khatam? Command dobara chalaiye — jahan ruka tha wahin se aage likhta hai.
Formats: m4a, mp3, wav, ogg/opus, webm, aac, flac. Bahut lambi file (2 ghante+) purane phone par bhaari pad sakti hai — tab 1-1 ghante ki files banaiye.
