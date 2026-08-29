# Minimal Autoscroll UI + smarter FAB behaviour

Screenshot jaisa minimal look: sirf do gol buttons (↓/↑ arrow aur ▶/⏸ play), koi bada control bar nahi. Saare controls long-press par khulne wale sheet me.

## 1. Minimal UI (screenshot ke jaisa)

- Autoscroll chalte waqt jo purana `ntt-scroll-bar` (−, +, 🔴, ∞, ⏱, ⤒, ✕ wala) dikhta hai, wo default me band. Sirf FAB pair rahega: upar chhota arrow, neeche bada play/pause — screenshot ke exact placement (bottom-right, stacked) aur size ke saath.
- Purani bar ek setting ("Classic control bar") ke peeche chali jayegi, default OFF — jisko puraana layout chahiye wo on kar le.
- Progress/speed jaisi info ab bar ke bajaye sheet ke header me.

## 2. Button roles

- Arrow button = direction toggle: ↓ forward autoscroll, ↑ reverse autoscroll. Chalu session me dabao to direction turant flip, speed same.
- Play button = start / pause autoscroll (icon ▶ ↔ ⏸).
- Play button par long-press (~500ms) = Autoscroll sheet khulega, aur usme "Autoscroll" toggle ON dikhega/ON karne par turant start hoga — yaani sheet se hi on/off ho sake.

## 3. FAB auto-hide

- Start ke 3 second baad FAB dhire se fade out (invisible + non-clickable), reading me rukawat nahi.
- Screen par kahin bhi tap/scroll/pointer activity hone par FAB wapas dikhe, aur timer dobara 3 second se shuru.
- Autoscroll pause hone par FAB pinned (hide nahi hoga) taaki resume karna aasaan rahe.

## 4. Hold-to-pause (screen par kahin bhi)

- Autoscroll chalte waqt screen ke kisi bhi area par long-press (~250ms) karte hi scroll ruk jaye — jab tak ungli dabi hui hai, rukna jari.
- Ungli uthate hi wahi speed, wahi direction, wahi dwell/plan state se autoscroll resume — koi restart nahi, koi jump nahi.
- Safeguards: FAB/sheet/modal ke andar ka press count nahi hoga; ungli 12px se zyada move kare to normal manual scroll maana jayega (pause cancel); pointercancel/blur par bhi resume guarantee.
- Ye "hold pause" temporary hai — user ka manual pause (play button) alag rahega, uske upar overwrite nahi karega.

## Reference repo se kya lenge

`mranujbabu/navinbharat` ka reader code padha gaya: `useReaderChrome` ka idle-timer + pin pattern (auto-hide ke liye) aur `AutoScrollFab` ka tap-vs-long-press + pause/resume split. Wahi patterns is Obsidian plugin ke plain-DOM code me port honge (React nahi).

## Technical notes

- `src/scroll-fab.ts`: auto-hide state machine (`show()`, `arm()`, `setPinned()`), arrow ko primary reverse control banana, long-press → sheet callback.
- Naya `src/hold-pause.ts`: document-level pointerdown/up/cancel listeners + move tolerance, pure logic taaki test ho sake.
- `main.ts`: `holdPause()`/`holdResume()` jo `scrollRunning` ko chhue bina RAF loop ko freeze/unfreeze kare (frame timestamp reset ho taaki resume par jump na ho); sheet me autoscroll on/off toggle; `scrollBarClassic` setting + default.
- `styles.css`: minimal FAB sizing/spacing + fade transition.
- Tests: `tests/` me hold-pause aur auto-hide timer ke unit tests; version bump 1.1.8 (`manifest.json`, `package.json`, `versions.json`) + `main.js` rebuild.
