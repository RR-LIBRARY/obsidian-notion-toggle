# issue.md — issue register

Har entry ek real finding hai jo v1.4.6 ke logic audit (`tests/logic-audit.test.ts`,
50 tests / 226 assertions) me actually reproduce hui. Koi imaginary / "hypothetical"
issue yahan nahi likha gaya.

Version: **1.4.6** · Date: 2026-08-30 · Baseline before audit: 453 tests, after: 503 tests.

Severity: **High** = galat content reader ko dikha / feature chup-chaap fail,
**Medium** = confusing ya data-losing behaviour, **Low** = cosmetic / drift.

---

## Fixed in 1.4.6

### #1 — Corrupt saved plan silently became "odd toggles" · Medium · FIXED
- **Kahan:** `src/scrollmode.ts` → `normalizeMode()` (upstream `normalizeParity` in `src/reader/dwellEngine.ts`).
- **Kya hota tha:** koi bhi unknown/damaged saved mode (`undefined`, purani key, half-written JSON)
  upstream reader engine me `"odd"` ban jata tha. Plugin me iska matlab: reader ka plan
  chup-chaap "sirf odd toggles" ho jata — aadha note skip, bina kisi message ke.
- **Repro:** `normalizeMode("nope")` → `"odd"` (expected `"all"`).
- **Fix:** plugin-side wrapper ab sirf known modes (`all/odd/even/custom/route/shuffle`)
  ko pass karta hai; baaki sab `"all"` (every toggle) par girte hain. Vendored reader
  engine bilkul verbatim chhoda gaya hai.
- **Test:** `tests/logic-audit.test.ts` → "unknown modes normalise instead of throwing";
  `tests/scrollmode.test.ts` updated.

### #2 — Custom pick list me range (`3-5`) ka 4 gayab · Medium · FIXED
- **Kahan:** `src/scrollmode.ts` → `parsePicks()`.
- **Kya hota tha:** engine har non-digit par split karta hai, to `"3-5"` = toggles **3 aur 5**.
  Reader ke hisaab se ye 3,4,5 hona chahiye — beech ka toggle chup-chaap chhut jata tha.
- **Repro:** `parsePicks("3-5")` → `[3, 5]`.
- **Fix:** `a-b` / `a–b` / `a to b` pehle expand hote hain, phir engine ko jaate hain.
  Absurd ranges (`1-99999`) sirf dono ends rakhte hain, taaki list blow-up na ho.
- **Test:** "parses picks and routes, keeping route duplicates as separate legs".

### #3 — Reverse run me dwell skip ho jata tha jab reader top par ho · Medium · FIXED
- **Kahan:** `src/autoscroll.ts` → `firstStopFrom()`.
- **Kya hota tha:** reverse plan descending order me hota hai. Agar upar kuch bhi stop
  nahi bacha, function `index 0` par wrap karta tha — jo descending plan ka **sabse
  neeche wala** stop hai, yaani upar jaate run ke *peeche*. `reachedTarget()` pehle hi
  frame me true ho jata, to har stop "reached" mark hokar hold/dwell skip ho jata.
- **Repro:** `firstStopFrom(reversePlan, 0, true)` → `0` (bottom stop) instead of last index.
- **Fix:** wrap ab us edge par jata hai jidhar run ja raha hai — forward me index 0,
  reverse me last index (sabse ooncha stop).
- **Test:** "v1.4.6 — with nothing ahead, the wrap target is the edge the run heads for".

---

## Open / accepted (koi fix nahi, jaan-boojh kar)

### #4 — Quiz tick overflow carry nahi hota · Low · OPEN
- **Kahan:** `src/quiz.ts` → `quizTick()`.
- **Behaviour:** agar ek frame me question ke bache hue time se zyada `elapsed` aata hai
  (tab background me tha, ya bahut lamba frame), extra milliseconds agli phase me
  carry nahi hote — reveal poore `quizRevealSeconds` se start hota hai.
- **Asar:** worst case ek frame jitna drift (typically <1s); phase machine consistent
  rehti hai, koi question skip nahi hota.
- **Kyun chhoda:** carry karne se long background pause ke baad ek hi frame me kai
  questions "poof" ho sakte hain — jo abhi wale behaviour se kharab hai.
- **Workaround:** zaroorat nahi.

### #5 — Route mode reverse toggle ko ignore karta hai · Low · BY DESIGN
- **Kahan:** `src/scrollmode.ts` → `orderModeStops()`.
- **Behaviour:** `route` / `shuffle` me "Reverse" switch order nahi badalta — route ka
  order hi authority hai (har leg apni direction khud choose karta hai, `legDirection`).
- **Kyun:** typed route ka matlab hi "ye order chahiye". Documented in MANUAL section 6.
- **Workaround:** route ko ulta type kar dein.

### #6 — `filterLabel` "other" ko ⚪ dikhata hai · Low · COSMETIC
- **Kahan:** `src/autoscroll.ts`.
- **Behaviour:** un-graded toggles ka icon ⚪ hai, jabki palette me ⚪ "Gray — extra"
  colour ke liye bhi use hota hai. Dono alag cheezein hain, icon ek hi hai.
- **Asar:** sirf toast text; filtering logic bilkul theek hai (`colorOf` sirf
  `recall-red/yellow/green` dekhta hai).

### #7 — Headless me verify na ho paane wale hisse · Info
- Obsidian ka real reading-view re-render (`quiz-heal` ka asli trigger) sirf simulate
  hota hai — happy-dom me detach/re-attach se, asli Obsidian se nahi.
- Mobile haptics / `Notice` sound, aur iOS Safari ke scroll momentum — inka koi
  automated cover nahi hai; manual device check hi option hai.

---

## Regression guard

Har fixed issue ke saath ek named test hai. Suite: `bun test` → **503 pass / 0 fail**,
1633 assertions, 32 files. Details `Test-Verify.md` me.
