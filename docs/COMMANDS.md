# Notion Toggle — complete command guide (1.9.25)

## कैसे इस्तेमाल करें
- Desktop: **Ctrl/Cmd+P** → Command palette → **Notion Toggle** + नीचे वाला command नाम खोजें।
- Mobile: Obsidian menu से Command palette खोलें। Frequently used commands को **Settings → Mobile → Toolbar** में जोड़ें।
- **Settings → Hotkeys** में अपना shortcut रख सकते हैं। Default shortcuts: **Autoscroll start/pause** Ctrl/Cmd+Shift+S; **Reverse** Ctrl/Cmd+Shift+R; **Autoscroll sheet** Ctrl/Cmd+Shift+A; **Open / close all toggles** Ctrl/Cmd+Alt+T. दूसरे palette commands का default shortcut नहीं है।
- Minimal command names ON होने पर primary और Research commands के अलावा नाम से पहले **Advanced:** दिखता है। नीचे इसे छोड़कर वास्तविक नाम लिखा है।
- Editor command से पहले note edit mode में खोलें; cursor सही toggle में रखें या जरूरी text select करें। IDs stable हैं; पूरा ID `notion-toggle:COMMAND-ID` है।

## नए बदलाव
1. **Appearance: Notion toggles ↔ native callouts** पूरे plugin का appearance बदलता है और पुराने type/number exceptions साफ करता है। Note Markdown नहीं बदलता।
2. **Appearance: choose toggle numbers (this note)** → `6-11, 13` → Native callouts / Notion → Apply. एक note में एक range rule; नई selection पुरानी selection replace करती है। Reset this note rule हटा देता है। Q6 जैसे printed numbers पहले माने जाते हैं; unnumbered unique titles के लिए source position इस्तेमाल होती है। Duplicate unnumbered titles बिना source-line जानकारी के guess नहीं होते।
3. **Review: grade and filter red / yellow / green** → numbers → grade → Grade selected. Red = नहीं आया; Yellow = आधा याद; Green = याद है। केवल header बदलता है; answer/title/fold marker सुरक्षित रहते हैं। एक Undo से grading वापस होगी।
4. Visible cards: All, Red, Yellow, Green, Red + Yellow, All graded. Ungraded cards All में दिखते हैं। Screenshot में colour counts 0 थे क्योंकि cards graded नहीं थे। Nested matching card का parent visible रहता है। Filter केवल rendered cards को छिपाता है, source text को नहीं।
5. Quiz और autoscroll अपने colour filters इस्तेमाल करते हैं; browsing filter उनकी target list नहीं बदलता। Running session में browse hiding रोक दी जाती है।
6. Active autoscroll में floating mic छिपता है। Pause/stop पर तभी लौटता है जब Show floating mic ON है। Recording बंद नहीं होती।

## सभी commands

| Command name | ID | कैसे / कहाँ इस्तेमाल करें |
|---|---|---|
| Toggle (smart add) | `smart-toggle` | Cursor/selection के अनुसार toggle बनाएँ. |
| Toggle list | `toggle-list` | Selection को toggle में wrap करें; selection न हो तो नया toggle नीचे बनाएँ. |
| Tools | `tools-menu` | Editor: Tools. |
| Colour (red → yellow → green) | `smart-colour` | Cursor वाला toggle ungraded → red → yellow → green → red grade करें. |
| Recall (start / pause session) | `smart-recall` | Note का recall timer शुरू/pause/resume करें. |
| Review (spaced repetition) | `smart-review` | Current note का spaced-repetition review record करें. |
| Insert toggle (empty) | `insert-toggle` | Editor: Insert toggle (empty). |
| Wrap selection as toggle | `wrap-selection-toggle` | Editor: Wrap selection as toggle. |
| Convert <details> blocks to callouts | `convert-details-to-callouts` | Editor: Convert <details> blocks to callouts. |
| Convert callouts to <details> blocks | `convert-callouts-to-details` | Editor: Convert callouts to <details> blocks. |
| Quick Q&A toggle (prompt) | `quick-qa-toggle` | Editor: Quick Q&A toggle (prompt). |
| New toggle below | `new-toggle-below` | Editor: New toggle below. |
| Toggle auto-continue on Enter | `toggle-auto-continue` | Editor: Toggle auto-continue on Enter. |
| Insert numbered toggle | `insert-numbered-toggle` | Editor: Insert numbered toggle. |
| Renumber toggles in note | `renumber-toggles` | Editor: Renumber toggles in note. |
| Set toggle colour | `set-toggle-color` | Editor: Set toggle colour. |
| Cycle toggle colour (red → yellow → green) | `cycle-toggle-color` | Editor: Cycle toggle colour (red → yellow → green). |
| Toggle auto-numbering | `toggle-auto-numbering` | Editor: Toggle auto-numbering. |
| Insert MCQ toggle (checkbox options) | `insert-mcq-toggle` | Editor: Insert MCQ toggle (checkbox options). |
| Add MCQ option | `add-mcq-option` | Editor: Add MCQ option. |
| Toggle option checkbox | `toggle-option-checkbox` | Editor: Toggle option checkbox. |
| Insert Match the following toggle | `insert-match-toggle` | Editor: Insert Match the following toggle. |
| Insert answer key line | `insert-match-answer-row` | Editor: Insert answer key line. |
| Timer: show / hide | `toggle-recall-timer` | Open note / active session: Timer: show / hide. |
| Timer: start / pause | `recall-timer-start-pause` | Open note / active session: Timer: start / pause. |
| Timer: reset phase | `recall-timer-reset` | Open note / active session: Timer: reset phase. यह saved session/memory data बदलता है; text Undo इसे वापस नहीं करता. |
| Timer: skip phase | `recall-timer-skip` | Editor: Timer: skip phase. |
| Timer: start recall session on this note | `recall-session-this-note` | Editor: Timer: start recall session on this note. |
| Timer: stop session | `recall-timer-stop` | Open note / active session: Timer: stop session. |
| Autoscroll: choose colour filter | `autoscroll-filter` | Open note / active session: Autoscroll: choose colour filter. |
| Autoscroll: faster | `autoscroll-faster` | Open note / active session: Autoscroll: faster. |
| Autoscroll: slower | `autoscroll-slower` | Open note / active session: Autoscroll: slower. |
| Autoscroll: stop | `autoscroll-stop` | Open note / active session: Autoscroll: stop. |
| Autoscroll: mobile toolbar guide | `autoscroll-toolbar-guide` | Open note / active session: Autoscroll: mobile toolbar guide. |
| Autoscroll: pause at (odd / even / custom / route / shuffle) | `autoscroll-mode` | Open note / active session: Autoscroll: pause at (odd / even / custom / route / shuffle). |
| Autoscroll: pause for (hold time) | `autoscroll-dwell` | Open note / active session: Autoscroll: pause for (hold time). |
| Autoscroll: speed presets (0.02x … 20x) | `autoscroll-speed-presets` | Open note / active session: Autoscroll: speed presets (0.02x … 20x). यह saved session/memory data बदलता है; text Undo इसे वापस नहीं करता. |
| Autoscroll: go to first toggle | `autoscroll-top` | Open note / active session: Autoscroll: go to first toggle. |
| Autoscroll: smart shuffle (weakest toggles first) | `autoscroll-shuffle` | Open note / active session: Autoscroll: smart shuffle (weakest toggles first). |
| Autoscroll: reset revision memory for this note | `autoscroll-reset-memory` | Open note / active session: Autoscroll: reset revision memory for this note. यह saved session/memory data बदलता है; text Undo इसे वापस नहीं करता. |
| Autoscroll: read screen-by-screen | `autoscroll-screen-mode` | Open note / active session: Autoscroll: read screen-by-screen. |
| Autoscroll: revision stats (weak toggles) | `scroll-stats` | Open note / active session: Autoscroll: revision stats (weak toggles). |
| Quiz (timed question run) | `smart-quiz` | Open note / active session: Quiz (timed question run). |
| Quiz: pause / resume | `quiz-pause` | Editor: Quiz: pause / resume. |
| Open / close all toggles (Notion Ctrl+Alt+T) | `toggle-all-toggles` | Ctrl/Cmd+Alt+T: पूरे note के toggles खोलें/बंद करें; late-rendered blocks भी follow करते हैं. |
| Answers: open all toggles | `answers-open-all` | Open note / active session: Answers: open all toggles. |
| Answers: close all toggles | `answers-close-all` | Open note / active session: Answers: close all toggles. |
| Quiz: reveal the answer now | `quiz-reveal-now` | Open note / active session: Quiz: reveal the answer now. |
| Quiz: next question | `quiz-next` | Open note / active session: Quiz: next question. |
| Quiz: stop | `quiz-stop` | Open note / active session: Quiz: stop. |
| Quiz: choose colour filter | `quiz-filter` | Open note / active session: Quiz: choose colour filter. |
| Quiz: set time per question | `quiz-seconds` | Open note / active session: Quiz: set time per question. |
| Performance report (quiz timer + re-measure) | `perf-report` | Open note / active session: Performance report (quiz timer + re-measure). |
| Quiz: performance report (timers, freezes, render) | `quiz-perf-report` | Open note / active session: Quiz: performance report (timers, freezes, render). |
| Show notes due for recall | `show-due-notes` | Open note / active session: Show notes due for recall. |
| Appearance: choose toggle numbers (this note) | `toggle-number-appearance` | Number/range और Notion/native चुनें; Apply या Reset this note. |
| Review: grade and filter red / yellow / green | `review-color-filter` | Numbers grade करें और इस note के visible review colours चुनें; ऊपर पूरा flow देखें. |
| Appearance: Notion toggles ↔ native callouts | `toggle-appearance` | पूरे plugin में Notion/native appearance switch; type/number exceptions clear. |
| Appearance: choose native callout types | `callout-appearance-filter` | कौन-से callout types native रहें, चुनें. **All Notion** Native mode के बाद भी Notion appearance वापस ON करता है; **All callouts** सभी types native करता है. Number-specific note rules की priority बनी रहती है. |
| Toggle: open by default ↔ closed by default (this toggle) | `toggle-default-state` | Editor: Toggle: open by default ↔ closed by default (this toggle). |
| Voice mode: start / finish | `voice-mode-toggle` | Note खोलें, cursor रखें, start बोलें; दोबारा command से finish/write करें. Service setup जरूरी. |
| Voice mode: discard recording | `voice-mode-cancel` | Active recording discard करें; note में insert नहीं होगी. |
| Voice mode: self-test (5 sec) | `voice-mode-self-test` | 5-second microphone/service/write check; रिपोर्ट note में आती है. |
| Voice mode: write saved recordings now | `voice-mode-retry` | Connection/service वापस आने पर saved recordings write/retry करें. |
| Voice mode: transcribe audio file | `voice-mode-file` | Vault का audio file चुनें और note में transcribe करें. |
| Voice mode: show / hide floating mic button | `voice-mode-fab` | Floating mic तुरन्त show/hide; running autoscroll इसे फिर भी temporarily छिपाएगा. |
| Insert callout type playground note | `insert-callout-playground` | सभी callout types के examples वाला नया playground note बनाएं/खोलें. |
| Copy callout breakdown (counts + %) | `copy-callout-breakdown` | Current note के callout counts और percentages clipboard में copy करें. |
| Research: open panel | `research-open-panel` | Editor: Research: open panel. Configured research service और internet चाहिए; citations की जाँच करें. |
| Research: ask the web (cited answer) | `research-ask` | Editor: Research: ask the web (cited answer). Configured research service और internet चाहिए; citations की जाँच करें. |
| Research: fact-check selection | `research-factcheck` | Editor: Research: fact-check selection. Configured research service और internet चाहिए; citations की जाँच करें. |
| Research: web search → source toggles | `research-search` | Editor: Research: web search → source toggles. Configured research service और internet चाहिए; citations की जाँच करें. |
| Research: quick search (links) | `research-quick-search` | Editor: Research: quick search (links). Configured research service और internet चाहिए; citations की जाँच करें. |
| Research: read link(s) into toggles | `research-extract` | Editor: Research: read link(s) into toggles. Configured research service और internet चाहिए; citations की जाँच करें. |
| Research: recall toggles from selection / note | `research-recall` | Editor: Research: recall toggles from selection / note. Configured research service और internet चाहिए; citations की जाँच करें. |
| Research: deep research (background) | `research-deep` | Open note / active session: Research: deep research (background). Configured research service और internet चाहिए; citations की जाँच करें. |
| Research: insert latest finished deep research | `research-insert-latest` | Open note / active session: Research: insert latest finished deep research. Configured research service और internet चाहिए; citations की जाँच करें. |
| Outline selection with AI | `outline-with-ai` | Selection/whole note का AI outline toggles में बनाएं; configured service चाहिए. |
| Diagnose top padding (theme / snippets) | `diagnose-top-padding` | Open note / active session: Diagnose top padding (theme / snippets). |
| Autoscroll (start / pause revision) | `smart-autoscroll` | Reading/Live Preview: revision scroll start/pause; selected speed, route, stops और colour filter लागू होंगे. |
| Autoscroll: reverse direction | `autoscroll-reverse` | Scroll की direction बदलें: नीचे से ऊपर या ऊपर से नीचे. |
| Autoscroll: sheet (all controls) | `autoscroll-sheet` | Autoscroll control sheet खोलें; speed, stops, hold, filters और run options बदलें. |
| Move block up | `move-block-up` | Cursor वाला पूरा toggle ऊपर move करें. |
| Move block down | `move-block-down` | Cursor वाला पूरा toggle नीचे move करें. |
| Indent (nest under the toggle above) | `shove-into-toggle` | Current toggle को उससे ऊपर वाले toggle में nest करें. |
| Outdent (move out one level) | `move-out-of-toggle` | Nested toggle को एक level बाहर निकालें. |

## Writing gestures और spoken commands
- `>` + Space: blank line में toggle बनाए, Notion shortcut ON होने पर।
- Ctrl/Cmd+Enter: clean editor के current toggle को खोलें/बंद करें।
- Enter/Backspace: toggle body continue या empty structural line से बाहर निकलना।
- Indent/Outdent complete block को nest/unnest करते हैं।
- Mixed/native appearance rules होने पर clean editor layer बंद रहती है; rendered Live Preview/Reading cards chosen appearance दिखाते हैं। Raw Markdown editing में normal Obsidian behaviour रहता है।
- Voice formatting जैसे wiki links, headings, tables, lists और undo का syntax [VOICE_MODE.md](VOICE_MODE.md) में है। ये spoken phrases हैं, palette commands नहीं।
- Pause/resume voice card पर है; कोई अलग palette pause command मौजूद नहीं है।

## Deep links
`obsidian://notion-toggle?action=quiz&file=Bio/Alleles.md&filter=red&seconds=30`
`obsidian://notion-toggle?action=autoscroll&file=Bio/Alleles.md&filter=graded&speed=1`
`obsidian://notion-toggle?action=stop`
पहले vault/plugin खुला होना चाहिए। Spaces/path query parameters URL-encode करें।

## सीमाएँ
Local grading, filters, formatting और typed linking AI credits नहीं लेते। Voice/research/AI outline configured services पर depend करते हैं। Real Android/iOS microphone, themes और screen-lock behaviour को browser tests guarantee नहीं करते। [सारे features](FEATURES.md), [Voice manual](VOICE_MODE.md), [Verification](VERIFY-1.9.24.md).
