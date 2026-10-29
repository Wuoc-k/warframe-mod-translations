import { readJSON, root, validate, hash } from './lib.mjs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
export async function validateSnapshot() {
  const manifest = await readJSON(new URL('data/manifest.json', root));
  const mods = (await Promise.all(manifest.shards.map(p => readJSON(new URL('data/' + p, root))))).flat();
  validate(mods, [], manifest.languages);
  if (mods.length !== manifest.count || hash(mods) !== manifest.contentHash) throw Error('Manifest integrity mismatch');
  const index = await readJSON(new URL('data/' + manifest.index, root));
  if (index.length !== mods.length || index.some((m, i) => m.id !== mods[i].id || m.shard !== Math.floor(i / 128) || hash(m.translations) !== hash(mods[i].translations))) throw Error('Search index mismatch');
  if (manifest.schemaVersion >= 2 && index.some((m, i) => m.wikiUrl !== mods[i].wikiUrl || ['compatibility', 'maxRank', 'baseDrain', 'polarity'].some(key => m.metadata?.[key] !== mods[i].metadata[key]))) throw Error('Listing metadata mismatch');
  return { manifest, mods };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log('Validated', (await validateSnapshot()).mods.length, 'mods');
