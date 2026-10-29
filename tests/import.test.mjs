import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalize, validate, changes, getJSON, atomicJSON, publishSnapshot, hash, pruneSnapshots, enrichCards } from '../scripts/lib.mjs';
import { validateSnapshot } from '../scripts/validate.mjs';
import { prepare, selectMods, fold } from '../src/search.js';
const fixture = JSON.parse(await readFile(new URL('fixtures/source.json', import.meta.url)));
const run = (images = {}, avionics = {}) => normalize(fixture.upgrades, fixture.dicts, images, avionics);
test('translation joins use keys; same-name variants keep distinct stable IDs', () => {
  const { mods, excluded } = run();
  assert.equal(mods.length, 2); assert.equal(excluded.length, 2);
  assert.equal(mods[0].translations.de, 'Vitalität'); assert.equal(mods[0].translations.fr, null);
  assert.notEqual(mods[0].id, mods[1].id); assert.ok(mods.some(m => m.tags.includes('Flawed')));
  assert.ok(validate(mods, [], ['en','de','fr']));
});
test('exact image mapping and safe fallback do not guess wiki filenames', () => {
  const path = fixture.upgrades[Object.keys(fixture.upgrades)[0]].icon;
  assert.ok(run().mods.some(m => m.image === 'https://browse.wf' + path));
  assert.ok(run({ [path]: { contentHash: '00_test' } }).mods.some(m => m.image.endsWith('!00_test')));
  assert.ok(run().mods.some(m => m.image === null));
});
test('full cards join only by stable ID and reject ambiguous or untrusted mappings', () => {
  const { mods } = run();
  const item = { uniqueName: mods[0].id, wikiaThumbnail: 'https://wiki.warframe.com/images/VitalityMod.png?ac1e5', wikiaUrl: 'https://wiki.warframe.com/w/Vitality' };
  const enriched = enrichCards(mods, [item, { uniqueName: '/Lotus/Unknown', name: 'Vitality', wikiaThumbnail: item.wikiaThumbnail }]);
  assert.equal(enriched[0].image, item.wikiaThumbnail);
  assert.equal(enriched[0].imageKind, 'card');
  assert.equal(enriched[0].wikiUrl, 'https://wiki.warframe.com/w/Vitality');
  assert.equal(enriched[0].artwork, mods[0].image);
  assert.equal(enriched[1].imageKind, 'artwork');
  assert.ok(validate(enriched, [], ['en','de','fr']));
  assert.throws(() => validate(mods, enriched, ['en','de','fr']), /complete card reference loss/);
  assert.equal(enrichCards(mods, [{ ...item, wikiaThumbnail: 'https://untrusted.invalid/images/Vitality.png' }])[0].imageKind, 'artwork');
  assert.equal(enrichCards(mods, [item, { ...item, wikiaThumbnail: 'https://wiki.warframe.com/images/Different.png' }])[0].imageKind, 'artwork');
  assert.equal(enrichCards(mods, [{ ...item, wikiaUrl: 'https://untrusted.invalid/w/Vitality' }])[0].wikiUrl, mods[0].wikiUrl);
});
test('merge overlapping sources by ID with upgrades taking precedence', () => {
  const { mods } = run({}, fixture.upgrades); assert.equal(mods.length, 2);
  assert.equal(new Set(mods.map(m => m.id)).size, 2);
});
test('validation rejects duplicates, malformed records, empty exports and large losses', () => {
  const { mods } = run();
  assert.throws(() => validate([...mods, mods[0]]), /duplicate/);
  assert.throws(() => validate([]), /Empty/);
  assert.throws(() => normalize([], fixture.dicts, {}), /schema/);
  assert.throws(() => normalize(fixture.upgrades, { en: {} }, {}), /dictionaries/);
  assert.throws(() => validate(mods.slice(0, 1), mods), /Safety stop/);
  assert.throws(() => validate(mods.map((m, i) => ({...m, id: `/Lotus/Replaced${i}`})), mods), /stable IDs/);
  assert.throws(() => validate(mods.map(m => ({...m, image: null})), mods), /image reference loss/);
  assert.throws(() => validate([{ ...mods[0], translations: { en: mods[0].name, de: null } }], [mods[0]]), /translation loss/);
  assert.throws(() => validate([{ ...mods[0], image: 'https://untrusted.invalid/x' }]), /image/);
});
test('detect added, changed and removed entries', () => {
  const { mods } = run(); const after = [{ ...mods[0], rarity: 'RARE' }, { ...mods[1], id: '/Lotus/New' }];
  const delta = changes(mods, after); assert.equal(delta.changed.length, 1); assert.equal(delta.added.length, 1); assert.equal(delta.removed.length, 1);
});
test('search handles translations, partial text, accents and combined filters', () => {
  const mods = prepare(run().mods);
  assert.equal(selectMods(mods, { query: 'VITALITAT' }).length, 2);
  assert.equal(selectMods(mods, { query: 'vital', category: 'Warframe', tag: 'Flawed' }).length, 1);
  assert.equal(selectMods(mods, { query: 'vital', category: 'Melee' }).length, 0);
  assert.equal(fold('Straße Énergie'), 'strasse energie');
});
test('network retries honor backoff and 304 reuses conditional cache', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'warframe-test-')); const cacheDir = pathToFileURL(dir + '/');
  let calls = 0; const delays = [];
  try {
    const result = await getJSON('https://example.test/export', { cacheDir, sleep: async ms => delays.push(ms), fetcher: async () => ++calls < 3 ? new Response('', { status: 503 }) : new Response('{"valid":true}', { headers: { etag: 'abc' } }) });
    assert.deepEqual(result, { valid: true }); assert.deepEqual(delays, [1000,2000]);
    await getJSON('https://example.test/export', { cacheDir, fetcher: async (url, options) => { assert.equal(options.headers['If-None-Match'], 'abc'); return new Response(null, { status: 304 }); } });
    let permanent = 0;
    await assert.rejects(getJSON('https://example.test/404', { cacheDir, fetcher: async () => { permanent++; return new Response('', { status: 404 }); } }), /HTTP 404/);
    assert.equal(permanent, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('failed staging never replaces the previous manifest', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'warframe-safe-')); const pointer = pathToFileURL(join(dir,'manifest.json'));
  try {
    await atomicJSON(pointer, { version: 'working' });
    const { mods } = run(), contentHash = hash(mods), version = contentHash.slice(0, 16);
    const manifest = { version, contentHash, languages: ['en','de','fr'], shards: [`${version}/mods-0.json`], index: `${version}/index.json`, initial: `${version}/initial.json`, changes: `${version}/changes.json` };
    const dataDir = pathToFileURL(dir + '/');
    let writes = 0;
    await assert.rejects(publishSnapshot(dataDir, manifest, mods, {}, async (path, data) => { if (++writes === 3) throw Error('Simulated disk failure'); await atomicJSON(path, data); }), /disk failure/);
    assert.deepEqual(JSON.parse(await readFile(pointer, 'utf8')), { version: 'working' });
    await assert.rejects(publishSnapshot(dataDir, manifest, [], {}), /Empty/);
    assert.deepEqual(JSON.parse(await readFile(pointer, 'utf8')), { version: 'working' });
    await publishSnapshot(dataDir, manifest, mods, {});
    assert.equal(JSON.parse(await readFile(pointer, 'utf8')).version, version);
    assert.equal(JSON.parse(await readFile(new URL(manifest.index, dataDir), 'utf8')).length, mods.length);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('real snapshot integrity, official names, languages, categories and image coverage', async () => {
  const { manifest, mods } = await validateSnapshot();
  assert.ok(mods.length > 1000); assert.ok(manifest.languages.length >= 15);
  const vitality = mods.find(m => m.id === '/Lotus/Upgrades/Mods/Warframe/AvatarHealthMaxMod');
  assert.equal(vitality.name, 'Vitality'); assert.equal(vitality.translations.de, 'Vitalität');
  assert.equal(vitality.imageKind, 'card'); assert.match(vitality.image, /\/images\/VitalityMod\.png/);
  assert.ok(mods.some(m => m.categories.includes('Necramech'))); assert.ok(mods.some(m => m.categories.includes('Railjack')));
  assert.ok(mods.filter(m => m.image).length > mods.length * .9);
});
test('snapshot cleanup retains active, previous and unrelated directories', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'warframe-prune-'));
  try {
    for (const name of ['aaaaaaaaaaaaaaaa','bbbbbbbbbbbbbbbb','cccccccccccccccc','manual']) await mkdir(join(dir,name));
    await pruneSnapshots(pathToFileURL(dir + '/'), ['aaaaaaaaaaaaaaaa','bbbbbbbbbbbbbbbb']);
    assert.deepEqual((await readdir(dir)).sort(), ['aaaaaaaaaaaaaaaa','bbbbbbbbbbbbbbbb','manual']);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
