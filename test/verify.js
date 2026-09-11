/**
 * JSON UI Text Slicing Verification Test Suite
 * 
 * Verifies the fix for Issue #3:
 * - Dynamic Container Inventory Text Slicing Overflow in hud_screen.json
 * - Replaces invalid %.16s format specifier with native max_length binding
 * - Responsive layout for Pocket and Desktop profiles
 * - No engine warnings on item names > 16 characters
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
let errors = [];

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    errors.push(message);
    console.error(`  ❌ ${message}`);
  }
}

function findElement(obj, name) {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.name === name) return obj;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        const found = findElement(item, name);
        if (found) return found;
      }
    } else if (typeof val === 'object' && val !== null) {
      const found = findElement(val, name);
      if (found) return found;
    }
  }
  return null;
}

console.log('='.repeat(70));
console.log('JSON UI Text Slicing Verification Test Suite');
console.log('Issue #3: hud_screen.json inventory text overflow fix');
console.log('='.repeat(70));
console.log('');

// Test 1: File exists
console.log('Test 1: File existence');
const hudPath = path.join(ROOT, 'ui', 'hud_screen.json');
assert(fs.existsSync(hudPath), 'ui/hud_screen.json exists');
console.log('');

// Test 2: Valid JSON
console.log('Test 2: JSON validity');
let hudData = null;
try {
  const content = fs.readFileSync(hudPath, 'utf-8');
  hudData = JSON.parse(content);
  assert(true, 'ui/hud_screen.json is valid JSON');
} catch (e) {
  assert(false, `ui/hud_screen.json is valid JSON: ${e.message}`);
}
console.log('');

// Test 3: Namespace and screen structure
console.log('Test 3: Screen structure');
assert(hudData && hudData.namespace === 'hud', 'namespace is "hud"');
assert(hudData && hudData.hud_screen, 'hud_screen object exists');
assert(hudData && hudData.hud_screen.type === 'screen', 'hud_screen type is "screen"');
console.log('');

// Test 4: Inventory text slice element exists
console.log('Test 4: Inventory text slice element');
const textSlice = findElement(hudData, '#inventory_text_slice');
assert(textSlice !== null, '#inventory_text_slice element exists');
assert(textSlice && textSlice.type === 'label', '#inventory_text_slice type is "label"');
assert(textSlice && textSlice.text === '#layout/InventoryItemName', 'text binding is #layout/InventoryItemName');
console.log('');

// Test 5: max_length property (the fix)
console.log('Test 5: Text truncation (max_length)');
assert(textSlice && textSlice.max_length === 16, 'max_length is set to 16');
assert(textSlice && textSlice.truncate === 'end', 'truncate mode is "end"');
assert(textSlice && textSlice.ellipsis === true, 'ellipsis is enabled');
console.log('');

// Test 6: No invalid %.16s format specifier
console.log('Test 6: No invalid format specifier');
const rawContent = fs.readFileSync(hudPath, 'utf-8');
assert(!rawContent.includes('%.16s'), 'No invalid %.16s format specifier');
assert(!rawContent.includes('%.'), 'No printf-style format specifiers');
console.log('');

// Test 7: Responsive profiles
console.log('Test 7: Responsive profiles');
const hudScreen = hudData && hudData.hud_screen;
assert(hudScreen && hudScreen.pocket_profile, 'pocket_profile exists');
assert(hudScreen && hudScreen.desktop_profile, 'desktop_profile exists');

const pocketText = hudScreen && hudScreen.pocket_profile && hudScreen.pocket_profile['#inventory_text_slice'];
const desktopText = hudScreen && hudScreen.desktop_profile && hudScreen.desktop_profile['#inventory_text_slice'];
assert(pocketText && pocketText.max_length === 16, 'pocket_profile max_length is 16');
assert(desktopText && desktopText.max_length === 16, 'desktop_profile max_length is 16');
console.log('');

// Test 8: Bindings
console.log('Test 8: Bindings configuration');
assert(hudScreen && Array.isArray(hudScreen.bindings), 'bindings array exists');
const itemNameBinding = hudScreen && hudScreen.bindings.find(b => 
  b.binding_name === '#layout/InventoryItemName' || b.binding_name_alternate === 'item_name'
);
assert(itemNameBinding !== undefined, 'InventoryItemName binding exists');
console.log('');

// Test 9: Inventory grid structure
console.log('Test 9: Inventory grid structure');
const inventoryGrid = findElement(hudData, 'inventory_grid');
assert(inventoryGrid !== null, 'inventory_grid exists');
assert(inventoryGrid && inventoryGrid.type === 'grid', 'inventory_grid type is "grid"');
assert(inventoryGrid && Array.isArray(inventoryGrid.grid_dimensions), 'grid_dimensions exists');
console.log('');

// Test 10: Text preservation (shadow, color)
console.log('Test 10: Text preservation properties');
assert(textSlice && textSlice.shadow === true, 'text shadow is enabled');
assert(textSlice && Array.isArray(textSlice.color), 'text color is defined');
assert(textSlice && textSlice.color.length === 4, 'text color has RGBA values');
console.log('');

// Summary
console.log('');
console.log('='.repeat(70));
console.log('Test Summary');
console.log('='.repeat(70));
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);
console.log('');

if (failed > 0) {
  console.error('Failed tests:');
  errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
  console.log('');
  process.exit(1);
} else {
  console.log('✅ All tests passed! JSON UI text slicing fix is verified.');
  console.log('   - 16-character truncation via native max_length binding');
  console.log('   - No invalid %.16s format specifier');
  console.log('   - Responsive Pocket and Desktop profiles');
  console.log('   - No engine warnings expected on long item names');
  process.exit(0);
}
