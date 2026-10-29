import { mkdir, writeFile } from 'node:fs/promises';
import { root, getJSON, readJSON, normalize, validate, changes, hash, publishSnapshot, pruneSnapshots, enrichCards } from './lib.mjs';
import { supplementWikiCards } from './wiki-cards.mjs';
const repo = 'https://api.github.com/repos/calamity-inc/warframe-public-export-plus';
// Pin every file to one upstream revision, including discovered dictionaries.
const commit = await getJSON(`${repo}/commits/senpai`);
if (!/^[a-f0-9]{40}$/.test(commit.sha)) throw Error('Invalid upstream revision');
const tree = await getJSON(`${repo}/git/trees/${commit.sha}`);
const base = `https://raw.githubusercontent.com/calamity-inc/warframe-public-export-plus/${commit.sha}/`;
const files = tree.tree.filter(f => /^dict\.[a-z]{2}\.json$/.test(f.path));
if (!files.some(f => f.path === 'dict.en.json') || !files.some(f => f.path === 'dict.de.json')) throw Error('Dictionary discovery failed');
const dicts = {};
for (const { path } of files) {
  console.log(`Loading ${path}`);
  dicts[path.split('.')[1]] = await getJSON(base + path);
  if (Object.keys(dicts[path.split('.')[1]]).length < 10000) throw Error(`Incomplete dictionary: ${path}`);
}
const upgrades = await getJSON(base + 'ExportUpgrades.json');
const avionics = await getJSON(base + 'ExportAvionics.json');
const images = await getJSON(base + 'ExportImages.json');
const cardsCommit = await getJSON('https://api.github.com/repos/WFCD/warframe-items/commits/master');
if (!/^[a-f0-9]{40}$/.test(cardsCommit.sha)) throw Error('Invalid card source revision');
const cardItems = await getJSON(`https://raw.githubusercontent.com/WFCD/warframe-items/${cardsCommit.sha}/data/json/Mods.json`);
const normalized = normalize(upgrades, dicts, images, avionics);
const mods = await supplementWikiCards(enrichCards(normalized.mods, cardItems)), excluded = normalized.excluded;
const dir = new URL('data/', root);
const previousManifest = await readJSON(new URL('manifest.json', dir), null);
let previous = [];
if (previousManifest) for (const file of previousManifest.shards) previous.push(...await readJSON(new URL(file, dir)));
const languages = Object.keys(dicts).sort();
validate(mods, previous, [...new Set([...languages, ...(previousManifest?.languages || [])])]);
if (mods.length < 1000) throw Error('Safety stop: implausibly small export');
const contentHash = hash(mods);
const schemaVersion = 2;
if (previousManifest?.contentHash === contentHash && previousManifest.schemaVersion === schemaVersion) {
  await pruneSnapshots(dir, [previousManifest.version, previousManifest.previousVersion]);
  console.log(`No data changes: ${mods.length} mods; keeping existing snapshot.`); process.exit(0);
}
await mkdir(dir, { recursive: true });
const version = hash({ schemaVersion, contentHash }).slice(0, 16);
const shards = [];
for (let i = 0; i < mods.length; i += 128) {
  const filename = `${version}/mods-${i / 128}.json`;
  shards.push(filename);
}
const delta = changes(previous, mods);
const manifest = { schemaVersion, version, previousVersion: previousManifest?.version || null, contentHash, updatedAt: new Date().toISOString(), upstreamRevision: commit.sha, languages, count: mods.length,
  imageCount: mods.filter(m => m.image).length, cardCount: mods.filter(m => m.imageKind === 'card').length, cardSourceRevision: cardsCommit.sha, excludedCount: excluded.length, missingTranslations: Object.fromEntries(languages.map(l => [l, mods.filter(m => !m.translations[l]).length])),
  categories: [...new Set(mods.flatMap(m => m.categories))].sort(), tags: [...new Set(mods.flatMap(m => m.tags))].sort(), rarities: [...new Set(mods.map(m => m.rarity).filter(Boolean))].sort(),
  index: `${version}/index.json`, initial: `${version}/initial.json`, shards, changes: `${version}/changes.json`, sources: { export: 'https://github.com/calamity-inc/warframe-public-export-plus', cards: 'https://github.com/WFCD/warframe-items', images: ['https://wiki.warframe.com/images/', 'https://content.warframe.com/PublicExport/', 'https://browse.wf/'], wiki: 'API returns HTTP 403; complete image URLs mapped by stable ID via WFCD; browser image delivery verified' } };
// Publish the pointer last. Failure before this line leaves the previous snapshot usable.
await publishSnapshot(dir, manifest, mods, delta);
await pruneSnapshots(dir, [version, previousManifest?.version]);
await writeFile(new URL('.nojekyll', root), '');
console.log(JSON.stringify({ mods: mods.length, images: manifest.imageCount, fullCards: manifest.cardCount, languages, excluded: excluded.length, added: delta.added.length, changed: delta.changed.length, removed: delta.removed.length }, null, 2));
