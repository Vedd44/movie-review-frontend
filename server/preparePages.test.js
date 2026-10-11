const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { getPageData, renderPage, escapeHtml } = require('./pageData');
const { OCTOBER_START, OCTOBER_END } = require('../src/featuredCollections');

test('the actual postbuild script keeps static homepage evergreen across campaign dates', async () => {
  for (const now of [OCTOBER_START, OCTOBER_END - 1, OCTOBER_END]) {
    const writes = new Map();
    const pending = [];
    const shell = '<html><head><title>ReelBot</title></head><body><div id="root"></div></body></html>';
    const mockFs = { mkdirSync() {}, copyFileSync() {}, readFileSync: () => shell, writeFileSync: (file, value) => writes.set(file, value) };
    const requireStub = id => {
      if (id === 'node:fs') return mockFs;
      if (id === 'node:path') return path;
      if (id === '../server/sitemap') return {buildSitemap: () => '', fetchDiscoveryPaths: async () => []};
      if (id === '../src/generatedDiscoveryPaths.json') return [];
      if (id === '../server/collections') return require('./collections');
      if (id === '../src/generatedCollectionMovies.json') return {};
      if (id === '../server/pageData') return {escapeHtml, renderPage, getPageData: (route, params, options) => {
        assert.equal(options.featuredMode, 'evergreen');
        const promise = getPageData(route, params, {...options, now, fetcher: async () => ({ok:true, json:async()=>({results:[]})})});
        pending.push(promise); return promise;
      }};
      throw new Error(`Unexpected dependency ${id}`);
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../scripts/prepare-pages.js'), 'utf8'), {
      require: requireStub, __dirname: path.join(__dirname, '../scripts'), URLSearchParams, console: {log() {}, error: assert.fail}, process: {},
    });
    await Promise.all(pending);
    await new Promise(resolve => setImmediate(resolve));
    const html = writes.get('build/index.html');
    assert.ok(html.includes('/collections/best-90s-action-movies'));
    assert.ok(!html.includes('/collections/best-halloween-movies'));
    assert.ok(!html.includes('Oh, the Horror!'));
  }
});
