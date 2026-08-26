import esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["main.ts"],
  bundle: true,
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  outfile: "main.js",
  external: [
    "obsidian",
    "electron",
    "@codemirror/state",
    "@codemirror/view",
    "@codemirror/language",
    "@codemirror/search",
    "@codemirror/commands",
    "@lezer/common",
  ],
});
