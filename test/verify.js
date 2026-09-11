/**
 * JSON UI inventory text-slicing verification for issue #3.
 *
 * Asserts that #inventory_text_slice uses native Bedrock multiplication
 * form ('%.16s' * binding) instead of a bare '%.16s' expression, and that
 * Pocket/Desktop profiles plus text-preservation bindings are present.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const HUD_PATH = path.join(ROOT, 'ui', 'hud_screen.json');

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  ok  ${message}`);
    return;
  }

  failed += 1;
  errors.push(message);
  console.error(`  FAIL ${message}`);
}

function collectStrings(value, out = []) {
  if (typeof value === 'string') {
    out.push(value);
    return out;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStrings(item, out);
    }
    return out;
  }

  if (value && typeof value === 'object') {
    for (const nested of Object.values(value)) {
      collectStrings(nested, out);
    }
  }

  return out;
}

function findNamedControl(node, name) {
  if (!node || typeof node !== 'object') {
    return null;
  }

  if (Object.prototype.hasOwnProperty.call(node, name)) {
    return node[name];
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findNamedControl(item, name);
        if (found) {
          return found;
        }
      }
      continue;
    }

    if (value && typeof value === 'object') {
      const found = findNamedControl(value, name);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

function bindingsContainSlice(bindings) {
  if (!Array.isArray(bindings)) {
    return false;
  }

  return bindings.some((binding) => {
    if (typeof binding.source_property_name !== 'string') {
      return false;
    }

    const isNativeSlice = /^\('%\.16s' \* #[A-Za-z0-9_./]+\)$/.test(
      binding.source_property_name
    );

    return isNativeSlice && binding.target_property_name === '#inventory_text_slice';
  });
}

console.log('JSON UI text slicing verification (issue #3)');
console.log('');

console.log('1. File presence and JSON validity');
assert(fs.existsSync(HUD_PATH), 'ui/hud_screen.json exists');

let hud = null;
let raw = '';
try {
  raw = fs.readFileSync(HUD_PATH, 'utf8');
  hud = JSON.parse(raw);
  assert(true, 'ui/hud_screen.json parses as JSON');
} catch (error) {
  assert(false, `ui/hud_screen.json parses as JSON (${error.message})`);
}

console.log('');
console.log('2. Screen structure');
assert(hud?.namespace === 'hud', 'namespace is "hud"');
assert(hud?.hud_screen?.type === 'screen', 'hud_screen.type is "screen"');

console.log('');
console.log('3. Native string-slicing binding');
const label = findNamedControl(hud, 'inventory_text_slice_label');
assert(label !== null, 'inventory_text_slice_label control exists');
assert(label?.text === '#inventory_text_slice', 'label text binds #inventory_text_slice');
assert(bindingsContainSlice(label?.bindings), "slice uses ('%.16s' * #binding) form");

const allStrings = collectStrings(hud);
const bareSpecifier = allStrings.some(
  (value) => value === '%.16s' || value === "'%.16s'" || value === '"%.16s"'
);
assert(!bareSpecifier, 'no bare %.16s expression (must be multiplied with a binding)');
assert(
  allStrings.some((value) => value.includes("('%.16s' * #")),
  "at least one native ('%.16s' * #...) slice expression exists"
);

console.log('');
console.log('4. Text preservation bindings');
const preserved = findNamedControl(hud, 'inventory_text_preserved');
assert(preserved !== null, 'inventory_text_preserved control exists');
assert(
  Array.isArray(label?.notify_on_ellipses) &&
    label.notify_on_ellipses.includes('inventory_text_preserved'),
  'notify_on_ellipses preserves truncated text state'
);
assert(
  Array.isArray(preserved?.bindings) &&
    preserved.bindings.some((binding) => binding.source_property_name === '#using_ellipses'),
  'preserved label reacts to #using_ellipses'
);
assert(
  Array.isArray(label?.bindings) &&
    label.bindings.some(
      (binding) =>
        binding.binding_name === '#layout/InventoryItemName' &&
        binding.binding_name_override === '#inventory_item_name_full'
    ),
  'full item name is preserved on #inventory_item_name_full'
);

console.log('');
console.log('5. Responsive Pocket and Desktop profiles');
const pocket = hud?.hud_screen?.pocket_profile;
const desktop = hud?.hud_screen?.desktop_profile;
assert(pocket && typeof pocket === 'object', 'pocket_profile exists');
assert(desktop && typeof desktop === 'object', 'desktop_profile exists');
assert(
  bindingsContainSlice(pocket?.inventory_text_slice_label?.bindings),
  'pocket_profile keeps native 16-byte slice binding'
);
assert(
  bindingsContainSlice(desktop?.inventory_text_slice_label?.bindings),
  'desktop_profile keeps native 16-byte slice binding'
);

console.log('');
console.log('6. Inventory grid present for container layout');
const grid = findNamedControl(hud, 'inventory_grid');
assert(grid !== null, 'inventory_grid exists');
assert(grid?.type === 'grid', 'inventory_grid type is grid');

console.log('');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  console.error('');
  console.error('Failed assertions:');
  for (const message of errors) {
    console.error(`  - ${message}`);
  }
  process.exit(1);
}

console.log('');
console.log('All invariants passed.');
process.exit(0);
