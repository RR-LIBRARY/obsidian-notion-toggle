# Autoscroll Sheet — पूरी गाइड (हिंदी)

> Notion Toggle Obsidian plugin, version 1.7.6. इस गाइड में Autoscroll sheet का **हर एक option** क्रम से समझाया गया है — sheet में जो ऊपर से नीचे दिखता है, उसी क्रम में।
> हर feature का test `tests/sheet-features.test.ts` में है, ताकि कोई option छूटे नहीं।

---

## Sheet कैसे खोलें

1. **Floating button को दबाकर रखें (long-press)** — note के कोने में जो गोल बटन है, उसे 1 सेकंड दबाए रखें। Sheet खुल जाएगी।
2. **Command से** — Command palette में `Autoscroll: sheet (all controls)` चुनें।
3. **Keyboard से** — `Ctrl/Cmd + Shift + A`।

**ध्यान दें:**
- Floating button पर **एक tap** = autoscroll शुरू / रोकें। **दबाकर रखना** = sheet खोलना।
- Sheet खुलते ही floating button **गायब** हो जाता है, ताकि Play और sliders ढके नहीं। Sheet बंद करते ही बटन वापस आ जाता है।
- Autoscroll चलते समय **screen को दबाए रखें** — जब तक उंगली रखी है, scroll रुका रहेगा।

---

## भाग 1 — चालू / बंद

### 1. Autoscroll
- **क्या करता है:** इस note पर autoscroll चालू (ON) या बंद (OFF) करता है।
- **कैसे use करें:** switch ON करें — note अपने आप नीचे चलने लगेगा। OFF करें — रुक जाएगा।
- **Tip:** चलते समय screen दबाए रखने पर scroll रुका रहता है, उंगली हटाते ही फिर चलता है।

---

## भाग 2 — सोचने का समय (Think time)

### 2. Think time before the answer
- **क्या करता है:** toggle खुलते ही पहले सिर्फ सवाल दिखता है; जवाब थोड़ी देर बाद आता है, ताकि आप पहले खुद सोच सकें।
- **कैसे use करें:** switch ON करें।
- **Tip:** सवाल पर tap करें तो जवाब तुरंत खुल जाता है।

### 3. Think seconds
- **क्या करता है:** जवाब आने से पहले कितने सेकंड सोचने का समय मिले।
- **कैसे use करें:** slider खींचें या समय चुनें।
- **Tip:** किसी एक सवाल के लिए अलग समय चाहिए तो सवाल के title में `🤔20s` या `?30s` लिखें। पूरे note के लिए note के frontmatter में `think: 20s` लिखें।

### 4. Preview the countdown
- **क्या करता है:** चुना हुआ countdown यहीं चलाकर दिखाता है (कुछ save नहीं होता)।
- **कैसे use करें:** **Play** दबाएं और देखें countdown कैसा दिखेगा।

### 5. Countdown icon
- **क्या करता है:** countdown के साथ दिखने वाला निशान बदलता है।
- **कैसे use करें:** कोई emoji (🤔, 💭) या शब्द लिखें, या `.png / .gif / .svg / .webp` तस्वीर का पता डालें।
- **Tip:** खाली छोड़ने पर 🤔 लग जाता है।

### 6. Distraction-free mode
- **क्या करता है:** run के दौरान ऊपर की status bar, note header और mobile toolbar छुपा देता है, ताकि जवाब खुलते समय screen झपके नहीं।
- **कैसे use करें:** switch ON करें।

### 7. Reduced motion
- **क्या करता है:** countdown और जवाब खुलना बिना animation के, तुरंत होता है।
- **कैसे use करें:** अगर animation से परेशानी हो या फोन धीमा हो, तो ON करें।

### 8. Timing debug overlay
- **क्या करता है:** screen पर लिखकर दिखाता है कि toggle कब खुला, countdown कब शुरू हुआ और जवाब कब आया।
- **कैसे use करें:** सिर्फ जांच के लिए ON करें, आम तौर पर OFF रखें।

---

## भाग 3 — Quiz

### 9. Quiz (timed question run)
- **क्या करता है:** समय वाली quiz शुरू करता है — हर toggle पर timer, समय पूरा होने पर जवाब अपने आप, फिर अगला सवाल।
- **कैसे use करें:** switch ON = quiz शुरू, OFF = quiz बंद।

### 10. Quiz — time per question
- **क्या करता है:** कितने सेकंड बाद जवाब अपने आप खुले (1 सेकंड से 12 घंटे तक)।
- **कैसे use करें:** slider खींचें या समय लिखें।
- **Tip:** किसी सवाल के title में `⏱30`, `⏱15m` या `⏱2h` लिखें तो उस सवाल पर वही समय चलेगा।

### 11. Quiz — answer time
- **क्या करता है:** जवाब खुलने के बाद कितनी देर खुला रहे (1 सेकंड से 1 घंटे तक)।

### 12. Quiz — auto next
- **क्या करता है:** ON = जवाब के बाद अगला सवाल अपने आप। OFF = वहीं रुक जाओ, आगे खुद बढ़ो।

### 13. Quiz — kaunse toggle
- **क्या करता है:** quiz किन toggles से सवाल पूछे — जैसे सिर्फ 🔴 लाल (कमज़ोर) वाले।
- **कैसे use करें:** **Filter** दबाएं, फिर रंग चुनें: सब, 🔴, 🟡, 🟢, 🔴+🟡 (कमज़ोर जगहें), या callout प्रकार।
- **Tip:** यह filter autoscroll वाले "Colour filter" से अलग है — quiz का अपना है।

### 14. Quiz — minimal UI
- **क्या करता है:** बड़ा floating box हटाकर सिर्फ सवाल पर छोटा timer ring दिखाता है।

### 15. Quiz — loop
- **क्या करता है:** आखिरी सवाल के बाद quiz फिर सवाल 1 से शुरू हो जाती है।

---

## भाग 4 — जवाब खोलना / बंद करना

### 16. Answers — open / close all
- **क्या करता है:** इस note के **सारे** answer toggles एक tap में खोलता (**Open all**) या बंद (**Close all**) करता है — लंबे note में नीचे वाले भी।
- **Tip:** बड़े note में "Opened X of Y" जैसा संदेश आता है; scroll करने पर बाकी भी खुलते जाते हैं। किसी एक toggle पर tap करने, दूसरा note खोलने या quiz शुरू करने पर यह हट जाता है। यह रंग वाला filter **नहीं** देखता — पूरे note पर लगता है।

### 17. Open with auto-quiz (answers stay open)
- **क्या करता है:** ON = quiz शुरू होते ही हर जवाब खुला रहेगा और बंद नहीं होगा।

---

## भाग 5 — दिशा, रफ़्तार और रुकना

### 18. Direction
- **क्या करता है:** OFF (Forward) = नीचे की तरफ scroll, ON (Reverse) = ऊपर की तरफ।

### 19. Speed
- **क्या करता है:** scroll की रफ़्तार। अभी की रफ़्तार नीचे लिखी रहती है (जैसे 1x)।
- **कैसे use करें:** **Choose** दबाएं और चुनें: 0.02x, 0.05x, 0.1x, 0.2x, 0.5x, 0.75x, 1x, 1.5x, 2x, 3x, 5x, 7x, 10x, 20x।

### 20. Pause for
- **क्या करता है:** हर toggle पर कितनी देर रुकना है (hold time)।
- **कैसे use करें:** **Choose** दबाएं: 5s, 10s, 20s, 30s, 1m, 2m, 5m, 10m, 30m, 1h।

### 21. Pause at
- **क्या करता है:** किन toggles पर रुकना है।
- **कैसे use करें:** **Choose** दबाएं और चुनें:
  - ∞ **Every toggle** — हर toggle पर
  - 1️⃣ **Odd** — 1, 3, 5 … पर
  - 2️⃣ **Even** — 2, 4, 6 … पर
  - ✍️ **Custom list** — अपने नंबर, जैसे `2, 5, 9`
  - 🧭 **Route** — अपना क्रम, जैसे `7, 2, 9, 2` (याद रहता है); "Loop the route" ON करें तो बार-बार
  - 🔀 **Shuffle** — सबसे कमज़ोर पहले; "Shuffle range" से नंबरों की सीमा (0 = पूरा note)

### 22. Colour filter
- **क्या करता है:** autoscroll सिर्फ चुने हुए रंग वाले toggles पर रुके।
- **कैसे use करें:** **Choose** दबाएं: ⚪ सब, 🔴 लाल, 🟡 पीला, 🟢 हरा, 🔴🟡 कमज़ोर जगहें, 🔴🟡🟢 सारे graded, callout प्रकार, या ⚪ बिना grade वाले।
- **Tip:** हर विकल्प के साथ लिखा रहता है कि note में उस रंग के कितने toggles हैं।

### 23. Reverse direction ↑
- **क्या करता है:** "Direction" वाला ही switch है (ऊपर की तरफ scroll) — दोनों में से कोई भी use करें, दोनों एक ही setting बदलते हैं।

### 24. Loop the note
- **क्या करता है:** note खत्म होने पर autoscroll फिर ऊपर से शुरू।

### 25. Open toggles automatically
- **क्या करता है:** autoscroll जिस toggle पर पहुंचे, उसे अपने आप खोल दे।

### 26. Close them when leaving
- **क्या करता है:** toggle से आगे बढ़ते समय उसे अपने आप बंद कर दे, ताकि note छोटा और साफ रहे।

---

## भाग 6 — लंबे जवाब, screen-by-screen

### 27. Tall toggles screen-by-screen
- **क्या करता है:** जो जवाब एक screen से लंबा है, उसे एक-एक screen करके पढ़वाता है, फिर अगले toggle पर जाता है।
- **कैसे use करें:** switch ON करें।

### 28. Pause on each screen (1s – 1h)
- **क्या करता है:** लंबे जवाब की **हर screen** (पहली screen समेत) पर कितनी देर रुकना है, ताकि screen पर दिख रहा सारा text पढ़ सकें।
- **कैसे use करें:**
  1. slider खींचें — 1 सेकंड से 1 घंटे तक। दाईं तरफ चुना समय दिखता है (जैसे 7s)।
  2. या सीधे बटन दबाएं: **10s, 20s, 30s, 60s, 1h**।
- **Tip:**
  - पहली screen कम से कम इतनी देर रुकती है, या "Pause for" जितनी — जो ज़्यादा हो।
  - "Tall toggles" OFF और "Advance by" = Toggles हो, तो यह control धुंधला (grey) हो जाता है।
  - लंबे रुकाव में भी screen दबाए रखना या pause करना काम करता है; जवाब पर tap करने से जल्दी आगे बढ़ जाता है।
  - यही control Settings में भी है।

### 29. Advance by
- **क्या करता है:** autoscroll किस हिसाब से आगे बढ़े:
  - **Toggles** — toggle से toggle
  - **Screens** — पूरी screen एक बार में
  - **Toggles + screens** — दोनों
- **Tip:** Screens वाले रुकाव भी "Pause on each screen" का समय use करते हैं।

### 30. Screen calculation (live)
- **क्या करता है:** बताता है कि अभी एक "screen" कितनी लंबी गिनी जा रही है। Overlap या viewport बदलते ही तुरंत बदल जाता है। (सिर्फ जानकारी, बदलने को कुछ नहीं।)

### 31. Screen overlap
- **क्या करता है:** अगली screen पर जाते समय पिछली screen का कुछ हिस्सा (0% से 50%) दिखता रहे, ताकि पढ़ने का धागा न टूटे।
- **कैसे use करें:** slider खींचें। 0.1 = 10% हिस्सा दोहराया जाएगा।

### 32. Usable viewport
- **क्या करता है:** screen की ऊंचाई का कितना हिस्सा (50% से 100%) एक "screen" माना जाए।
- **Tip:** ऊपर-नीचे bar हों तो 0.9 या 0.85 रखें, ताकि कोई लाइन छूटे नहीं।

---

## भाग 7 — बाकी

### 33. Debug overlay
- **क्या करता है:** screen पर रुकने की जगहें और गिनती दिखाता है। सिर्फ जांच के लिए।

### 34. Quiet mode (no popups)
- **क्या करता है:** ON = रफ़्तार / दिशा / सादा-scroll वाले छोटे संदेश (popups) नहीं आएंगे।

### 35. More
- **Go to first** — sheet बंद करके note के पहले toggle पर ले जाता है।
- **Stats** — revision के आंकड़े: कितने toggles किस रंग के, अगले 7 दिन में कितने due।
- **Toolbar guide** — मोबाइल toolbar में autoscroll बटन कैसे जोड़ें, उसकी गाइड।

---

## आम सवाल

**Sheet खोलते ही floating button क्यों गायब हो गया?**
ताकि वह Play और sliders को ढके नहीं। Sheet बंद करते ही वापस आ जाता है।

**लंबे जवाब की screen जल्दी आगे कैसे बढ़ाएं?**
जवाब पर tap करें — अगली screen पर चला जाएगा।

**थोड़ी देर रोकना है, बंद नहीं करना?**
Screen पर उंगली दबाए रखें, या floating button पर एक tap करें।

**Open all दबाया पर सब नहीं खुले?**
बड़े note में फोन नीचे वाले हिस्से बाद में बनाता है। नीचे scroll करें — वे भी अपने आप खुल जाएंगे।

**"Direction" और "Reverse direction ↑" में फर्क?**
कोई फर्क नहीं — दोनों एक ही setting हैं।
