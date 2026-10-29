import { prepare, selectMods, sortRarities } from './search.js';

const $ = id => document.getElementById(id);
const pageSize = 24;
const languageNames = {
  en: 'English', de: 'German', fr: 'French', es: 'Spanish', it: 'Italian',
  ja: 'Japanese', ko: 'Korean', pl: 'Polish', pt: 'Portuguese', ru: 'Russian',
  tc: 'Chinese (Traditional)', th: 'Thai', tr: 'Turkish', uk: 'Ukrainian', zh: 'Chinese (Simplified)'
};
const state = { query: '', category: '', tag: '', rarity: '', sort: 'name', page: 0 };
let manifest, mods = [], languages = [], ready = false;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

async function json(path) {
  const response = await fetch('./data/' + path);
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  return response.json();
}

function imageFor(mod) {
  const figure = node('figure', 'mod-image');
  const image = node('img');
  const card = mod.imageKind === 'card';
  image.src = mod.image || './assets/fallback.svg';
  image.alt = `${mod.name} ${card ? 'complete mod card' : 'original artwork'}`;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  const caption = node('figcaption', card ? 'image-note hidden' : 'image-note', card ? '' : 'Original artwork · card not available');
  // Preserve the full source aspect ratio; never crop or stretch the card.
  image.addEventListener('error', () => {
    if (image.dataset.fallback === 'placeholder') return;
    if (image.dataset.fallback === 'artwork' || !mod.artwork || mod.artwork === mod.image) {
      image.dataset.fallback = 'placeholder';
      image.src = './assets/fallback.svg';
      caption.textContent = 'Image unavailable';
    } else {
      image.dataset.fallback = 'artwork';
      image.src = mod.artwork;
      caption.textContent = 'Card unavailable · original artwork';
    }
    caption.classList.remove('hidden');
    image.alt = `${mod.name} artwork`;
  });
  figure.append(image, caption);
  return figure;
}

let toastTimer;
function toast(text) {
  $('toast').textContent = text;
  $('toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2200);
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Name copied'); }
  catch { toast('Could not copy. Please select the name manually.'); }
}

function translationsFor(mod) {
  const grid = node('dl', 'translations');
  for (const language of languages) {
    const cell = node('div', 'translation');
    const label = node('dt', '', languageNames[language] || language);
    const value = mod.translations[language];
    const description = node('dd');
    const text = node(value ? 'button' : 'span', value ? 'mod-name' : 'missing', value || 'Not available');
    if (value) {
      text.type = 'button';
      text.onclick = () => copy(value);
    }
    text.lang = language === 'tc' ? 'zh-Hant' : language === 'zh' ? 'zh-Hans' : language;
    description.append(text);
    if (value) {
      const button = node('button', 'copy', '⧉');
      button.setAttribute('aria-label', `Copy ${languageNames[language] || language} name: ${value}`);
      button.onclick = () => copy(value);
      description.append(button);
    }
    cell.append(label, description);
    grid.append(cell);
  }
  return grid;
}

function modResult(mod) {
  const article = node('article', 'mod-result');
  const content = node('div', 'mod-content');
  const heading = node('div', 'mod-heading');
  const title = node('h2');
  const button = node('button', 'title-button', mod.name);
  button.onclick = () => copy(mod.name);
  title.append(button);
  const wiki = node('a', 'wiki-link');
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({ viewBox: '0 0 24 24', width: '16', height: '16', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' })) icon.setAttribute(key, value);
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5');
  icon.append(path);
  wiki.append(icon);
  wiki.href = mod.wikiUrl;
  wiki.target = '_blank';
  wiki.rel = 'noopener noreferrer';
  wiki.setAttribute('aria-label', `View ${mod.name} on Warframe Wiki (opens in a new tab)`);
  title.append(wiki);
  heading.append(title, node('p', 'mod-meta', [...mod.categories, mod.rarity?.toLowerCase(), ...mod.tags].filter(Boolean).join(' · ')));
  const metadata = node('dl', 'listing-metadata');
  const values = mod.metadata || {};
  for (const [key, value] of [
    ['Compatibility', values.compatibility]
  ]) {
    const item = node('div');
    item.append(node('dt', '', key), node('dd', '', value ?? '—'));
    metadata.append(item);
  }
  content.append(heading, metadata, translationsFor(mod));
  article.append(imageFor(mod), content);
  return article;
}

function render() {
  const results = selectMods(mods, state);
  const pages = Math.max(1, Math.ceil(results.length / pageSize));
  state.page = Math.min(state.page, pages - 1);
  $('status').textContent = ready
    ? `${results.length.toLocaleString('en')} ${results.length === 1 ? 'mod' : 'mods'} · all ${languages.length} languages shown`
    : 'Loading all-language search…';
  $('results').setAttribute('aria-busy', !ready);
  const visible = results.slice(state.page * pageSize, (state.page + 1) * pageSize);
  $('results').replaceChildren(...visible.map(modResult));
  if (!visible.length) $('results').append(node('p', 'empty', ready ? 'No mods found. Try another name or reset the filters.' : 'Loading mods…'));
  $('prev').disabled = state.page === 0;
  $('next').disabled = state.page >= pages - 1;
  $('pageInfo').textContent = `${state.page + 1} / ${pages}`;
}

let searchTimer;
$('search').oninput = event => {
  state.query = event.target.value;
  state.page = 0;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(render, 70);
};
for (const id of ['category', 'tag', 'rarity', 'sort']) {
  $(id).onchange = event => { state[id] = event.target.value; state.page = 0; render(); };
}
$('reset').onclick = () => {
  Object.assign(state, { query: '', category: '', tag: '', rarity: '', sort: 'name', page: 0 });
  for (const id of ['category', 'tag', 'rarity']) $(id).value = '';
  $('sort').value = 'name';
  $('search').value = '';
  render();
};
for (const [id, step] of [['prev', -1], ['next', 1]]) {
  $(id).onclick = () => { state.page += step; render(); $('results').scrollIntoView({ block: 'start' }); };
}
// Keep page/skip navigation clear of the sticky search panel at every breakpoint.
const searchPanel = document.querySelector('.search-panel');
new ResizeObserver(() => {
  document.documentElement.style.setProperty('--search-height', `${searchPanel.getBoundingClientRect().height}px`);
}).observe(searchPanel);

try {
  manifest = await json('manifest.json');
  languages = ['en', 'de', 'fr', ...manifest.languages].filter((value, index, array) => manifest.languages.includes(value) && array.indexOf(value) === index);
  for (const [id, values] of [['category', manifest.categories], ['tag', manifest.tags], ['rarity', sortRarities(manifest.rarities)]]) {
    for (const value of values) $(id).add(new Option(id === 'rarity' ? value[0] + value.slice(1).toLowerCase() : value, value));
  }
  $('snapshot').textContent = `${manifest.count.toLocaleString('en')} mods · ${languages.length} languages · Updated ${new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'Europe/Berlin' }).format(new Date(manifest.updatedAt))}`;
  mods = prepare(await json(manifest.initial));
  render();
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
  mods = prepare(await json(manifest.index));
  ready = true;
  render();
} catch (error) {
  $('status').textContent = 'Could not load mod data.';
  $('results').setAttribute('aria-busy', 'false');
  const button = node('button', '', 'Try again');
  button.onclick = () => location.reload();
  $('results').replaceChildren(node('p', 'empty', 'Could not load mod data. Please check your connection.'), button);
  console.error(error);
}
