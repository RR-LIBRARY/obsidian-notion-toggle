# Autoscroll Sheet को छोटा (minimal) कैसे करें — बिना कुछ तोड़े

यह सिर्फ़ सोच / सुझाव है — **अभी plugin में कुछ नहीं बदला।** आप जो idea चुनें, वह अगली release में अलग से बनेगा।

सबसे बड़ा idea: **sheet में सिर्फ़ 6–7 रोज़ वाले controls दिखें, बाकी "Advanced ▸" के अंदर** — कोई setting हटेगी नहीं, पुरानी saved values वैसी ही रहेंगी।

| # | Feature | सुझाव | क्यों | Risk | मेहनत |
|---|---|---|---|---|---|
| 1 | Autoscroll on/off, Play | रखो (ऊपर) | रोज़ का काम | — | — |
| 2 | Speed, Pause for, Colour filter | रखो | रोज़ बदलते हैं | — | — |
| 3 | Direction + Reverse direction ↑ | **जोड़ो — एक ही रखो** | दोनों एक ही setting हैं (v1.7.6 audit) | बहुत कम | छोटी |
| 4 | Tall toggles + Pause on each screen | रखो, पर एक group में | साथ में ही मतलब रखते हैं | कम | छोटी |
| 5 | Advance by | रखो | रोज़ काम का | — | — |
| 6 | Screen calculation (live), Screen overlap, Usable viewport | Advanced में | set-and-forget | कम | छोटी |
| 7 | Pause at, Open automatically, Close when leaving, Loop | Advanced में | एक बार set होते हैं | कम | छोटी |
| 8 | Think time के 7 rows (seconds, preview, icon, distraction-free, reduced motion, timing debug) | Think on/off + seconds रखो, बाकी Advanced | icon/preview/debug कभी-कभी | कम | छोटी |
| 9 | Quiz के 7 rows | Quiz button रखो; बाकी "Quiz settings" पॉपअप में | sheet लंबी होती है | कम | मध्यम |
| 10 | Debug overlay, Timing debug | Settings tab में ही रहें, sheet से हटाओ | सिर्फ़ जाँच के लिए | कम (commands से मिल जाते हैं) | छोटी |
| 11 | Answers open/close all | रखो | तेज़ काम | — | — |
| 12 | **नया: Presets** बटन | जोड़ो | Guide के 6 student presets एक tap में | मध्यम (कई settings एक साथ बदलती हैं; "Undo" चाहिए) | मध्यम |

## नतीजा
- अभी 35 rows → रोज़ के view में लगभग **10 rows**, बाकी Advanced / पॉपअप में।
- कोई feature ख़त्म नहीं होता; सिर्फ़ #3 (Direction duplicate) सच में हटाने लायक है।
- टेस्ट पर असर: `tests/sheet-features.test.ts` की row-order जाँच को नए क्रम के हिसाब से बदलना पड़ेगा।

## सुझाया क्रम
1. #3 duplicate हटाना (सबसे सुरक्षित)।
2. Advanced fold (#6, #7, #8, #10)।
3. Quiz settings पॉपअप (#9)।
4. Presets (#12)।
