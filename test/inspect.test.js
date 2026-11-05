/**
 * Verifies the issue-4 fix against the compiled output.
 *
 * There is no Bedrock runtime in node, so the compiled module is imported with a
 * stub `@minecraft/server` that reproduces the shape of the 2.8.0 API: a private
 * -constructor registry class, a `system.beforeEvents.startup` signal, and the two
 * permission enums. The stub also keeps the class-vs-instance distinction that
 * caused the reported crash, so the regression assertion is real.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${error.message}`);
    process.exitCode = 1;
  }
}

/** Build an isolated copy of dist plus a stub module, and return its entry URL. */
function loadWithStub() {
  const sandbox = mkdtempSync(join(tmpdir(), "aog-inspect-"));
  cpSync(dist, join(sandbox, "dist"), { recursive: true });

  const stubDir = join(sandbox, "node_modules", "@minecraft", "server");
  mkdirSync(stubDir, { recursive: true });
  writeFileSync(join(stubDir, "package.json"), JSON.stringify({ name: "@minecraft/server", type: "module", main: "index.js" }));
  writeFileSync(
    join(stubDir, "index.js"),
    `
export const CommandPermissionLevel = { Any: 0, GameDirectors: 1, Admin: 2, Host: 3, Owner: 4 };
export const PlayerPermissionLevel = { Visitor: 0, Member: 1, Operator: 2 };
export const CustomCommandStatus = { Success: 0, Failure: 1 };

export const startupSubscriptions = [];
export const system = {
  beforeEvents: {
    startup: {
      subscribe(callback) {
        startupSubscriptions.push(callback);
        return callback;
      },
    },
  },
};

// Real class with a private constructor: calling registerCommand on the class
// itself is a TypeError, exactly as reported in issue #4.
export class CustomCommandRegistry {
  constructor() {
    this.registered = [];
  }
  registerCommand(command, callback) {
    this.registered.push({ command, callback });
  }
}
`,
  );

  return {
    inspectHref: pathToFileURL(join(sandbox, "dist", "scripts", "commands", "inspect.js")).href,
    stubHref: pathToFileURL(join(stubDir, "index.js")).href,
  };
}

const loaded = loadWithStub();
const inspect = await import(loaded.inspectHref);
const stub = await import(loaded.stubHref);

function fakePlayer(level) {
  return {
    playerPermissionLevel: level,
    location: { x: 0, y: 64, z: 0 },
    dimension: {
      getEntities() {
        return [{ typeId: "minecraft:cow", location: { x: 1, y: 64, z: 2 } }];
      },
    },
  };
}

console.log("inspect command registration");

test("registers through the startup hook, not at import time", () => {
  const before = stub.startupSubscriptions.length;
  const onStartup = inspect.installInspectCommand();
  assert.equal(stub.startupSubscriptions.length, before + 1, "should subscribe to system.beforeEvents.startup");
  assert.equal(typeof onStartup, "function", "should return the subscription callback");
  assert.equal(stub.startupSubscriptions.at(-1), onStartup);
});

test("the reported call shape still throws on the class itself", () => {
  assert.equal(typeof stub.CustomCommandRegistry.registerCommand, "undefined");
  assert.throws(() => stub.CustomCommandRegistry.registerCommand({}, () => {}), TypeError);
});

test("command is namespaced and gated at Admin", () => {
  assert.match(inspect.INSPECT_COMMAND.name, /^[a-z0-9_]+:[a-z0-9_]+$/, "command id needs a namespace");
  assert.equal(inspect.INSPECT_COMMAND.permissionLevel, 2, "permission level should be Admin");
});

test("firing startup delivers the registration into the event's registry", () => {
  const registry = new stub.CustomCommandRegistry();
  const onStartup = stub.startupSubscriptions.at(-1);
  onStartup({ customCommandRegistry: registry });
  assert.equal(registry.registered.length, 1, "expected exactly one registration");
  assert.equal(registry.registered[0].command.name, inspect.INSPECT_COMMAND.name);
  assert.equal(registry.registered[0].command.permissionLevel, 2);
});

test("non-operator caller gets a Failure result, callback included", () => {
  const registry = new stub.CustomCommandRegistry();
  stub.startupSubscriptions.at(-1)({ customCommandRegistry: registry });
  const result = registry.registered[0].callback({ sourceEntity: fakePlayer(0) });
  assert.equal(result.status, 1);
  assert.match(result.message, /operator/i);
});

test("operator caller is permitted and gets the nearest entity", () => {
  const gate = inspect.requireOperator({ sourceEntity: fakePlayer(2) });
  assert.equal(gate.ok, true);
  const registry = new stub.CustomCommandRegistry();
  stub.startupSubscriptions.at(-1)({ customCommandRegistry: registry });
  const result = registry.registered[0].callback({ sourceEntity: fakePlayer(2) });
  assert.equal(result.status, 0);
  assert.match(result.message, /minecraft:cow/);
});

test("non-player origin is rejected, not crashed", () => {
  const result = inspect.requireOperator({});
  assert.equal(result.ok, false);
  assert.equal(result.result.status, 1);
});

test("source has no class-level registerCommand call", () => {
  const source = readFileSync(join(root, "scripts", "commands", "inspect.ts"), "utf8");
  assert.ok(source.includes("beforeEvents.startup.subscribe"), "must subscribe to the startup hook");
  assert.ok(!/CustomCommandRegistry\.registerCommand\s*\(/.test(source), "must not call registerCommand on the class");
});

test("existing verification gate still exits non-zero without a signature", () => {
  const env = { ...process.env };
  delete env.HUMAN_VERIFIED_SIGNATURE;
  let code = 0;
  try {
    execFileSync(process.execPath, [join(root, "test", "verify.js")], { env, stdio: "pipe" });
  } catch (error) {
    code = error.status;
  }
  assert.equal(code, 1);
});

console.log(passed ? `\nall ${passed} checks passed` : "\nno checks ran");
