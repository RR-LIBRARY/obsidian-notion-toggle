import { describe, expect, test } from "bun:test";
import {
  dueCount,
  dueNotes,
  dueSummary,
  gradeCard,
  isDue,
  newCard,
  nextDueLabel,
  suggestGrade,
} from "../src/srs";
import { blankTableRow, smartAction, smartActionLabel } from "../src/smart";
import { commandName, isPrimary } from "../src/naming";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 0, 1);

describe("v1.0.7 — SM-2 scheduling", () => {
  test("a new card is due immediately", () => {
    const card = newCard();
    expect(card.repetitions).toBe(0);
    expect(isDue(card, NOW)).toBe(true);
  });

  test("first Good gives 1 day, second gives 6 days", () => {
    const first = gradeCard(newCard(), "good", NOW);
    expect(first.interval).toBe(1);
    const second = gradeCard(first, "good", NOW + DAY);
    expect(second.interval).toBe(6);
  });

  test("third Good multiplies by ease", () => {
    let card = gradeCard(newCard(), "good", NOW);
    card = gradeCard(card, "good", NOW + DAY);
    const third = gradeCard(card, "good", NOW + 7 * DAY);
    expect(third.interval).toBeGreaterThan(6);
    expect(third.interval).toBe(Math.round(6 * card.ease));
  });

  test("Again resets the interval but keeps the card", () => {
    let card = gradeCard(newCard(), "good", NOW);
    card = gradeCard(card, "good", NOW + DAY);
    const lapsed = gradeCard(card, "again", NOW + 7 * DAY);
    expect(lapsed.interval).toBe(1);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.ease).toBeLessThan(card.ease);
  });

  test("ease stays inside the 1.3 – 2.7 clamp", () => {
    let card = newCard();
    for (let i = 0; i < 20; i++) card = gradeCard(card, "again", NOW + i * DAY);
    expect(card.ease).toBeGreaterThanOrEqual(1.3);
    let easy = newCard();
    for (let i = 0; i < 20; i++) easy = gradeCard(easy, "easy", NOW + i * DAY);
    expect(easy.ease).toBeLessThanOrEqual(2.7);
  });

  test("Easy schedules further out than Hard", () => {
    const base = gradeCard(gradeCard(newCard(), "good", NOW), "good", NOW + DAY);
    const hard = gradeCard(base, "hard", NOW + 7 * DAY);
    const easy = gradeCard(base, "easy", NOW + 7 * DAY);
    expect(easy.interval).toBeGreaterThan(hard.interval);
  });

  test("due date lands interval days ahead", () => {
    const card = gradeCard(newCard(), "good", NOW);
    expect(card.due).toBe(NOW + card.interval * DAY);
    expect(isDue(card, NOW)).toBe(false);
    expect(isDue(card, card.due)).toBe(true);
  });

  test("labels are human readable", () => {
    const card = gradeCard(newCard(), "good", NOW);
    expect(nextDueLabel(card, NOW).length).toBeGreaterThan(0);
    expect(nextDueLabel(newCard(), NOW).toLowerCase()).toContain("not scheduled");
  });

  test("due counting and sorting", () => {
    const cards = {
      "a.md": { ...gradeCard(newCard(), "good", NOW), due: NOW - 2 * DAY },
      "b.md": { ...gradeCard(newCard(), "good", NOW), due: NOW - 5 * DAY },
      "c.md": { ...gradeCard(newCard(), "good", NOW), due: NOW + 5 * DAY },
    };
    expect(dueCount(cards, NOW)).toBe(2);
    expect(dueNotes(cards, NOW)).toEqual(["b.md", "a.md"]);
    expect(dueSummary(cards, NOW)).toContain("2");
  });

  test("grade suggestion follows the traffic-light stats", () => {
    expect(suggestGrade({ total: 10, red: 6, yellow: 2, green: 2 })).toBe("again");
    expect(suggestGrade({ total: 10, red: 0, yellow: 0, green: 10 })).toBe("easy");
    expect(suggestGrade({ total: 0, red: 0, yellow: 0, green: 0 })).toBe("good");
  });
});

describe("v1.0.7 — minimal command surface", () => {
  test("primary commands keep clean names", () => {
    expect(isPrimary("smart-toggle")).toBe(true);
    expect(commandName("smart-toggle", "Toggle (smart add)", true)).toBe("Toggle (smart add)");
  });

  test("everything else is grouped under Advanced", () => {
    expect(commandName("wrap-selection-toggle", "Wrap selection as toggle", true)).toBe(
      "Advanced: Wrap selection as toggle"
    );
    expect(commandName("wrap-selection-toggle", "Wrap selection as toggle", false)).toBe(
      "Wrap selection as toggle"
    );
  });
});

describe("v1.0.7 — smart dispatch", () => {
  test("selection wraps", () => {
    expect(smartAction({ selection: "Q\nA", line: "Q", insideToggle: false })).toBe(
      "wrap-selection"
    );
  });

  test("inside an MCQ option list, Toggle adds the next option", () => {
    expect(smartAction({ selection: "", line: "> - [ ] Option B", insideToggle: true })).toBe(
      "mcq-option"
    );
  });

  test("inside a match table, Toggle adds a row", () => {
    expect(smartAction({ selection: "", line: "> | A | 1 |", insideToggle: true })).toBe(
      "match-row"
    );
    expect(blankTableRow("> | A | 1 |")).toBe("> |   |   |");
  });

  test("plain cursor creates a new toggle", () => {
    expect(smartAction({ selection: "", line: "", insideToggle: false })).toBe("new-toggle");
    expect(smartActionLabel("new-toggle").length).toBeGreaterThan(0);
  });
});
