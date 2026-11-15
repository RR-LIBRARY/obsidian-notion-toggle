# Notion Toggle — saare features ek jagah (1.9.24)

Ye file plugin ke **har feature** ki ek list hai. Detail ke liye: [Voice mode manual](VOICE_MODE.md) · [Autoscroll features](AUTOSCROLL_FEATURES.md) · [Hindi guide](HINDI-GUIDE.md).

---

## A. Toggles (Notion jaise)

### Notion / Callout appearance filter (1.9.23)
- Settings → Notion-like writing → **Toggle appearance**: poori note ke liye **Notion toggles** ya **Native callouts** chuniye; preview turant badalta hai.
- **Callout format filter → Choose types** me jin types ko tick karenge (Question, Note, Warning, Red, Green, etc.), sirf wahi native callout rahenge; baaki Notion toggle rahenge.
- Native callout me Obsidian ka icon, rangin background, spacing aur chevron wapas milta hai. **All Notion** aur **All callouts** shortcuts bhi hain.
- Commands: **Appearance: Notion toggles ↔ native callouts** aur **Appearance: choose native callout types**.
- Ye sirf dikhne ka tareeka badalta hai; note ka Markdown aur folding data nahi badalta. Clean editing ka alag setting waisa hi rahta hai.

### Typed note-name linking (1.9.22)
- Default ON: Settings → Notion Toggle → **Auto-link note names while typing** (sabse upar).
- `Physics` note pehle se bana hai: `physics` type karke thoda rukiye → `[[Physics|physics]]`.
- Hindi aur multi-word note names bhi match hote hain; typing / paste ke ~0.5 sec baad link banta hai.
- Voice auto-link setting bilkul alag aur unchanged; internet, voice key ya AI credits nahi lagte.
- Sirf naye likhe/edited words: purane paragraphs apne aap nahi badalte. Current note, existing links, code, URLs aur frontmatter skip hote hain.
- Same title wale multiple notes skip hote hain taaki galat page link na bane. Native Undo kaam karta hai.
- Verification: real CodeMirror typing/cursor/toggle/undo integration tests and browser desktop/mobile checks; real Obsidian phone check still required.

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
| Mic button ON/OFF (1.9.21) | Settings → Voice mode → "Floating mic button" (sabse upar) — OFF karte hi turant chhup jaata hai; command "Voice mode: show / hide floating mic button" |
| Mic button | Lovable jaisa safed gol button, neeche-daayein (autoscroll button ke upar, overlap nahi) |
| Left ribbon / command | "Voice mode: start / finish" |
| Voice card | Beech se phailti wave, ✕ (cancel), ⏸ (pause/resume), ✓ (finish) |
| Live text | Bolte waqt card me text dikhta hai |
| Card hilana | Long-press karke upar/neeche; jagah yaad rahti hai; Reset position |
| Card look | Full / compact, grey / colour wave |
| Cursor se likhna | Jahan cursor hai wahin se text; recording ke beech cursor badlo to agla text wahan |
| Keep screen on | Recording ke dauraan screen jalti rahe |
| Lambi recording (lock/dusri app) | Phone recorder me record → file par "Voice: transcribe to note" → poora text naye note me; ruk jaaye to wahin se aage |
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
| Accurate listening (1.9.20) | Poora vaakya (~6 sec + pause) sun kar likhta hai — galtiyan kam. Settings → "Listening: accurate or fast" |
| "..." nahi | Tukdon ke beech aane wale "..." hata diye jaate hain |
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
| "table banao, columns … Row …" | Markdown table — har row alag line par; baad me bola "row …" usi table me judta hai (1.9.18) |

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
| Text kabhi gum nahi (1.9.19) | Note ka screen badle/band ho to bhi seedha note file me likhta hai; wo bhi na ho to clipboard me copy + message |
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
| Screen lock / dusri app par Android mic rok deta hai | Phone recorder + "transcribe audio file" (1.9.17) | Haan, is raaste se ✓ |
| Offline me live text nahi | Audio save hota hai, baad me likhta hai | Nahi — awaaz Lovable par likhi jaati hai |
| Lovable credits lagte hain | Usage settings me dekhein | Nahi — AI ka kharcha |
| Tez shor me galti | Phone muh ke paas | Thoda |

Jo code se ho sakta tha (offline queue, undo, self-test, saaf errors, usage, cursor, linking, mobile setup, button design) — sab ho chuka hai.

## Number-based appearance and traffic-light review (1.9.24, prepared)
- Appearance → choose toggle numbers (this note): enter Q6–Q11, 13; select native callouts or Notion.
- Review → grade and filter red / yellow / green: grade selected numbers, then show Red, Yellow, Green, Red + Yellow, All graded or All.
- Red = didn’t know; Yellow = half known; Green = known. Ungraded cards appear under All.
- Matching nested cards keep their parent visible; other notes keep their own filters.
- Grading uses a native undoable transaction, not whole-document replacement. Number/appearance changes do not rewrite Markdown.
- Floating voice mic temporarily disappears during active autoscroll. Pause/stop returns it only if enabled.
- See [every command](COMMANDS.md) and [verification report](VERIFY-1.9.24.md).
