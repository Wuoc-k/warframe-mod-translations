export const fold = s => String(s || '').toLocaleLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/ß/g, 'ss').replace(/æ/g, 'ae').replace(/œ/g, 'oe');
export function prepare(mods) { return mods.map(m => ({ ...m, search: fold(Object.values(m.translations).filter(Boolean).join('\n')) })); }
const rarityOrder = ['COMMON', 'UNCOMMON', 'RARE', 'LEGENDARY'];
const rarityRank = value => { const index = rarityOrder.indexOf(value); return index < 0 ? rarityOrder.length : index; };
export const sortRarities = values => [...values].sort((a, b) => rarityRank(a) - rarityRank(b) || String(a).localeCompare(String(b)));
export function selectMods(mods, { query = '', category = '', tag = '', rarity = '', sort = 'name', sortLanguage = 'en' } = {}) {
  const terms = fold(query).trim().split(/\s+/).filter(Boolean);
  const filtered = mods.filter(m => terms.every(t => m.search.includes(t)) && (!category || m.categories.includes(category)) && (!tag || m.tags.includes(tag)) && (!rarity || m.rarity === rarity));
  return filtered.sort((a, b) => sort === 'category' ? a.categories.join().localeCompare(b.categories.join()) || a.name.localeCompare(b.name) : sort === 'rarity' ? rarityRank(a.rarity) - rarityRank(b.rarity) || a.name.localeCompare(b.name) : (a.translations[sortLanguage] || a.name).localeCompare(b.translations[sortLanguage] || b.name, sortLanguage === 'tc' ? 'zh-Hant' : sortLanguage) * (sort === 'name-desc' ? -1 : 1));
}
