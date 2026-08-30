# Strongwincode.md — plugin ki strength aur weakness

Honest review, v1.4.6 (2026-08-30). Har point ke saath actual code / number diya hai —
marketing line nahi. Weakness ke saath "kya karna chahiye" bhi likha hai.

Codebase: `main.ts` 3,184 lines + `src/` 28 modules (~5,950 lines) + 32 test files
(503 tests, 1,633 assertions). Bundle: `main.js` ≈ 246 KB.

---

## 1. Strengths

### S1 — Pure logic modules, DOM se poori tarah alag
`src/quiz.ts`, `src/scrollmode.ts`, `src/autoscroll.ts`, `src/srs.ts`, `src/timer.ts` —
inme ek bhi Obsidian ya DOM import nahi hai. Isi wajah se quiz ki poori phase machine,
SM-2 scheduling aur autoscroll planning bina browser ke test ho jaate hain, aur
v1.4.6 ke teeno bugs pure functions me hi pakde gaye.

### S2 — Test coverage sach me behaviour test karti hai
503 tests sirf getters nahi chhoote — Q22 skip bug (`quiz-heal`), reverse start
(`seedStartOffset`), plan persistence, release metadata (`release-meta.test.ts`) sab
ke apne guard hain. Naya `tests/logic-audit.test.ts` contract ke against likha gaya hai
(implementation ke against nahi), isliye chup-chaap behaviour change fail karega.

### S3 — Autoscroll engine copy nahi, reuse hai
`src/reader/dwellEngine.ts` upstream reader se verbatim liya gaya hai aur
`src/scrollmode.ts` sirf adapter hai (page = toggle). Battle-tested rules — parity,
A4 screen-by-screen stops, crossing detection — dobara likhe nahi gaye.

### S4 — Corrupt data se ghabrata nahi
`normalizeDwell` / `parseDwell` har persisted value ko coerce karte hain, `parseDeepLink`
unknown action par `null` deta hai, empty custom/route plan `all` par degrade hota hai
(dead run kabhi nahi banta), aur khali note par quiz seedha `done` hota hai.

### S5 — Reader ko har change dikhta hai
Plan toast (`planSummary`), session line (`sessionLabel`), quiz progress label —
loop aur shuffle range ab chup-chaap nahi badalte. Ye pehle ek asli complaint tha.

### S6 — Self-healing quiz
`quiz-heal.ts` re-render ke baad questions ko title se dobara map karta hai, har fresh
element sirf ek baar consume hota hai, aur `revealLanded()` check karta hai ki answer
sach me screen par aaya ya nahi — warna real open fallback.

### S7 — Accessibility aur chrome discipline
`fab-a11y.test.ts` + `fab-chrome.test.ts` guarantee karte hain ki har control ka
`aria-label` ho aur FAB kisi bhi theme/state me grey chip na dikhaye — animation
(`ntt-layer-step`, 1.5s, 0.18s stagger) intact rehte hue.

---

## 2. Weaknesses

### W1 — `main.ts` 3,184 lines ka hai · **sabse bada risk**
Plugin ka orchestration — commands, run loop, quiz driver, DOM wiring — ek hi file me hai.
`src/` accha split hai, lekin ye file usse bada hai.
**Karna kya chahiye:** run loop (`scrollTick`), quiz driver, aur command registration
teen alag `src/` modules me nikaalo; `main.ts` ko sirf lifecycle + wiring rakho.
Architecture test ki 900-line guardrail `src/` par lagti hai, `main.ts` par nahi — usko
bhi cover me lao.

### W2 — Bug ka source aksar vendored engine hota hai, aur wo verbatim rakha hai
v1.4.6 ke #1 aur #2 dono upstream `dwellEngine.ts` ke defaults the (unknown parity → `odd`,
range parsing nahi). Fix plugin-side wrapper me karna pada.
**Karna kya chahiye:** wrapper layer ko ek jagah document karo ("engine se ye ye alag hai")
taaki agla upstream sync in fixes ko wapas na khaa jaye.

### W3 — DOM-side ka coverage logic-side se kaafi patla hai
`settings-tab.ts` (782), `modals.ts` (676), `editor-blocks.ts` (439) — inka bada hissa
sirf indirectly test hota hai. UI logic yahi rehta hai.
**Karna kya chahiye:** modal build functions ko pure "describe the fields" data +
thin renderer me todo, taaki fields data-driven test ho sakein.

### W4 — Asli Obsidian me kuch bhi automated verify nahi hota
Sab kuch happy-dom + Playwright fixture par chalta hai. Reading-view re-render, mobile
haptics, iOS momentum scrolling — sab simulate hai.
**Karna kya chahiye:** har release se pehle ek chhota manual smoke checklist
(`SMOKE-TEST.md` already hai) desktop + Android dono par run karo aur date likho.

### W5 — Do scheduler ek saath (SM-2 + FSRS)
`src/srs.ts` (SM-2) note-level scheduling karta hai, `src/fsrs.ts` shuffle route ke liye
alag deck store rakhta hai. Dono ka apna concept of "card" hai.
**Karna kya chahiye:** ya to ek scheduler par consolidate karo, ya MANUAL me saaf likho
ki kaun kahan lagta hai — abhi reader ke liye ye distinction invisible hai.

### W6 — 246 KB bundle mobile ke liye chhota nahi hai
Telemetry, debug overlay, guide, stats panel — sab hamesha bundle hote hain, chahe
setting off ho.
**Karna kya chahiye:** debug overlay + telemetry ko lazy path me daalo ya dev build tak
seemit karo.

### W7 — Chhoti timing drift aur cosmetic overlaps (issue.md #4, #6)
Quiz tick overflow carry nahi hota, aur ⚪ icon do alag matlab me use hota hai.
Dono low severity hain, lekin register me hain taaki bhoole na jaayein.

---

## 3. Verdict

Logic layer ki quality iss plugin ki asli taakat hai — pure modules, honest tests, aur
teen real bugs ek hi audit pass me mile aur fix hue. Sabse bada structural risk
`main.ts` ka size hai, aur sabse bada process risk ye hai ki real-Obsidian verification
abhi bhi manual hai. Dono ka rasta upar likha hua hai; koi bhi blocker nahi hai.
