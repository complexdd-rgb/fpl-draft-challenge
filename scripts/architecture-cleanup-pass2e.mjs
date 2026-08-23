import fs from "node:fs";

const INDEX_PATH = "index.html";
const CSS_PATH = "player-game.css";
const REGRESSION_PATH = ".github/workflows/studio-regression.yml";

const html = fs.readFileSync(INDEX_PATH, "utf8");
const styleOpenCount = (html.match(/<style>/g) || []).length;
const styleCloseCount = (html.match(/<\/style>/g) || []).length;

if (styleOpenCount !== 1 || styleCloseCount !== 1) {
  throw new Error(`Expected exactly one inline style block in ${INDEX_PATH}; found ${styleOpenCount} opening and ${styleCloseCount} closing tags.`);
}

if (fs.existsSync(CSS_PATH)) {
  throw new Error(`${CSS_PATH} already exists; refusing to overwrite an unexpected canonical live stylesheet.`);
}

const match = html.match(/<style>([\s\S]*?)<\/style>/);
if (!match) {
  throw new Error(`Could not locate the inline style block in ${INDEX_PATH}.`);
}

const css = match[1];
if (!css.trim()) {
  throw new Error("Inline live-page CSS was unexpectedly empty.");
}

const stylesheetLink = '<link rel="stylesheet" href="player-game.css"/>';
const nextHtml = html.replace(match[0], stylesheetLink);

if (nextHtml === html) {
  throw new Error("Live page was not changed by the extraction.");
}
if (/<style>|<\/style>/.test(nextHtml)) {
  throw new Error("Inline style tags remain in index.html after extraction.");
}
if (!nextHtml.includes(stylesheetLink)) {
  throw new Error("Canonical live stylesheet link was not inserted.");
}

fs.writeFileSync(CSS_PATH, css, "utf8");
fs.writeFileSync(INDEX_PATH, nextHtml, "utf8");

let regression = fs.readFileSync(REGRESSION_PATH, "utf8");
const guardName = "Verify modular live-page stylesheet";
if (!regression.includes(guardName)) {
  regression = `${regression.trimEnd()}\n\n      - name: ${guardName}\n        shell: bash\n        run: |\n          set -euo pipefail\n          test -s player-game.css\n          grep -q '<link rel=\"stylesheet\" href=\"player-game.css\"/>' index.html\n          ! grep -q '<style>' index.html\n          ! grep -q '</style>' index.html\n          git diff --check\n`;
  fs.writeFileSync(REGRESSION_PATH, regression, "utf8");
}

console.log(`Extracted ${Buffer.byteLength(css, "utf8")} bytes of live-page CSS to ${CSS_PATH}.`);
