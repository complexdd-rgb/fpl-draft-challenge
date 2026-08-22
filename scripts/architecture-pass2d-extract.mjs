import fs from "node:fs";

const htmlPath = "admin.html";
let html = fs.readFileSync(htmlPath, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

function extractInlineBlock({ startMarker, endMarker, openTag, closeTag, replacement, outputPath, minimumLength = 100 }) {
  assert(count(html, startMarker) === 1, `${startMarker} must occur exactly once`);
  assert(count(html, endMarker) === 1, `${endMarker} must occur exactly once`);
  assert(count(html, openTag) === 1, `${openTag} must occur exactly once`);

  const markerStart = html.indexOf(startMarker);
  const markerEnd = html.indexOf(endMarker, markerStart + startMarker.length);
  assert(markerStart >= 0 && markerEnd > markerStart, `Invalid marker order for ${outputPath}`);

  const open = html.indexOf(openTag, markerStart + startMarker.length);
  assert(open > markerStart && open < markerEnd, `Opening tag for ${outputPath} is outside its guarded markers`);

  const contentStart = open + openTag.length;
  const close = html.lastIndexOf(closeTag, markerEnd);
  assert(close > contentStart && close < markerEnd, `Closing tag for ${outputPath} is outside its guarded markers`);

  const extracted = html.slice(contentStart, close);
  assert(extracted.trim().length >= minimumLength, `${outputPath} extraction is unexpectedly small`);

  const replaceEnd = markerEnd + endMarker.length;
  html = `${html.slice(0, markerStart)}${replacement}${html.slice(replaceEnd)}`;
  fs.writeFileSync(outputPath, extracted, "utf8");
}

extractInlineBlock({
  startMarker: "<!-- FPL STUDIO STAGE ONE CSS START -->",
  endMarker: "<!-- FPL STUDIO STAGE ONE CSS END -->",
  openTag: '<style id="fpl-studio-stage-one-css">',
  closeTag: "</style>",
  replacement: '<link rel="stylesheet" href="admin-stage-one.css?v=1.0.0">',
  outputPath: "admin-stage-one.css",
  minimumLength: 1000
});

extractInlineBlock({
  startMarker: "<!-- FPL STUDIO STAGE ONE JS START -->",
  endMarker: "<!-- FPL STUDIO STAGE ONE JS END -->",
  openTag: '<script id="fpl-studio-stage-one-js">',
  closeTag: "</script>",
  replacement: '<script src="js/admin-stage-one.js?v=1.0.0"></script>',
  outputPath: "js/admin-stage-one.js",
  minimumLength: 1000
});

assert(!html.includes("FPL STUDIO STAGE ONE CSS START"), "Old Stage One CSS marker remains");
assert(!html.includes("FPL STUDIO STAGE ONE CSS END"), "Old Stage One CSS end marker remains");
assert(!html.includes("fpl-studio-stage-one-css"), "Old Stage One CSS element id remains");
assert(!html.includes("FPL STUDIO STAGE ONE JS START"), "Old Stage One JS marker remains");
assert(!html.includes("FPL STUDIO STAGE ONE JS END"), "Old Stage One JS end marker remains");
assert(!html.includes("fpl-studio-stage-one-js"), "Old Stage One JS element id remains");
assert(count(html, 'href="admin-stage-one.css?v=1.0.0"') === 1, "Extracted Stage One stylesheet must be referenced exactly once");
assert(count(html, 'src="js/admin-stage-one.js?v=1.0.0"') === 1, "Extracted Stage One script must be referenced exactly once");

fs.writeFileSync(htmlPath, html, "utf8");
console.log("Stage One CSS and JS extracted from admin.html with guarded markers.");
