import fs from "node:fs";
import { spawnSync } from "node:child_process";

const auditPath = new URL("audit-refinement-incubator.mjs", import.meta.url);
const appendixPath = new URL("refinement-survivor-appendix.inc.mjs", import.meta.url);
const tempPath = new URL(".tmp-refinement-survivor-trial.mjs", import.meta.url);
const auditSource = fs.readFileSync(auditPath, "utf8");
const appendix = fs.readFileSync(appendixPath, "utf8");

fs.writeFileSync(tempPath, `${auditSource}\n\n${appendix}\n`);
try {
  const result = spawnSync(process.execPath, [tempPath.pathname], {
    cwd: new URL("../", import.meta.url),
    stdio: "inherit"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  try { fs.unlinkSync(tempPath); } catch (_) {}
}
