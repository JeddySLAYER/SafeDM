/**
 * Nitro 0.33.2 calls ReactModuleInfo without hasConstants.
 * React Native 0.76 still requires that argument, and the other overload
 * uses different parameter names, so Kotlin rejects the call.
 */
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-nitro-modules',
  'android',
  'src',
  'main',
  'java',
  'com',
  'margelo',
  'nitro',
  'NitroModulesPackage.kt',
);

if (!fs.existsSync(target)) {
  process.exit(0);
}

const source = fs.readFileSync(target, 'utf8');
if (source.includes('hasConstants = false')) {
  process.exit(0);
}

const needle = 'needsEagerInit = false,\n          isCxxModule = false,';
const patched = 'needsEagerInit = false,\n          hasConstants = false,\n          isCxxModule = false,';

if (!source.includes(needle)) {
  console.warn('patch-nitro-rn76: NitroModulesPackage.kt layout changed, skipped');
  process.exit(0);
}

fs.writeFileSync(target, source.replace(needle, patched));
console.log('patch-nitro-rn76: added hasConstants = false');
