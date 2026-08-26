/**
 * Test preload: stub the Obsidian + CodeMirror modules so main.ts can be
 * imported and its pure planner/builder functions tested directly.
 */
import { mock } from "bun:test";

class Stub {
  app: unknown;
  constructor(app?: unknown) {
    this.app = app;
  }
}

mock.module("obsidian", () => ({
  App: Stub,
  Editor: Stub,
  Modal: Stub,
  Notice: Stub,
  Plugin: Stub,
  PluginSettingTab: Stub,
  Setting: Stub,
}));

mock.module("@codemirror/state", () => ({
  Prec: { highest: (x: unknown) => x },
}));

mock.module("@codemirror/view", () => ({
  keymap: { of: (x: unknown) => x },
}));
