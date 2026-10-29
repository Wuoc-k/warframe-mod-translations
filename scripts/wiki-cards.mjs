import { root, getJSON, readJSON, atomicJSON, hash } from './lib.mjs';

const endpoint = 'https://wiki.warframe.com/api.php?action=query&prop=pageimages&piprop=original&formatversion=2&format=json';
const titleFor = mod => mod.wikiUrl.includes('/Special:Search?')
  ? mod.name
  : decodeURIComponent(new URL(mod.wikiUrl).pathname.slice(3)).replaceAll('_', ' ');

export function validWikiCard(entry, mod) {
  if (!entry || entry.id !== mod.id || entry.name !== mod.name || entry.title !== titleFor(mod)) return false;
  if (!Number.isInteger(entry.pageId) || entry.pageId < 1 || !Number.isFinite(entry.width) || !Number.isFinite(entry.height) || entry.width < 150 || entry.height < 200 || entry.height <= entry.width || entry.height > entry.width * 2) return false;
  try {
    const image = new URL(entry.image), article = new URL(entry.wikiUrl);
    return image.origin === 'https://wiki.warframe.com' && !image.username && !image.password && image.pathname.startsWith('/images/') && /\.(png|webp|jpg)$/i.test(image.pathname)
      && article.origin === image.origin && !article.username && !article.password && article.pathname === '/w/' + encodeURIComponent(entry.title.replaceAll(' ', '_'));
  } catch { return false; }
}

export function applyWikiCards(mods, entries) {
  const byId = new Map();
  for (const entry of entries) {
    if (byId.has(entry.id) && hash(byId.get(entry.id)) !== hash(entry)) byId.set(entry.id, null);
    else if (!byId.has(entry.id)) byId.set(entry.id, entry);
  }
  return mods.map(mod => {
    const entry = byId.get(mod.id);
    if (mod.imageKind === 'card' || !validWikiCard(entry, mod)) return mod;
    return { ...mod, image: entry.image, imageKind: 'card', artwork: mod.artwork || mod.image, wikiUrl: entry.wikiUrl,
      sources: { ...mod.sources, card: `Warframe Wiki pageimages: page ${entry.pageId}` } };
  });
}

export async function supplementWikiCards(mods, { request = getJSON, path = new URL('sources/wiki-cards.json', root), log = console.warn } = {}) {
  const stored = await readJSON(path, { source: endpoint, entries: [] });
  if (!Array.isArray(stored.entries)) throw Error('Invalid verified Wiki mappings');
  const entries = new Map(stored.entries.map(entry => [entry.id, entry]));
  const missing = mods.filter(mod => mod.imageKind !== 'card');
  // MediaWiki permits 50 titles per anonymous query. No guessed image URLs.
  for (let start = 0; start < missing.length; start += 50) {
    const batch = missing.slice(start, start + 50);
    try {
      const response = await request(endpoint + '&titles=' + encodeURIComponent(batch.map(titleFor).join('|')));
      if (!Array.isArray(response.query?.pages)) throw Error('Unexpected Wiki pageimages response');
      for (const mod of batch) {
        const page = response.query.pages.find(page => page.title === titleFor(mod));
        if (!page?.original) continue;
        const entry = { id: mod.id, name: mod.name, title: page.title, pageId: page.pageid,
          wikiUrl: 'https://wiki.warframe.com/w/' + encodeURIComponent(page.title.replaceAll(' ', '_')),
          image: page.original.source, width: page.original.width, height: page.original.height };
        if (validWikiCard(entry, mod)) entries.set(mod.id, entry);
      }
    } catch (error) {
      log(`Wiki image lookup unavailable; retaining verified mappings. ${error.message}`);
      break; // Do not repeatedly query a host that denies automated access.
    }
  }
  const next = [...entries.values()].sort((a, b) => a.id.localeCompare(b.id));
  if (hash(next) !== hash([...stored.entries].sort((a, b) => a.id.localeCompare(b.id)))) await atomicJSON(path, { source: endpoint, entries: next });
  return applyWikiCards(mods, next);
}
