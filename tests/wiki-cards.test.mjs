import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { applyWikiCards, validWikiCard, supplementWikiCards } from '../scripts/wiki-cards.mjs';

const entry = {
  id: '/Lotus/Powersuits/Volt/OverloadAugmentCard', name: 'Capacitance', title: 'Capacitance', pageId: 696159,
  wikiUrl: 'https://wiki.warframe.com/w/Capacitance', image: 'https://wiki.warframe.com/images/CapacitanceMod.png?c84eb', width: 248, height: 364
};
const mod = { id: entry.id, name: entry.name, wikiUrl: entry.wikiUrl, image: 'https://browse.wf/Lotus/Volt.png', imageKind: 'artwork', sources: {} };

test('verified Wiki card restores Capacitance by exact ID and article title', () => {
  const [restored] = applyWikiCards([mod], [entry]);
  assert.equal(restored.image, entry.image);
  assert.equal(restored.imageKind, 'card');
  assert.equal(restored.artwork, mod.image);
  assert.match(restored.sources.card, /696159/);
  assert.equal(applyWikiCards([{ ...mod, imageKind: 'card', image: 'existing' }], [entry])[0].image, 'existing');
});

test('Wiki supplementation rejects mismatched, ambiguous, unsafe and non-card images', () => {
  for (const invalid of [
    { ...entry, id: '/Lotus/Wrong' }, { ...entry, name: 'Different' }, { ...entry, title: 'Volt' },
    { ...entry, image: 'https://untrusted.invalid/images/Card.png' },
    { ...entry, wikiUrl: 'https://wiki.warframe.com/w/Volt' },
    { ...entry, width: 300, height: 169 }, { ...entry, width: undefined }, { ...entry, height: undefined }
  ]) assert.equal(validWikiCard(invalid, mod), false);
  assert.equal(applyWikiCards([mod], [entry, { ...entry, image: 'https://wiki.warframe.com/images/Other.png' }])[0].imageKind, 'artwork');
});

test('HTTP 403 keeps the checked-in verified card mapping usable without changes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'warframe-wiki-'));
  const path = pathToFileURL(join(dir, 'wiki-cards.json'));
  try {
    const stored = JSON.stringify({ entries: [entry] });
    await writeFile(path, stored);
    let calls = 0;
    const result = await supplementWikiCards([mod], { path, request: async () => { calls++; throw Error('HTTP 403'); }, log: () => {} });
    assert.equal(result[0].imageKind, 'card');
    assert.equal(calls, 1);
    assert.equal(await readFile(path, 'utf8'), stored);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('live pageimages responses supplement exact titles and persist verified references', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'warframe-wiki-live-'));
  const path = pathToFileURL(join(dir, 'wiki-cards.json'));
  try {
    const result = await supplementWikiCards([mod], { path, request: async url => {
      assert.equal(new URL(url).searchParams.get('titles'), 'Capacitance');
      return { query: { pages: [{ title: entry.title, pageid: entry.pageId, original: { source: entry.image, width: entry.width, height: entry.height } }] } };
    } });
    assert.equal(result[0].image, entry.image);
    assert.equal(JSON.parse(await readFile(path, 'utf8')).entries[0].pageId, entry.pageId);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
