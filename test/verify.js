import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const declarationPath = join(root, "dist", "state.d.ts");

if (!existsSync(declarationPath)) {
  throw new Error("Run npm run build before npm test");
}

const declaration = readFileSync(declarationPath, "utf8");
if (declaration.includes("& DeepInfiniteResolve")) {
  throw new Error("Recursive self-intersection leaked into declaration output");
}

const fixturePath = join(root, "test", "_invariant_fixture.ts");
const fixture = `
import type { DeepInfiniteResolve, SolvedState, StateGraphNode } from "../src/types/state.js";

type D0 = SolvedState;
type D1 = D0["next"];
type D2 = D1["next"];
type D3 = D2["next"];
type D4 = D3["next"];
type D5 = D4["next"];
type D6 = D5["next"];
type D7 = D6["next"];
type D8 = D7["next"];
type D9 = D8["next"];
type D10 = D9["next"];
type D11 = D10["next"];
type D12 = D11["next"];

type C0 = ReturnType<SolvedState["compute"]>;
type C1 = ReturnType<C0["compute"]>;
type C2 = ReturnType<C1["compute"]>;

type ArrayState = DeepInfiniteResolve<{ values: StateGraphNode[] }>;
type ArrayValueId = ArrayState["values"][number]["id"];

const assertions: [D12["id"], C2["id"], ArrayValueId] = ["", "", ""];
void assertions;
`;

writeFileSync(fixturePath, fixture);
try {
  const result = spawnSync(
    process.execPath,
    [
      join(root, "node_modules", "typescript", "bin", "tsc"),
      "--noEmit",
      "--strict",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      fixturePath,
    ],
    { cwd: root, encoding: "utf8" }
  );

  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error("Cyclic type fixture failed to compile");
  }
} finally {
  if (existsSync(fixturePath)) {
    unlinkSync(fixturePath);
  }
}

console.log("TypeScript build and cyclic type fixture passed.");
