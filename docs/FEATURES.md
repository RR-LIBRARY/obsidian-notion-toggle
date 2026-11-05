# Notion Toggle — saare features ek jagah (1.9.16)

Ye file plugin ke **har feature** ki ek list hai. Detail ke liye: [Voice mode manual](VOICE_MODE.md) · [Autoscroll features](AUTOSCROLL_FEATURES.md) · [Hindi guide](HINDI-GUIDE.md).

---

## A. Toggles (Notion jaise)

| Feature | Kya karta hai |
|---|---|
| Notion-style toggles | Note me band/khulne wale blocks (question → answer) |
| Bold title, wrap | Lambe title saaf wrap hote hain |
| Enter / Tab | Enter se naya toggle, Tab se nested (andar wala) toggle |
| Drag & touch-drag | Toggle ko pakad kar upar/neeche khiskaiye (mobile par bhi) |
| Notion paste | Notion se copy kiya hua content toggle bankar paste hota hai |
| Colours | 🔴🟡🟢 jaise rang — quiz/autoscroll me filter ke liye |
| Toolbar | Mobile toolbar par toggle/voice buttons |

## B. Autoscroll (37 features)

Pura list: [AUTOSCROLL_FEATURES.md](AUTOSCROLL_FEATURES.md). Short me:

| Group | Features |
|---|---|
| Start/stop | Autoscroll switch, hold-to-pause, floating layers button |
| Think time | Answer pehle chhupa, think seconds (`🤔20s`), countdown icon/preview, distraction-free, reduced motion, debug overlay |
| Quiz | Timer per question (`⏱30`, `⏱15m`), answer time, auto next, colour filter, minimal UI, loop, quiz dock (pause/reveal/next/stop) |
| Answers | Open all / close all, open with quiz |
| Scrolling | Direction, speed, pause time, pause at (toggle/heading), colour filter, loop, auto open/close |
| Tall answers | Screen-by-screen reading, pause per screen, overlap, usable viewport, live calculation |
| Other | Quiet mode, go to first, stats, toolbar guide, drawer guard |

## C. Voice mode — bol kar likhna

### C1. Recording
| Feature | Kya karta hai |
|---|---|
| Mic button | Lovable jaisa safed gol button, neeche-daayein (autoscroll button ke upar, overlap nahi) |
| Left ribbon / command | "Voice mode: start / finish" |
| Voice card | Beech se phailti wave, ✕ (cancel), ⏸ (pause/resume), ✓ (finish) |
| Live text | Bolte waqt card me text dikhta hai |
| Card hilana | Long-press karke upar/neeche; jagah yaad rahti hai; Reset position |
| Card look | Full / compact, grey / colour wave |
| Cursor se likhna | Jahan cursor hai wahin se text; recording ke beech cursor badlo to agla text wahan |
| Keep screen on | Recording ke dauraan screen jalti rahe |
| Screen off / app band | Ab tak ka bola turant bhejta hai; wapas aane par mic khud chalu |

### C2. Transcript quality
| Feature | Kya karta hai |
|---|---|
| Hindi + English (Hinglish) | Roman ya Devanagari — setting se |
| Punctuation | Poore vaakya par `.` `?` `,`; adhoore tukde par nahi |
| Filler hatana | uh, um, aaa, hmm hata deta hai |
| Numbers | "saat baje" → 7 baje, "teen hazaar rupaye" → ₹3000 |
| Symbols | plus → +, barabar → =, pratishat → %, "H two O" → H2O |
| No hallucination guard | Clean-up koi number badle ya extra baat jode to original suna text hi likha jaata hai; sirf shor → kuch nahi likha |
| Note context | Note ka title + pichhli 200 letters bheje jaate hain taaki shabd sahi samjhe |
| Special words | Aapke naam/technical shabd setting me — accuracy badhti hai |
| Spoken undo | Sirf "pichhla mitao" bolo → aakhri tukda hat jaata hai |

### C3. Bol kar formatting
| Boliye | Banega |
|---|---|
| "Physics ko link karo" | `[[Physics]]` |
| "bullet …" | `- …` |
| "pehla point, doosra point" | `1.` `2.` |
| "checkbox …" | `- [ ] …` |
| "heading …" / "chhota heading …" | `##` / `###` |
| "bold …" | `**…**` |
| "nayi line" / "naya paragraph" | line break / khaali line |
| "table banao, columns … Row …" | Markdown table |

### C4. Linking (thinking mode)
| Feature | Default | Kya karta hai |
|---|---|---|
| Auto-link note names | ON | "physics" bola aur `Physics` note hai → `[[Physics\|physics]]` |
| Term linking | OFF | Khaas shabd (jaise *ophthalmologist*) jis note me likha hai, us note se link |
| Line linking | OFF | 4+ shabd ki line jo dusre note me likhi hai → `[[Note#Heading\|line]]` |
| Shortest word slider | 7 | Isse chhote shabd link nahi |
| Max notes slider | Auto | Itne se zyada notes me wala shabd "common" — link nahi. Auto: <100 notes → 2, ≤1000 → 3, bada → 5 |
| Presets | Balanced | Balanced, Medical/technical, More links, Fewer links |

Rules: current note kabhi link nahi; code/URL/purane link ke andar kuch nahi badalta; ek tukde me max 3 term + 2 line links.

### C5. Bharosa (reliability)
| Feature | Kya karta hai |
|---|---|
| Sahi order | Tukde kitni bhi der me aayein, note me sahi order me likhe jaate hain |
| Retry | Net gaya → 3 baar koshish |
| Offline queue | Offline me audio save; net aate hi same note me khud likh deta hai (auto-link ke saath) |
| Rescue folder | Audio "Voice recordings" folder me safe — kuch nahi khota |
| "Write saved recordings now" | Saved audio haath se likhwana |
| Self-test (5 sec) | Mic, awaaz level, server time, text ki report note me |
| Saaf errors | Galat key / net nahi / credits khatam — seedhi bhasha me |
| Today's usage | Settings me aaj kitne minute bole |

### C6. Setup
| Feature | Kya karta hai |
|---|---|
| Pehli baar setup box | Mobile bottom-sheet, bada key box, "Connect & start" |
| Test connection | Settings se check |
| Languages / script | `hi,en`, Hinglish ya Devanagari |

---

## D. 8.5/10 kyun — kya kam hai

| Kami | Kya kar sakte hain | Code se theek ho sakta hai? |
|---|---|---|
| Asli phone par mic test nahi hua (sirf browser test) | Aap self-test chalakar screenshot bhejein | Aapke test se |
| Screen lock hone par Android mic rok deta hai | "Keep screen on" ON rakhein | Nahi — phone ka niyam |
| Offline me live text nahi | Audio save hota hai, baad me likhta hai | Nahi — awaaz Lovable par likhi jaati hai |
| Lovable credits lagte hain | Usage settings me dekhein | Nahi — AI ka kharcha |
| Tez shor me galti | Phone muh ke paas | Thoda |

Jo code se ho sakta tha (offline queue, undo, self-test, saaf errors, usage, cursor, linking, mobile setup, button design) — sab ho chuka hai.
