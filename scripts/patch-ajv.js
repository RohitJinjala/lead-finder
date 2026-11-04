const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../node_modules/schema-utils/node_modules/ajv');
const destDir = path.resolve(__dirname, '../node_modules/ajv-keywords/node_modules');
const dest = path.resolve(destDir, 'ajv');

if (fs.existsSync(src) && !fs.existsSync(dest)) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log('[patch-ajv] Copied ajv v8 to ajv-keywords/node_modules/ajv');
}

