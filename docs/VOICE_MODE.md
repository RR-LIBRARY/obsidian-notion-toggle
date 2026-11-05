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
