# Notion Toggle — Poora Manual (v1.1.6)

> **v1.4.10** — bug fix: autoscroll ab galat wrapper par scroll nahi likhta (mobile me "chalta hai par hilta nahi" gaya), aur quiz reveal zaroorat padne par toggle ko sach me kholta hai — koi question chhupa nahi rehta. Kuch bhi scroll na hone par run 3s me saaf message ke saath rukta hai.

Ye manual me **har ek setting** ka matlab, use karne ka tarika aur recommended value hai —
exactly usi order me jaisa Obsidian ke settings tab me dikhta hai.

Format har setting ke liye:

- **Kya hai** — setting karta kya hai
- **Kaise use karo** — kab on/off karo, kya value rakho
- **Default** — plugin ka default

---

## 1. Install aur enable

### 1.1 BRAT se (recommended, auto-update)

1. Community plugin **BRAT** install karo.
2. BRAT → **Add a beta plugin** → paste karo:
   ```
   RR-LIBRARY/obsidian-notion-toggle
   ```
3. *Enable after installing the plugin* checked rakho → **Add plugin**.
4. Baad me update: BRAT → **Check for updates**.

> **Agar BRAT bole "A manifest.json file does not exist in the latest release"**
> Latest GitHub release me `manifest.json`, `main.js`, `styles.css` **release assets**
> ke roop me hone chahiye (sirf repo file kaafi nahi). v1.1.4 me teeno attached hain.
> Phir bhi error aaye: BRAT → entry remove karo → dobara add karo → Obsidian restart.

### 1.2 Manual install

1. [Latest release](https://github.com/RR-LIBRARY/obsidian-notion-toggle/releases/latest)
   se `main.js`, `manifest.json`, `styles.css` download karo.
2. Copy karo `<vault>/.obsidian/plugins/notion-toggle/` me (folder bana lo).
3. Obsidian → **Settings → Community plugins → Reload** → **Notion Toggle** ON.

Mobile par bhi wahi folder path chalta hai (file manager ya vault sync se).

### 1.3 Settings kahan khulti hai

`Settings ⚙ → Community plugins → Installed plugins → Notion Toggle` ke saamne
**⚙ Options** button → wahi plugin ka poora settings page hai.

Sab kuch `.obsidian/plugins/notion-toggle/data.json` me save hota hai.
Autoscroll ka **speed / direction / hold** har note ke liye alag bhi yaad rehta hai.

### 1.4 Settings page ka map (6 sections)

1. Toggle basics (heading nahi hai — page ke top par)
2. **Recall timer (Pomodoro)**
3. **Timer focus guard (v1.0.6)**
4. **Minimal mode & spaced repetition**
5. **Auto-scroll revision**
6. **Quiz mode**

Plan persistence, plan toast aur one-tap resume (v1.4.3) → section **6.3**.

---

## 2. Toggle basics (page ka top hissa)

### Toggle colour
- **Kya hai:** naya toggle kis rang me banega. Traffic-light system: 🔴 red = hard,
  🟡 yellow = revise, 🟢 green = mastered. Extra: 🔵 concept, 🟣 theory, 🟠 formula,
  ⚪ extra, ⬛ plain (clean black Notion look).
- **Kaise use karo:** "Default (callout type below)" rakho to niche wala *Default callout type*
  use hoga. Agar aap sab notes colour-code karte ho to seedha red/yellow/green choose karo.
- **Default:** Default (callout type below)

### Auto-numbering
- **Kya hai:** naye toggles ko `1.`, `2.`, `3.` … automatic number milta hai.
- **Kaise use karo:** ON rakho — number khud type karne ki zarurat nahi. Gap aa jaye to
  command **Renumber toggles in note** chalao.
- **Default:** OFF

### MCQ options
- **Kya hai:** naye MCQ toggle me kitne checkbox options banenge (2–6).
- **Kaise use karo:** exam pattern ke hisab se — 4 standard hai.
- **Default:** 4

### Match the following rows
- **Kya hai:** naye "Match the following" table me kitni rows aayengi (2–8).
- **Kaise use karo:** 4 se shuru karo; zarurat pade to row command se add kar lo.
- **Default:** 4

### Auto-add Answer line
- **Kya hai:** naye MCQ / match toggle ke andar `**Answer:** ` line khud add ho jati hai.
- **Kaise use karo:** ON rakho — answer key likhne ki jagah ready milti hai.
- **Default:** ON

### Default callout type
- **Kya hai:** toggle insert/wrap karte waqt kaun sa callout type use hoga (`question`,
  `note`, `tip`, …).
- **Kaise use karo:** revision ke liye `question` best hai.
- **Default:** question

### Default collapsed
- **Kya hai:** ON = toggle band (answer chhupa) start hota hai. OFF = khula.
- **Kaise use karo:** active recall ke liye ON hi rakho.
- **Default:** ON

### Auto-continue on Enter
- **Kya hai:** toggle ke andar Enter dabao to answer likhna continue hota hai; khali toggle
  line par Enter dabao to **agla** toggle shuru ho jata hai.
- **Kaise use karo:** ON — tez typing ke liye sabse kaam ki setting.
- **Default:** ON

### Toggle format
- **Kya hai:** `Native callout (> [!question]-)` ya `HTML <details>`.
- **Kaise use karo:** Native callout hi rakho (Obsidian me properly fold hota hai).
  `<details>` sirf tab jab aapko web/Notion export chahiye.
- **Default:** Native callout

### Bold the question/summary
- **Kya hai:** toggle ka title automatic `**bold**` ho jata hai (already bold ho to skip).
- **Kaise use karo:** ON karo agar aapko question headings mote chahiye.
- **Default:** OFF

---

## 3. Recall timer (Pomodoro)

### Preset
- **Kya hai:** ready rhythm — jaise "Classic 25 / 5". Custom choose karke apne minutes set kar sakte ho.
- **Kaise use karo:** Classic 25/5 se shuru karo; koi bhi minute slider hilaya to preset khud
  "Custom" ho jata hai.
- **Default:** Classic 25 / 5

### Focus minutes
- **Kya hai:** ek focus/recall session ki length (5–90 min).
- **Kaise use karo:** 25 standard; heavy revision ke liye 45–50.
- **Default:** 25

### Short break minutes
- **Kya hai:** har focus session ke baad chhota break (1–30 min).
- **Default:** 5

### Long break minutes
- **Kya hai:** poora cycle khatam hone par bada break (5–60 min).
- **Default:** 15

### Sessions before long break
- **Kya hai:** kitne focus sessions se ek cycle banti hai (1–8).
- **Default:** 4

### Auto-start next phase
- **Kya hai:** ek phase khatam hone par next phase khud shuru ho jata hai.
- **Kaise use karo:** ON = non-stop study rhythm. OFF = aap manually start karoge.
- **Default:** ON

### Notice on phase end
- **Kya hai:** phase end par notice, jisme aapke 🔴/🟡/🟢 toggle counts dikhte hain.
- **Kaise use karo:** ON — session ka instant report card milta hai.
- **Default:** ON

### Vibrate / buzz on phase end
- **Kya hai:** mobile par chhoti vibration jab phase khatam ho.
- **Default:** ON

### Show timer on startup
- **Kya hai:** Obsidian khulte hi floating timer dikh jata hai.
- **Kaise use karo:** OFF rakho agar screen clean chahiye; ON rakho agar roz timer se padhte ho.
- **Default:** OFF

### Compact timer by default
- **Kya hai:** sirf ghadi (chhoti pill) dikhati hai — mobile par handy.
- **Default:** ON

### Reset timer position (page ke sabse niche)
- **Kya hai:** floating timer screen se bahar chala gaya ho to use wapas top-left le aata hai.
- **Kaise use karo:** timer gayab lage to "Reset position" dabao.

---

## 4. Timer focus guard (v1.0.6)

### Auto-pause when you leave
- **Kya hai:** Obsidian background me jaye ya aap switch karo to timer pause ho jata hai.
- **Kaise use karo:** ON — focus time honest rehta hai.
- **Default:** ON

### Pin session to its note
- **Kya hai:** sirf wahi note focus time count karta hai jahan session shuru hua tha.
- **Kaise use karo:** ON agar ek subject ek session me padhte ho.
- **Default:** ON

### Auto-resume when you return
- **Kya hai:** session note par wapas aate hi timer khud continue ho jata hai.
- **Kaise use karo:** ON agar aap tab switch bahut karte ho.
- **Default:** OFF

### Collapse toggles on break
- **Kya hai:** focus phase khatam hone par saare answers dobara chhup jate hain.
- **Kaise use karo:** ON — next round fresh active recall banta hai.
- **Default:** OFF

### Idle pause (minutes)
- **Kya hai:** itni der inactivity ke baad focus phase pause. `0` = feature off.
- **Kaise use karo:** 2 theek hai; 0 karo agar aap reading me scroll nahi karte.
- **Default:** 2

---

## 5. Minimal mode & spaced repetition

### Minimal command names
- **Kya hai:** 4 primary commands (Toggle, Colour, Recall, Review) clean rehte hain, baaki sab
  `Advanced:` prefix ke saath — toolbar clutter-free.
- **Kaise use karo:** ON rakho (mobile toolbar ke liye best). Naam refresh hone ke liye Obsidian restart karo.
- **Default:** ON

### Ask for a grade after each focus phase
- **Kya hai:** timer par Again / Hard / Good / Easy dikhta hai; SM-2 aapki next recall date khud calculate karta hai.
- **Kaise use karo:** ON — spaced repetition tabhi kaam karega.
- **Default:** ON

### Recall schedule
- **Kya hai:** kaun se notes recall ke liye scheduled hain. Note rename/move karne par schedule saath chalta hai.
- **Kaise use karo:**
  - **Clean up** — delete ho chuke notes ke schedules hata deta hai.
  - **Clear all** — poora schedule wipe (dhyan se, undo nahi hai).
- Due notes dekhne ka command: **Show notes due for recall**.

---

## 6. Auto-scroll revision (main feature)

Start karne ke 4 tareeke:

1. **Settings switch (v1.1.6)** — `Settings → Community plugins → Notion Toggle → Options → Auto-scroll revision` → sabse pehla toggle **Autoscroll running**. ON = start, OFF = stop. Command palette ki zaroorat nahi.
2. **Hotkey (v1.1.6)** — `Ctrl/Cmd + Shift + S` = start / pause, `Ctrl/Cmd + Shift + R` = reverse, `Ctrl/Cmd + Shift + A` = autoscroll sheet. Clash ho to `Settings → Hotkeys` me badal lo.
3. **Floating ▶ button** — neeche 6.0 dekho.
4. **Command** — *Autoscroll (start / pause revision)*.

Session chalu hone par ek floating bar aata hai (44px buttons, mobile safe-area aware).

### 6.0.-1 Agar kuch na ho (v1.1.6 messages)

| Message | Matlab |
|---|---|
| `Autoscroll band hai — pehle "Autoscroll (start / pause revision)" chalao (Ctrl/Cmd+Shift+S), ya floating ▶ dabao.` | Aapne reverse / faster / slower / stop chalaya par session start hi nahi hua tha. |
| `Is note me koi toggle nahi mila — callout (> [!note]- …) ya <details> banao, phir autoscroll chalao.` | Note me koi toggle hi nahi hai. |
| `No toggles match this selection (… · …) — filter ya pause-at mode badlo.` | Toggle hain, par colour filter / pause-at mode sabko chhod raha hai. |

### 6.0 Floating ▶ button (v1.1.5, v1.1.6 me upgrade) — sabse aasaan tareeka

Note khulte hi **bottom-right me ek gol ▶ button** dikhta hai (mobile par safe-area aware):

| Gesture | Kaam |
|---|---|
| **Tap** | Autoscroll start / pause |
| **Long-press (aadha second dabaye rakho)** | **Autoscroll sheet** khulti hai — saare controls ek jagah |
| **Chhote ↑/↓ chip par tap (v1.1.6)** | Direction turant flip — ↓ forward, ↑ reverse (chip accent colour me highlight hota hai) |

- v1.1.6 se ye button **session chalne par bhi screen par rehta hai** (floating bar ke thoda upar) — pause aur reverse ek tap me, toolbar icon dobara khole bina.
- Band karna ho to: Settings → Notion Toggle → *Auto-scroll revision* → **Floating autoscroll button** toggle OFF.

**Autoscroll sheet me kya-kya milta hai:** Start/Pause button, Speed (0.02x–20x), Pause for, Pause at (odd/even/custom/route/shuffle), Colour filter, Reverse ↑, Loop the note, Auto-open / Auto-close, Tall toggles screen-by-screen, Debug overlay, aur neeche *Go to first* / *Stats* / *Toolbar guide* shortcuts. Yehi sheet command se bhi khulti hai: **Autoscroll: sheet (all controls)**.

### 6.0.1 Mobile toolbar guide (v1.1.5) — kaunsi commands add karni hain

Command palette ya settings se **Autoscroll: mobile toolbar guide** kholo. Isme:

1. Seedhe steps likhe hain: **Settings ⚙️ → Mobile → Manage toolbar → Add command**.
2. **One-tap checklist** — jis command ko toolbar me add kar liya, us row ka toggle ON kar do (✓). List `data.json` me save rehti hai, baad me wapas kholo to progress wahi se dikhti hai.
3. **Open settings** button Obsidian settings kholne ki koshish karta hai (version support kare to seedha Mobile tab).
4. **Reset checklist** se list dobara shuru.

Sabse zaroori command sirf ek hai — **Autoscroll (start / pause revision)**; baaki (sheet, reverse, filter, pause at, pause for, speed presets, go to first, stats, stop) zaroorat ke hisaab se add karo. Guide me har command ke saamne uska reason bhi likha hai.

### 6.1 Floating bar

| Control | Kaam |
|---|---|
| ▶ / ⏸ | Scroll start / pause |
| − / + | Speed kam / zyada (0.02x … 20x) |
| ↑ / ↓ | Direction reverse |
| 🔴🟡🟢 | Colour filter |
| ⤒ | Pehle toggle par jump |
| ✕ | Stop + cleanup |

### 6.2 Settings ek-ek karke

#### Scroll speed
- **Kya hai:** pixels-per-second jis speed se page next toggle tak glide karta hai (1 … 1200 px/s).
- **Kaise use karo:** slider mote adjustment ke liye; exact multiplier chahiye to niche
  *Speed presets* use karo. Mobile par 40–80 comfortable hai.
- **Default:** 60 px/s (= 1x)

#### Hold time on each toggle
- **Kya hai:** khula toggle kitne second dikhta rahe uske baad aage badhe (0–30 s slider).
- **Kaise use karo:** short Q&A = 3–5 s; long theory = 10–15 s.
- **Default:** 4 s

#### Reverse direction
- **Kya hai:** bottom → top scroll, fast backwards revision ke liye.
- **Kaise use karo:** last-minute revision me ON — aapko chapter ulta dikhta hai to recall strong hota hai.
- **Default:** OFF

#### Colour filter → "Choose colours"
- **Kya hai:** autoscroll sirf chuni hui colour wale toggles par rukega.
- **Options:** ⚪ All toggles · 🔴 Red only · 🟡 Yellow only · 🟢 Green only ·
  🔴🟡 Red + Yellow (weak spots) · 🔴🟡🟢 All graded toggles.
- **Kaise use karo:** exam se pehle **Red + Yellow** — sirf weak spots revise honge.
- **Default:** All toggles

#### Open the toggle automatically
- **Kya hai:** toggle par pahunchte hi wo khud khul jata hai (answer dikh jata hai).
- **Kaise use karo:** ON = hands-free reading. OFF karo agar pehle khud soch kar phir kholna ho.
- **Default:** ON

#### Close it again when leaving
- **Kya hai:** toggle chhodte waqt wapas band ho jata hai — ek time par ek hi answer visible.
- **Kaise use karo:** ON — active recall honest rehta hai.
- **Default:** ON

#### Loop the note
- **Kya hai:** note khatam hone par rukne ke bajaye doosre end se dobara shuru.
- **Kaise use karo:** ON for endless revision loop (background revision ke liye).
- **Default:** OFF

#### Pause at → "Choose mode"
- **Kya hai:** autoscroll kaun se toggles par rukega.
- **Modes:**
  - **∞ Every toggle** — sab par.
  - **1️⃣ Odd toggles** — 1, 3, 5 …
  - **2️⃣ Even toggles** — 2, 4, 6 …
  - **✍️ Custom list** — apne numbers, e.g. `2, 5, 9`.
  - **🧭 Route (my own order)** — apna visit order, e.g. `7, 2, 9, 2`. Har leg ka direction
    khud calculate hota hai (neeche → upar → neeche).
  - **🔀 Shuffle (weakest first)** — FSRS-weighted order: due aur weak toggles pehle,
    naye toggles beech me mix, session ke andar deterministic.
- Isi modal ke andar milta hai:
  - **Custom list** text box
  - **Route** text box
  - **Loop the route** toggle
  - **Shuffle range** — `from` / `to` toggle numbers (`0` = poora note)
  - **Deck summary** + **Due next 7 days** forecast
  - **Tall toggles screen-by-screen** toggle
- **Default:** Every toggle

#### Pause for → "Choose time"
- **Kya hai:** har stop par hold time, 1 second se 1 hour tak ladder me
  (1–10s, 12/15/20/25/30/40/45/50/60s, 90s … 30min … 1h).
- **Kaise use karo:** MCQ drill = 3–5s; long answer padhna = 60–120s;
  "poori page padhne do" = 5–10 min.
- **Default:** 4 s

#### Speed presets → "Choose speed"
- **Kya hai:** reading speed ka multiplier — chips:
  `0.02x, 0.05x, 0.1x, 0.2x, 0.5x, 0.75x, 1x, 1.5x, 2x, 3x, 5x, 7x, 10x, 20x`.
- **Kaise use karo:** 0.02x–0.2x = sach me dheere padhne wala creep (sub-pixel movement);
  1x = normal; 5x–20x = fast skim/revise.
- **Default:** 1x

#### Tall toggles screen-by-screen
- **Kya hai:** bade/A4-size answers viewport ke hisab se chunks me tootte hain — ek screen
  poori padhne ke baad hi agli screen aati hai.
- **Kaise use karo:** ON rakho, warna lamba answer beech se skip ho sakta hai.
- **Default:** ON

#### Loop the route
- **Kya hai:** route / shuffle run khatam hone par rukne ki jagah shuru se restart.
- **Default:** OFF

#### Auto-grade during shuffle
- **Kya hai:** jis toggle par aap zyada der ruke wo jaldi wapas aata hai; jo turant chhoda
  wo door chala jata hai (dwell time → FSRS grade).
- **Kaise use karo:** ON — shuffle khud aapki weakness seekhta hai.
- **Default:** ON

#### New toggles mixed into shuffle
- **Kya hai:** shuffle me naye (kabhi revise na kiye) toggles ka share. `0` = sirf purane
  revise, `1` = naye pehle.
- **Kaise use karo:** naya chapter likha hai to 0.5–0.7; exam-revision me 0.1–0.2.
- **Default:** 0.35

#### Weak toggles / priority → "Show stats"
- **Kya hai:** stats panel — shuffle kis logic se pick karta hai (recall %, difficulty, lapses).
- Command se bhi khulta hai: **Autoscroll: revision stats (weak toggles)**. Detail section 8 me.

#### Debug overlay
- **Kya hai:** autoscroll chalne ke waqt live loop state screen par: position, direction,
  `waypointReached` / `crossedTarget`, dwell key, grade — aur v1.4.9 se **stop index,
  anchor position, portrait/landscape orientation, skip count aur reverse-leg info**.
- **Kaise use karo:** normally OFF. Tuning/bug dhundhne ke waqt ON. Detail section 7 me.
- **Default:** OFF

#### Revision memory → "Reset for this note"
- **Kya hai:** is note ka shuffle memory (FSRS cards, visit history) wipe.
- **Kaise use karo:** stats galat lagen ya note pura rewrite kiya ho to reset karo.

---

## 6.3 Plan persistence aur one-tap resume (v1.4.3)

Autoscroll ka poora **plan** ab `data.json` me save hota hai — Obsidian band karke
dobara kholo, plugin reload karo, ya phone restart karo: plan waisa ka waisa milta hai.

### Kya-kya save hota hai
- **Pause-at mode** — every / odd / even / custom / 🧭 route / 🔀 shuffle
- **Custom list** — `2, 5, 9` jaise numbers (range bhi chalta hai: `3-5` = 3, 4, 5 — v1.4.6)
- **Route (my own order)** — aapka hand-written order, e.g. `7, 2, 9, 2`
- **Loop the route** — ON/OFF
- **Shuffle range** — `from` / `to` (`0` = poora note)
- **Colour filter** — 🔴 / 🟡 / 🟢 selection
- **Direction (Reverse ↑), speed aur hold** — ye per-note bhi yaad rehte hain
- **Shuffle memory** — FSRS cards aur visit history, per note

### Route shuffle ke baad kho nahi jata
Shuffle mode `Route` list ko apne weighted order se overwrite karta hai. v1.4.3 se
aapka **typed route alag** (`scrollUserRoute`) save hota hai, isliye jab aap wapas
🧭 **Route** par tap karte ho to aapka original order hi return hota hai — reload ke
baad bhi.

- **Kya hai:** typed route ka backup jo shuffle overwrite nahi karta.
- **Kaise use karo:** shuffle chala kar dekho, phir Route par tap karo — aapka
  `7, 2, 9, 2` wapas aa jayega.

### Plan toast (confirmation line)
Jab bhi mode, **Loop the route**, ya **Shuffle range** badalta hai, ek chhoti line
dikhti hai:

```
Plan: route (7, 2, 9) · loop ON
Plan: shuffle (weakest first) · loop OFF · range 2–6
Plan: shuffle (weakest first) · loop OFF · range: whole note
Plan: every toggle
```

- **Kya hai:** confirm karta hai ki loop aur range ab kya hain — pehle ye chup-chaap
  badal jate the.
- **Kaise use karo:** Auto-scroll revision → **Quiet mode** default ON hai, isliye
  ye toast tabhi dikhega jab aap Quiet mode **OFF** karoge.

### One-tap resume
- **Kya hai:** agar plan khali hai (custom/route list empty) to sheet me warning ki
  jagah ab ek button milta hai: **▶ Resume with every toggle**.
- **Kaise use karo:** ek tap — mode `every toggle` ho jata hai, plan save hota hai,
  autoscroll turant start ho jata hai aur sheet band. Numbers dobara type karne ki
  zaroorat nahi.
- **Kahan:** Autoscroll sheet → "Pause at" ke just niche (sirf tab dikhta hai jab
  list khali ho).

### Reload ke baad kya resume hota hai, kya nahi
| Reload ke baad | Behaviour |
|---|---|
| Mode, route, loop, shuffle range, filter | ✅ waise ke waise restore |
| Speed / direction / hold (per note) | ✅ restore |
| Shuffle FSRS memory | ✅ restore (reset sirf manually) |
| Running/paused state | ▶ tap se ek hi tap me resume — scroll khud se start nahi hota |
| Note me current pixel position | Obsidian ke apne scroll restore par depend karta hai |

### Kharaab data se safety
Purani ya hand-edited `data.json` me agar route/picks me junk ho (text, `0`,
negative numbers) to load par wo saaf ho jate hain — plugin crash nahi karta,
sirf valid toggle numbers rehte hain.

---


## 6.4 v1.4.6 me kya theek hua (plan behaviour)

- **Range wali custom list** — ab `3-5`, `3–5` ya `3 to 5` likho to beech ka toggle
  (4) bhi plan me aata hai. Pehle sirf 3 aur 5 lagte the.
- **Damaged plan ab "every toggle" par girta hai** — agar saved mode kisi wajah se
  kharab ho jaye (purani key, aadha likha data), plan pehle chup-chaap *odd toggles*
  ban jata tha aur aadha note skip hota tha. Ab wo **every toggle** par jaata hai,
  yaani kuch bhi chhutta nahi.
- **Reverse ↑ run ka pehla stop** — agar aap note ke bilkul top par ho aur reverse
  chalu karo, run ab sabse ooncha stop pakadta hai (pehle neeche wala stop target ban
  jata tha aur hold/pause skip ho jata tha).

Details: `issue.md` (issue register) aur `Test-Verify.md` (verification report).

## 7. Debug overlay kaise padhein

ON karke autoscroll chalao — top-right me kuch aisa aayega:

```
pos 120.40 → top 120 / 2000    dir ↓  frac 0.40
leg 2/3 → target 880 · screen 2/2
dwellKey 3:1 · paused 2.5s
event crossedTarget 3:1
grade toggle 3 · 6.2s → Good (3)
progress 7/18
```

- `pos` — float scroll position (sub-pixel), `top` — actual DOM scrollTop.
- `dir` / `frac` — direction aur frame ka fractional movement (slow speeds isi se chalti hain).
- `leg` — route/shuffle ka konsa leg, target pixel, aur tall-toggle ka screen number.
- `dwellKey` — kis stop par ruke hain aur kitna time bacha.
- `event` — `waypointReached` / `crossedTarget` fire hua ya nahi.
- `grade` — dwell se banaya gaya FSRS grade.

### v1.4.9 — stop / anchor / skip lines

Ab overlay me ye extra lines bhi aati hain:

```
stop 7/23 · key 7:0 · visited 6 · pending 17
anchor middle → top 1842 (offset 312 from toggle top)
orientation portrait · 1080x2160 · same-math ✔ · layout a1f3
skips 2 recovered · last 6:0, 7:0
reverse ↑ · dwell guard scoped to up-leg · wraps to stop 22
```

- `stop` — abhi kis stop par ho (`nth/total`), uska dwell key, is leg me kitne
  visit ho chuke aur kitne baaki hain.
- `anchor` — settings ka anchor (Top edge / Upper third / Middle / Lower third),
  woh anchored scroll offset jispar loop park karta hai, aur toggle ke apne top se
  uska distance. Ye wahi number hai jo loop khud use karta hai — koi doosra
  calculation nahi, isliye overlay kabhi drift nahi karega.
- `orientation` — portrait ya landscape, scroll container ke apne box se. Saath me
  viewport size aur layout signature — rotation ke baad agar remeasure nahi hua to
  yahi line pakad legi (`layout` same reh jayega).
- `skips` — layout shift se peeche chhoot gaye stops jo recover kiye gaye, aur last
  teen keys. Agar leg khatam hone tak koi stop bacha ho to `⚠ N stop(s) still
  unvisited on this leg` warning aati hai.
- `reverse` — sirf up-legs par: direction arrow, reverse-specific dwell scoping,
  aur wrap fallback stop. Portrait/landscape aur reverse — teeno same read-out.

---

## 8. Weak-toggle stats panel

Command: **Autoscroll: revision stats (weak toggles)** (ya settings → *Show stats*).

Dikhata hai:

- **Deck summary** — total / due / new / learned counts.
- **Due next 7 days** — 7 din ka forecast.
- Har weak toggle ki row: `#7 · 42% recall · D 7.4 · S 3.1d · 2 lapses`
- Aur plain-language reason: *"forgotten 2× — kept close"*,
  *"never revised — new toggles get mixed in first"*.

Priority FSRS scheduler se aati hai (recall probability, difficulty, stability, reps, lapses).

---

## 9. Quiz mode

Command: **Quiz (timed question run)**.
HUD: `00:14 · Q 3/12` + pause / 👁 reveal now / ⏭ next / ✕ stop.

Flow: question par countdown → time up → answer auto-reveal → reveal time ke baad toggle
auto-close → agla question auto-scroll ke saath.

> **v1.4.10 — reveal ka rule (koi question chhupa nahi rehta):** reveal hamesha pehle sirf
> plugin classes lagata hai (screen blink nahi hoti, aapka fold state intact rehta hai). Agar
> Obsidian ne callout ko natively collapsed render kiya hai (ya quiz ke beech re-render se
> wapas band aa gaya), to plugin **khud toggle ko sach me kholta hai** — answer screen par
> aana guaranteed. Re-render ke baad question ki jagah title se dobara dhoondha jata hai
> (heal), isliye mid-run section replace hone par bhi question skip nahi hota.
>
> **Verified (v1.4.10):** quiz ke saare 9 specs — engine (`quiz`), DOM (`quiz-dom`),
> visibility (`quiz-visibility`), re-render heal (`quiz-heal`), timing accuracy
> (`quiz-timing`), force-open (`quiz-force-open`), dock UI, ring badge, poora end-to-end flow
> — **110 pass / 0 fail**.

### Time per question
- **Kya hai:** answer reveal hone se pehle kitne second (3 … 600 s; slider 3–120).
- **Kaise use karo:** MCQ = 15–20 s; long answer = 45–90 s.
  Toggle ke title me `⏱30` / `[30s]` / `(30s)` / `@20s` likho to us question ka apna time.
- **Default:** 20 s

### Answer time
- **Kya hai:** reveal hua answer kitne second khula rahe (1–60 s).
- **Kaise use karo:** 5 s quick check ke liye; 15 s agar answer lamba hai.
- **Default:** 5 s

### Go to the next question automatically
- **Kya hai:** answer ke baad khud agla question.
- **Kaise use karo:** ON = hands-free exam drill. OFF = aap ⏭ se manually badhoge.
- **Default:** ON

### Close the toggle after the answer
- **Kya hai:** ek time par ek hi answer visible rehta hai.
- **Default:** ON

### Use the colour filter
- **Kya hai:** quiz sirf autoscroll ke chune hue colours par chalega (🔴/🟡/🟢).
- **Kaise use karo:** ON + filter Red+Yellow = weak-spot quiz.
- **Default:** ON

### Loop the quiz
- **Kya hai:** khatam hone par pehle question se dobara.
- **Default:** OFF

### Open with autoquiz (keep answers open)
- **Kya hai:** poori quiz me har answer toggle khula rehta hai, kabhi band nahi hota —
  reading mode jaisa, bas upar timer chalta hai.
- **Kaise use karo:** revision day par ON, exam drill par OFF.
- **Default:** OFF

### Notify when the time is up
- **Kya hai:** time up par notice/buzz.
- **Default:** ON

Time badalne ka fast tarika: command **Quiz: set time per question**
(presets 10 / 15 / 20 / 30 / 45 / 60 / 90 + custom).

---

## 10. Commands (mobile toolbar me add karne layak)

Mobile: `Settings → Mobile → Manage toolbar` → ye commands add karo.

| Group | Command |
|---|---|
| Primary | Toggle (smart add) · Colour (red → yellow → green) · Recall (start / pause session) · Review (spaced repetition) |
| Authoring | Insert toggle (empty) · Wrap selection as toggle · Quick Q&A toggle (prompt) · New toggle below · Insert numbered toggle · Renumber toggles in note |
| MCQ / Match | Insert MCQ toggle · Add MCQ option · Toggle option checkbox · Insert Match the following toggle · Insert answer key line |
| Convert | Convert `<details>` blocks to callouts · Convert callouts to `<details>` blocks |
| Colour | Set toggle colour · Cycle toggle colour · Toggle auto-numbering |
| Timer | Timer: show / hide · start / pause · reset phase · skip phase · start recall session on this note · stop session |
| Autoscroll | Autoscroll (start / pause revision) · reverse direction · choose colour filter · faster · slower · stop · pause at · pause for · speed presets · go to first toggle · smart shuffle · reset revision memory · revision stats |
| Quiz | Quiz (timed question run) · pause / resume · reveal the answer now · next question · stop · set time per question |
| SRS | Show notes due for recall |

*Minimal command names* ON hone par advanced commands `Advanced:` prefix ke saath dikhte hain.

---

## 11. Ready-made recipes

**A. Fast revise (exam se ek din pehle)**
Speed presets `5x` · Pause for `3s` · Colour filter `Red + Yellow` ·
Auto-open ON · Auto-close ON · Tall toggles ON.

**B. Slow deep read (naya chapter)**
Speed presets `0.1x` · Pause for `60s` · Pause at `Every toggle` ·
Tall toggles screen-by-screen ON · Loop the note OFF.

**C. Weak-only shuffle drill**
Pause at → `Shuffle (weakest first)` · Auto-grade ON · New-toggle mix `0.15` ·
Shuffle range `0/0` (poora note) · Loop the route ON.

**D. Exam-style quiz run**
Quiz: Time per question `20s` · Answer time `5s` · Auto next ON ·
Close after answer ON · Use colour filter ON (Red+Yellow) · Notify ON.
Lambe questions ke titles me `⏱60` laga do.

---

### Worked autoscroll settings (copy karke try karo)

| Kaam | Speed | Pause at | Dwell | Anchor | Baaki |
|---|---|---|---|---|---|
| Raat me revision (dhyaan se padhna) | `0.1x` | Every toggle | 6s | `third` | Open toggle automatically ON |
| Fast skim (kya aata hai check karna) | `0.5x` | Red + Yellow only | 2s | `top` | Auto-close after dwell ON |
| Lambe notes, screen-by-screen | `0.15x` | Every toggle | 4s | `middle` | Tall toggles screen-by-screen ON |
| Sirf weak toggles (SRS due) | `0.2x` | Shuffle route | 8s | `middle` | Revision memory ON |
| Mobile, ek haath se | `0.05x` | Every toggle | 5s | `middle` | Hold-to-pause ON, FAB ON |

---

## 12. Troubleshooting

| Problem | Fix |
|---|---|
| BRAT: "no manifest.json in latest release" | Latest release me assets attached hain; BRAT me plugin remove karke dobara add karo, phir restart. |
| Settings dikh hi nahi rahi | Community plugins → Notion Toggle ke saamne ⚙ **Options** dabao (plugin ON hona chahiye). |
| "Autoscroll band hai …" notice | Reverse/speed/stop se pehle session start karo — settings ka **Autoscroll running** switch, `Ctrl/Cmd+Shift+S`, ya floating ▶. |
| Hotkey kaam nahi kar raha | `Settings → Hotkeys` → "Autoscroll" search karo; kisi aur plugin se clash ho to naya hotkey assign karo. |
| Autoscroll kuch nahi karta | Note me toggle nahi hai, ya colour filter sabko exclude kar raha hai → filter `All toggles` karo. |
| Mobile par bahut fast | Speed presets `0.05x`–`0.2x`, aur Tall toggles screen-by-screen ON. |
| Toggle khulta nahi | *Open the toggle automatically* ON karo; toggle native callout / `<details>` hona chahiye. |
| Stats galat lag rahe | Auto-scroll revision → **Revision memory → Reset for this note**. |
| Timer screen se gayab | Quiz mode section ke niche **Reset timer position**. |
| Reduced-motion system | Animation skip ho jati hai, stepping phir bhi chalta hai. |
| Reload ke baad route gayab | 🧭 Route par tap karo — typed route ka backup restore ho jata hai (section 6.3). |
| "Add toggle numbers below" warning | Sheet me **▶ Resume with every toggle** dabao — one-tap resume (section 6.3). |
| Loop / range chup-chaap badla lagta hai | Quiet mode OFF karo — har change par plan toast dikhega (section 6.3). |
| **Autoscroll "running" dikhta hai par note hilta nahi** | v1.4.10 me ye theek hua. Agar phir bhi ho: note ko **reading view** me kholo, aur note ek screen se lamba ho. Jab view me scroll karne layak kuch nahi hota, run 3 second baad khud ruk kar saaf message deta hai. |
| Quiz me answer khula hi nahi, timer aage badh gaya | v1.4.10 me theek — reveal ab class ke bharose nahi hai, zaroorat padhe to toggle ko sach me kholta hai. Purani version par ho to update karo. |
| Timer promise se dheema lagta hai | Debug overlay ON karo → **timer accuracy** line promised vs wall-clock dikhati hai (section 7). 3x se zyada late tick ko freeze detector report karta hai — matlab phone throttle kar raha hai, plugin ka bug nahi. |
| Kuch stops chhoot rahe hain | Overlay ki **stop / skip** line dekho: `recovered` count batata hai ki layout shift ne kitne stops peeche chhode aur loop ne kitne wapas liye (section 7). Speed kam karo ya *Tall toggles screen-by-screen* ON karo. |

---

## 13. Dev / release notes

- Build: `bun install && bun run build` → `main.js`
- Tests: `bun test` (664 tests) · Typecheck: `bun run typecheck`
- Real-vault checklist: `SMOKE-TEST.md` (18 steps)
- Release me `manifest.json`, `main.js`, `styles.css` attach hone chahiye —
  `Package Obsidian plugin release` GitHub Action tag push / manual dispatch par ye karta hai
  aur `1.1.4` + `v1.1.4` dono tag styles handle karta hai.


## 6.5 v1.4.7 — screen anchoring, no skipped toggles, performance report

**Toggle ab screen ke beech me khulta hai (portrait *aur* landscape).**
Pehle stop hamesha viewport ke upper-third par park hota tha, isliye landscape
me toggle upar chipak jaata tha aur answer neeche kat jaata tha. Ab har stop ek
*anchor fraction* par park hota hai:

| Setting (Settings → Stop position on screen) | Toggle kahan rukega |
|---|---|
| Top edge | screen ke bilkul upar |
| Upper third | purana v1.4.6 behaviour |
| **Middle (default)** | toggle apne centre se screen ke beech me |
| Lower third | thoda neeche, taaki upar ka context dikhe |

Logic dono orientation me *same* hai — sirf `clientHeight` badalta hai, isliye
phone ghumane par bhi toggle usi screen fraction par rehta hai. Jo toggle screen
se lamba hai uska **top** anchor hota hai (warna sawaal hi upar nikal jaata).
Rotate karte hi layout dobara measure hota hai aur current stop re-anchor ho
jaata hai.

**Toggle skip hona band.**  Teen alag skip sources ab ek hi queue se handle hote
hain:

1. **Ek frame me kai stops** — phone ka lamba frame ya high speed, ya background
   se wapas aana. `crossedTargets()` us frame ke *saare* crossed stops deta hai,
   sirf pehla nahi.
2. **Layout shift** — upar wala toggle khulte/band hote hi neeche ke sab boxes
   hil jaate hain. Cache ab `layoutSignature()` (positions) par keyed hai, count
   par nahi, isliye stale tops kabhi serve nahi hote; playhead ke *peeche* chala
   gaya unvisited stop "missed" maan kar wapas visit hota hai.
3. **Same dwell key** — pehle ek hi key thi; ab per-stop `visited` set hai
   (`page:slice`), isliye ek page ke do slices alag-alag count hote hain.

Har recovered stop report me **Skipped stops** ke roop me ginaa jaata hai — 0
ka matlab kuch bhi miss nahi hua.

**Deep-quiz performance report.**  Command palette → *"Notion Toggle: Quiz
performance report"* ek modal kholta hai jisme:

- **Timer accuracy** — har question/reveal phase ka promised vs wall-clock time,
  mean / p95 drift, total drift aur worst question. Deliberate pause drift me
  count nahi hota.
- **Freezes** — 250ms cadence se 3x se zyada late aaya tick freeze hai; count,
  longest, total aur last 5 events.
- **Render + filter timings** — colour filter, badge render, scroll re-measure
  aur quiz self-heal ke count / avg / p95 / max.
- **Timer paint cadence** — paints, jitter, dropped frames, stability score.
- **Autoscroll** — skipped (recovered) stops.

Modal me **Copy report** aur **Save to note** buttons hain.
