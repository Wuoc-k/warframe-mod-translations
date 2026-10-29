import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, readdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
export const root = new URL('../', import.meta.url);
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export async function readJSON(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}
export async function atomicJSON(path, value) {
  await mkdir(new URL('.', path), { recursive: true });
  await writeFile(new URL(path.href + '.tmp'), JSON.stringify(value));
  await rename(new URL(path.href + '.tmp'), path);
}
export async function getJSON(url, { cacheDir = new URL('.cache/http/', root), fetcher = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  const path = new URL(hash(url) + '.json', cacheDir);
  const cached = await readJSON(path, null);
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetcher(url, { headers: { 'User-Agent': 'WarframeModTranslations/1.0 (GitHub fansite)', ...(cached?.etag ? { 'If-None-Match': cached.etag } : {}) }, signal: AbortSignal.timeout(45000) });
      if (response.status === 304 && cached) return cached.data;
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${url}`);
        error.retry = response.status === 429 || response.status >= 500;
        const retryAfter = response.headers.get('retry-after');
        error.delay = retryAfter ? Math.min(60000, Math.max(1000, Number(retryAfter) * 1000 || Date.parse(retryAfter) - Date.now() || 0)) : 0;
        throw error;
      }
      const data = await response.json();
      await atomicJSON(path, { etag: response.headers.get('etag'), data });
      return data;
    } catch (error) {
      if (error.retry === false || attempt === 3) throw error;
      await sleep(error.delay || 1000 * 2 ** attempt);
    }
  }
}
export const clean = value => typeof value === 'string' && value.trim() && !value.startsWith('/Lotus/') ? value.replace(/<[^>]*>/g, '').trim() : null;
export function categories(id, mod) {
  const t = mod.type;
  if (/Railjack/.test(id)) return ['Railjack'];
  if (/Necromech|Necramech/.test(id + mod.compatName)) return ['Necramech'];
  if (['ARCHWING', 'ARCH-GUN', 'ARCH-MELEE'].includes(t)) return ['Archwing'];
  if (['KAVAT', 'KUBROW', 'SENTINEL', 'HELMINTH CHARGER'].includes(t)) return ['Companion'];
  return [{ WARFRAME: 'Warframe', AURA: 'Warframe', STANCE: 'Melee', MELEE: 'Melee', PRIMARY: 'Primary', SECONDARY: 'Secondary' }[t] || 'Other'];
}
export function normalize(upgrades, dicts, images, avionics = {}) {
  if (!upgrades || Array.isArray(upgrades) || Object.keys(upgrades).length === 0) throw Error('Invalid ExportUpgrades schema');
  if (!dicts.en || !dicts.de) throw Error('English and German dictionaries are required');
  const mods = [], excluded = [];
  // Upgrades wins when both exports contain the same stable ID.
  for (const [id, mod] of Object.entries({ ...avionics, ...upgrades })) {
    const name = clean(dicts.en[mod.name]);
    if (mod.isFrivolous || mod.isFrivilous || mod.excludeFromCodex || !name || mod.name === '/Lotus/Language/Items/EmptyArtifact') { excluded.push(id); continue; }
    if (!id.startsWith('/Lotus/') || typeof mod.name !== 'string') throw Error('Unexpected mod identity');
    const translations = Object.fromEntries(Object.entries(dicts).map(([lang, dict]) => [lang, clean(dict[mod.name])]));
    const tags = [];
    if (mod.type === 'AURA') tags.push('Aura');
    if (mod.type === 'STANCE') tags.push('Stance');
    if (mod.isUtility) tags.push('Exilus');
    if (/Augment/.test(id)) tags.push('Augment');
    for (const prefix of ['Primed', 'Umbral', 'Archon']) if (name.startsWith(prefix + ' ')) tags.push(prefix);
    if (mod.isStarter) tags.push('Flawed');
    if (/PvP/.test(id)) tags.push('Conclave');
    let image = null;
    // Require an exact exported texture path. Never guess a wiki filename.
    const info = images[mod.icon];
    if (/^\/Lotus\/[\w/ .-]+\.(png|jpg)$/i.test(mod.icon)) {
      image = info?.contentHash ? `https://content.warframe.com/PublicExport${mod.icon}!${info.contentHash}` : `https://browse.wf${mod.icon}`;
    }
    mods.push({ id, name, translations, categories: categories(id, mod), tags, rarity: mod.rarity || null, image,
      wikiUrl: `https://wiki.warframe.com/w/Special:Search?search=${encodeURIComponent(name)}`,
      metadata: { type: mod.type || null, compatibility: mod.compatName || null, polarity: mod.polarity || null, baseDrain: mod.baseDrain ?? null, maxRank: mod.fusionLimit ?? null, tradable: mod.tradable ?? null, codexSecret: mod.codexSecret ?? null },
      sources: { export: Object.hasOwn(upgrades, id) ? 'ExportUpgrades.json' : 'ExportAvionics.json', nameKey: mod.name, icon: mod.icon || null } });
  }
  mods.sort((a, b) => a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id));
  return { mods, excluded };
}
export function validate(mods, previous = [], languages = ['en', 'de']) {
  if (!Array.isArray(mods) || !mods.length) throw Error('Empty mod collection');
  const seen = new Set();
  for (const m of mods) {
    if (typeof m.id !== 'string' || !m.id.startsWith('/Lotus/') || seen.has(m.id)) throw Error(`Invalid/duplicate ID: ${m.id}`);
    seen.add(m.id);
    if (!clean(m.name) || m.translations?.en !== m.name || !Array.isArray(m.categories) || !m.categories.length || !Array.isArray(m.tags) || !m.sources?.nameKey || !m.metadata) throw Error(`Invalid mod: ${m.id}`);
    for (const lang of languages) if (!Object.hasOwn(m.translations, lang) || (m.translations[lang] !== null && !clean(m.translations[lang]))) throw Error(`Invalid translation: ${lang}/${m.id}`);
    if (m.image !== null && !/^https:\/\/(content\.warframe\.com\/PublicExport\/Lotus\/|browse\.wf\/Lotus\/|wiki\.warframe\.com\/images\/)/.test(m.image)) throw Error('Untrusted image URL');
    if (!m.wikiUrl.startsWith('https://wiki.warframe.com/w/')) throw Error('Invalid wiki URL');
  }
  if (previous.length && mods.length < previous.length * .9) throw Error('Safety stop: more than 10% of mods removed');
  if (previous.length && previous.filter(m => !seen.has(m.id)).length > previous.length * .1) throw Error('Safety stop: more than 10% of stable IDs disappeared');
  const oldImages = previous.filter(m => m.image).length;
  if (oldImages && mods.filter(m => m.image).length < oldImages * .9) throw Error('Safety stop: image reference loss');
  const oldCards = previous.filter(m => m.imageKind === 'card').length;
  if (oldCards && mods.filter(m => m.imageKind === 'card').length < oldCards * .9) throw Error('Safety stop: complete card reference loss');
  for (const lang of languages) {
    const oldCount = previous.filter(m => m.translations[lang]).length;
    if (oldCount && mods.filter(m => m.translations[lang]).length < oldCount * .9) throw Error(`Safety stop: translation loss in ${lang}`);
  }
  return true;
}
export function changes(before, after) {
  const old = new Map(before.map(m => [m.id, m])), next = new Map(after.map(m => [m.id, m]));
  return { added: after.filter(m => !old.has(m.id)).map(m => m.id), removed: before.filter(m => !next.has(m.id)).map(m => m.id), changed: after.filter(m => old.has(m.id) && hash(old.get(m.id)) !== hash(m)).map(m => m.id) };
}
export async function publishSnapshot(dir, manifest, mods, delta, write = atomicJSON) {
  validate(mods, [], manifest.languages);
  if (!/^[a-f0-9]{16}$/.test(manifest.version) || hash(mods) !== manifest.contentHash) throw Error('Invalid snapshot integrity');
  for (let i = 0; i < mods.length; i += 128) await write(new URL(`${manifest.version}/mods-${i / 128}.json`, dir), mods.slice(i, i + 128));
  const index = mods.map((m, i) => ({ id: m.id, name: m.name, translations: m.translations, categories: m.categories, tags: m.tags, rarity: m.rarity, image: m.image, artwork: m.artwork || null, imageKind: m.imageKind || 'artwork', wikiUrl: m.wikiUrl, metadata: { compatibility: m.metadata.compatibility, maxRank: m.metadata.maxRank, baseDrain: m.metadata.baseDrain, polarity: m.metadata.polarity }, shard: Math.floor(i / 128) }));
  await write(new URL(manifest.index, dir), index);
  await write(new URL(manifest.initial, dir), index.slice(0, 48));
  await write(new URL(manifest.changes, dir), delta);
  // Only this final atomic rename makes the new dataset visible.
  await write(new URL('manifest.json', dir), manifest);
}
export async function pruneSnapshots(dir, keep) {
  const base = resolve(fileURLToPath(dir));
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^[a-f0-9]{16}$/.test(entry.name) || keep.includes(entry.name)) continue;
    const target = resolve(base, entry.name);
    if (!target.startsWith(base + sep)) throw Error('Unsafe snapshot cleanup path');
    await rm(target, { recursive: true });
  }
}
export function enrichCards(mods, items) {
  if (!Array.isArray(items)) throw Error('Invalid card mapping schema');
  const byId = new Map();
  const articles = new Map();
  for (const item of items) {
    if (typeof item.uniqueName !== 'string') continue;
    if (typeof item.wikiaUrl === 'string') {
      let article; try { article = new URL(item.wikiaUrl); } catch {}
      if (article?.protocol === 'https:' && article.hostname === 'wiki.warframe.com' && article.pathname.startsWith('/w/') && !article.username && !article.password) {
        if (!articles.has(item.uniqueName)) articles.set(item.uniqueName, article.href);
        else if (articles.get(item.uniqueName) !== article.href) articles.set(item.uniqueName, null);
      }
    }
    if (typeof item.uniqueName !== 'string' || typeof item.wikiaThumbnail !== 'string') continue;
    let url; try { url = new URL(item.wikiaThumbnail); } catch { continue; }
    if (url.protocol !== 'https:' || url.hostname !== 'wiki.warframe.com' || !url.pathname.startsWith('/images/') || !/\.(png|webp|jpg)$/i.test(url.pathname)) continue;
    if (byId.has(item.uniqueName) && byId.get(item.uniqueName) !== url.href) byId.set(item.uniqueName, null);
    else if (!byId.has(item.uniqueName)) byId.set(item.uniqueName, url.href);
  }
  return mods.map(mod => {
    const card = byId.get(mod.id);
    return { ...mod, wikiUrl: articles.get(mod.id) || mod.wikiUrl, artwork: mod.image, image: card || mod.image, imageKind: card ? 'card' : 'artwork', sources: { ...mod.sources, card: card ? 'WFCD/warframe-items: uniqueName → wikiaThumbnail' : null } };
  });
}
