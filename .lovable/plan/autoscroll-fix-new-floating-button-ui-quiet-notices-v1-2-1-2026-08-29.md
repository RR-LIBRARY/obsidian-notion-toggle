# Autoscroll fix + new floating button UI + quiet notices (v1.2.1)

## 1. Autoscroll chalta hi nahi — asli wajah

`findScrollContainer()` reading mode me `view.previewMode.containerEl` lauta raha hai.
Ye wrapper element hai, scroller nahi — mobile par asli scroller uske andar
`.markdown-preview-view` hota hai. Wrapper par `scrollTop` set karne se kuch nahi
hota, isliye notice to aata hai ("Autoscroll forward ↓ · 60 px/s") par page hilta
nahi. Screenshot 3 me bilkul yahi ho raha hai.

Fix:

- Container chunte waqt sirf woh element lo jo **actually scroll** karta ho
  (`scrollHeight - clientHeight > 2`) — wrapper, `.markdown-preview-view`,
  `.markdown-preview-sizer` ka parent, `.cm-scroller`, sab candidates me se pehla
  scrollable.
- Har frame par verify: agar `scrollTop` set karne ke baad value badli hi nahi,
  to container dobara dhoondho (view lazy render hone par bhi kaam karega).
- Live-preview (`.cm-scroller`) ke liye wahi scrollable check.

## 2. Floating button ka naya UI (last screenshot jaisa)

- Bahar safed/soft circular halo, andar **orange rounded-square** icon —
  running me ⏸ (do bars), rukne par ▶.
- Ek hi button, position bottom-right, size screenshot ke hisaab se
  (halo ~72px, andar ka squircle ~46px, radius ~14px).
- Icon SVG se banega (emoji glyph ki jagah) taaki mobile par sharp dikhe.
- Colour theme tokens se derive honge (accent = orange fallback), dark/light dono
  me theek.

## 3. Auto-hide logic dobara pakka karna

- Running me 3s inactivity ke baad fade out (invisible + non-clickable).
- Screen par kahin bhi tap / scroll / pointer move → turant wapas, timer reset.
- Paused ho to pinned (kabhi hide nahi).
- Sheet khuli ho to bhi pinned.
- Autoscroll ke apne programmatic scroll ko "activity" na mana jaye — abhi loop
  ka scroll bhi `scroll` event firing karta hai jo button ko hamesha jaga ke
  rakhta hai; isliye programmatic scroll ko ignore-flag se filter karenge.

## 4. Notices kam karna (screenshot 3 wale popup)

- Start par sirf **ek** chhota notice (ya bilkul nahi) — `sessionLabel` wala lamba
  notice hata kar FAB par hi state dikhegi.
- "Is note me koi toggle nahi mila — plain scroll chalu" wala notice band; plain
  note bas chup-chaap scroll hoga.
- Direction / speed / filter change ke notices bhi sheet khuli ho to skip.
- Naya setting: **"Quiet mode"** (default ON) — sirf error notices dikhenge.

## 5. Verification (test + code read)

- **Pause-at modes**: every / odd / even / custom / route / shuffle — waypoint
  order, dwell time, A4 tall-page chunking, loop-route.
- **Toggle types**: `!note` `!question` `!info` + custom + raw `<details>` sab
  stop bante hain; nested me sirf outermost.
- **Plain text note**: bina toggle ke end-to-end scroll (notice ke bina).
- **Quiz**: har question ka answer time par khulta hai, per-question `⏱30`
  override, auto-next, loop, pause/resume ke baad timer sahi, stop par toggles
  ki purani open/closed state restore.
- **Auto-hide + hold-to-pause**: unit tests + live check.
- Ek chhota headless harness (jsdom-style fake container) jisme scroll loop ke
  frames chala kar prove kiya jaye ki `scrollTop` sach me badh raha hai — yahi
  test aage regression pakdega.
- `QA-REPORT.md` update, version 1.2.1 (manifest/package/versions), `main.js`
  rebuild, aur GitHub par commit + release assets (workflow already set).

## Technical notes

- `main.ts`: `findScrollContainer()` scrollable-pick + per-frame revalidate;
  `scrollProgrammatic` flag; quiet-notice helper `say()`; `scrollQuiet` setting.
- `src/scroll-fab.ts`: SVG icon markup, pinned-while-sheet-open, wake listener
  programmatic-scroll ko ignore kare.
- `styles.css`: naya halo + orange squircle FAB styling, purana emoji styling
  hata do.
- `tests/`: naya `tests/scroll-loop.test.ts` (fake container advance) aur
  `verify-v120` extend for pause-at modes.
