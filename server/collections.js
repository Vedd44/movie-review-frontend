const fs = require('node:fs');
const path = require('node:path');
// Read the exported data literal as JSON-compatible JS at build time, without
// maintaining a second collection list. This file is trusted repository source.
function readCollections() {
  const source = fs.readFileSync(path.join(__dirname, '../src/collections.js'), 'utf8');
  const literal = source.slice(source.indexOf('['), source.indexOf('\n];') + 2);
  return require('node:vm').runInNewContext(`(${literal})`, Object.create(null), { timeout: 1000 });
}
module.exports = { readCollections };
