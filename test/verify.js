import { readFileSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

console.log("Running Invariant Verification Test Suite...");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
    return;
  }
  console.error(`  FAIL: ${message}`);
  failed++;
}

const dtsPath = join(root, "dist", "state.d.ts");
assert(existsSync(dtsPath), "dist/state.d.ts exists after build");

const dts = existsSync(dtsPath) ? readFileSync(dtsPath, "utf8") : "";
assert(
  dts.includes("DeepInfiniteResolve"),
  "DeepInfiniteResolve is exported in declaration output"
);
assert(
  dts.includes("SolvedState"),
  "SolvedState is exported in declaration output"
);
assert(
  !dts.includes("& DeepInfiniteResolve<T>"),
  "solver no longer self-intersects (root cause of TS2589)"
);

const fixture = `
import type { DeepInfiniteResolve, SolvedState } from "../src/types/state.js";

type _Deep = SolvedState["next"]["next"]["next"]["id"];
type _Compute = SolvedState["compute"];
type _ComputeHasId = _Compute extends { id: string } ? true : false;
type _ComputeHasNext = _Compute extends { next: { id: string } } ? true : false;

const _ok: [_Deep, _ComputeHasId, _ComputeHasNext] = ["node", true, true];
void _ok;

interface CyclicAlias {
  id: string;
  next: CyclicAlias;
  compute: () => CyclicAlias;
}
type _Alias = DeepInfiniteResolve<CyclicAlias>;
type _AliasDeep = _Alias["next"]["next"]["id"];
const _aliasOk: _AliasDeep = "ok";
void _aliasOk;

// Previously triggered TS2589 with the self-intersecting solver
type _Force<T> = T extends infer O ? { [K in keyof O]: _Force<O[K]> } : never;
type _Forced = _Force<SolvedState>;
type _ForcedId = _Forced["id"];
const _forcedOk: _ForcedId = "ok";
void _forcedOk;
`;

const fixturePath = join(root, "test", "_invariant_fixture.ts");
writeFileSync(fixturePath, fixture);

const check = spawnSync(
  "npx",
  [
    "tsc",
    "--strict",
    "--noEmit",
    "--module",
    "NodeNext",
    "--moduleResolution",
    "NodeNext",
    "--target",
    "ES2022",
    fixturePath,
  ],
  { cwd: root, encoding: "utf8" }
);

assert(check.status === 0, "cyclic SolvedState instantiation typechecks without TS2589");
if (check.status !== 0 && check.stdout) {
  console.error(check.stdout);
}
if (check.status !== 0 && check.stderr) {
  console.error(check.stderr);
}

try {
  unlinkSync(fixturePath);
} catch {
  // ignore cleanup errors
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}

console.log("All invariants passed.");
process.exit(0);
