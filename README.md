# Warframe Mod Names

A minimal, static Warframe mod translation search for GitHub Pages. Search any official name and see every available language directly beside the complete mod card. An independent, non-commercial fan project.

## Features

- English-only interface, focused on search rather than a decorative dashboard.
- Search across all 15 imported languages, including partial words and accent-insensitive matches (`Vitalität`, `Vitalitat`, `Vitality`). Multiple search terms can match different translations of the same mod.
- Every result displays **all languages immediately** in a compact responsive grid. No hidden language selection or detail click is required to compare names.
- Complete original Wiki mod cards, including frame and printed values, where a verified mapping exists. Images preserve their natural aspect ratio and are never cropped. The Wiki article opens from the external-link icon next to the mod name.
- Category, mod type and rarity filters; name/category/rarity sorting; copy by clicking a name or its copy button.
- Compatibility appears directly in each listing. Mod cards are vertically centered, and a standard external-link icon opens the Wiki article. There is no detail dialog.
- 24 results per page, lazy images, prebuilt listing metadata, no frontend frameworks or runtime dependencies.

## Local development

The Git repository is the **nested folder** `warframe-mod-translations`. In PowerShell:

```powershell
cd D:\Projekte\Warframe-Mod-Translations\warframe-mod-translations
npm install
npm run dev
```

Open `http://127.0.0.1:4173`. Node.js **24 LTS** is recommended (minimum 22). A real data snapshot is committed with the project, so starting the site does not require a live import. Do not open `index.html` directly through `file://`; modules and local JSON requests need HTTP.

```sh
npm run update:data  # import live exports, translations and full-card mappings
npm test             # reproducible unit tests and real-snapshot integration checks
npm run validate     # validate the stored snapshot and search index
npm run build        # create a static Pages artifact in dist/
node scripts/serve.mjs --dist
```

Set `PORT` to change the local server port. In restrictive Windows sandboxes, `node --test --test-isolation=none` avoids test-worker `spawn EPERM` failures. No Docker, Ruby, Jekyll, backend or database is needed.

## Sources and coverage

Sources were inspected and live-imported on **29 October 2026**. Exact source commits are recorded in `data/manifest.json`.

| Source | Purpose and verified structure |
| --- | --- |
| [Public Export Plus](https://github.com/calamity-inc/warframe-public-export-plus) | `ExportUpgrades.json` is an object keyed by stable `/Lotus/...` game IDs. Name fields reference localization keys. |
| `ExportAvionics.json` | Supplementary Railjack entries; merge by stable ID, preferring Upgrades on overlap. |
| `dict.*.json` | Dynamically discovered language dictionaries; exact localization-key joins, never fuzzy name matching or machine translation. |
| [WFCD / warframe-items](https://github.com/WFCD/warframe-items) | `data/json/Mods.json`: `uniqueName` matches the stable game ID; `wikiaThumbnail` supplies the actual complete card URL. Conflicting mappings and non-Wiki hosts are rejected. No guessed image filenames. |
| [Warframe Wiki](https://wiki.warframe.com/) | Hosts the complete cards. Some article/script requests return HTTP 403, but the structured `pageimages` API and browser image delivery have both been verified. The API supplements missing community mappings; verified references are retained if a later request is denied. No access-control bypass. |
| `ExportImages.json`, official CDN, [browse.wf](https://browse.wf/) | Original artwork fallback via actual exported texture paths and content hashes. |
| [Official Public Export index](https://content.warframe.com/PublicExport/index_en.txt.lzma) | Successfully fetched during assessment. The normalized community export avoids another LZMA dependency and supplies additional metadata. |
| [WarframeTools](https://blackscorp.github.io/WarframeTools/) | Functional inspiration for immediate multilingual comparison; its historical names are not copied. |

The current snapshot contains **1,514 mods**, **15 dictionaries** and **1,511 complete-card mappings**. The remaining **3** use their complete original artwork, labelled as such. A mapped remote URL is not a guarantee that every visitor can reach that host. If a full card fails to load, the UI explicitly labels the artwork fallback; if that fails, it shows a neutral local SVG.

Languages: English, German, French, Spanish, Italian, Japanese, Korean, Polish, Portuguese, Russian, Traditional Chinese, Thai, Turkish, Ukrainian and Simplified Chinese. Missing translations are `null` and displayed as **Not available**. Official dictionary values identical to English are preserved; the source does not distinguish deliberate naming from an in-game English fallback.

This is the best verifiable export coverage, not a claim that every historical/internal game object is available. Same-name mods with different IDs remain separate, such as normal and Flawed Vitality. Frivolous/development entries, `excludeFromCodex`, empty-name placeholders and missing English names are excluded and counted. `codexSecret` remains metadata because it does not reliably mean unavailable. Riven entries are exported base types, not player-generated rolls. Railjack may include historical avionics.

Category mappings use exported types and compatibility/game paths. Aura and Stance come from `type`, Exilus from `isUtility`, Augment/Conclave from game paths, and Primed/Umbral/Archon from official English prefixes. Unknown types use Other. These derived tags are not a complete Wiki taxonomy.

## Images, licenses and privacy

Complete cards and fallback art are **externally hosted**, not mirrored into this repository. The importer downloads mapping JSON, not thousands of image files. Browser/CDN caching and lazy loading handle image delivery; CDN content hashes identify exact artwork versions. Full-card rank/stat text is part of the source image and may differ from the currently exported base drain or a particular in-game rank.

Wiki/API access is not required at runtime for names or metadata: those are prebuilt local JSON files. **Images** are runtime requests to the documented image hosts, so they need network access or browser cache. `referrerpolicy="no-referrer"` avoids disclosing the page URL to those hosts; normal IP/browser information is still transmitted. No analytics, remote fonts or localStorage preferences are used.

Warframe names and game imagery belong to **Digital Extremes Ltd.**, under the [Warframe Content Policy](https://www.warframe.com/en/contentpolicy) for this non-commercial fan project. They are not released under this program's MIT software license. No official logos or third-party fan artwork are included. Public Export Plus and WFCD software/data mapping notices are retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), which is also included in the deployed artifact. No Wiki article text is reproduced.

## Architecture and files

```text
index.html                  English search interface
src/app.js                  Result grid, copy buttons, image fallback and inline metadata
src/search.js               Shared Unicode search/filter/sort functions
src/style.css               Minimal responsive dark interface
assets/                     Own SVG favicon and image placeholder
scripts/import.mjs          Revision-pinned data and card mapping import
scripts/lib.mjs             HTTP cache, joins, validation, atomic publication
scripts/wiki-cards.mjs       Verified MediaWiki pageimages supplementation
sources/wiki-cards.json      Retained exact-ID Wiki image mappings
scripts/validate.mjs         Stored snapshot and index integrity checks
scripts/build.mjs            Static artifact packaging
scripts/serve.mjs            Loopback-only development server
data/manifest.json          Active version, source revisions and coverage
data/<version>/initial.json First 48 index records (24 displayed)
data/<version>/index.json   All names and result metadata
data/<version>/mods-*.json  Detail blocks of 128 records
data/<version>/changes.json Added, changed and removed stable IDs
tests/                     Small reproducible fixtures and snapshot integration
.github/workflows/pages.yml Daily update, validation and Pages deployment
.cache/http/               Ignored conditional-request cache
dist/                      Ignored static build artifact
```

Results include `id`, names, translations, categories, tags, rarity, `image`, `artwork`, `imageKind` and the detail shard. Details add metadata and source identifiers. `imageKind` distinguishes complete cards from illustrations. The manifest records data and card-source revisions and a SHA-256 content hash.

The first data slice is rendered before fetching the complete multilingual index. Only 24 result images and 360 translation cells are mounted per page. Listing metadata and Wiki links are included in the prebuilt index; visitors do not load detail shards. Source exports and dictionaries are never fetched by visitors. All asset/JSON URLs are relative, supporting GitHub Project Pages under a repository subpath. There are no detail routes or dialogs; no server rewrites are required.

## Automatic updates and GitHub Pages

The workflow runs daily at **04:23 UTC**, after pushes to `main`, and via **Actions → Update mods and deploy Pages → Run workflow**. It uses `ubuntu-latest`, Node 24 and the official configure/upload/deploy Pages actions.

One-time setup:

1. Push the implementation, generated `data/`, lockfile and workflow to `main`.
2. Select **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Repository/organization policy and branch protection must allow the workflow bot to persist generated data commits to `main`. Otherwise persistence fails safely; adapt this step to an allowed data branch if required.
4. Allow deployment from `main` in the `github-pages` environment; any environment approvals remain effective.

No extra secrets are needed. Only the build/persistence job has `contents: write`; deployment has `pages: write` and `id-token: write`. Concurrency serializes runs. Unchanged data creates no new snapshot or commit. Bot commits contain only generated data and `.nojekyll`; `GITHUB_TOKEN` pushes plus `[skip ci]` avoid loops. Build artifacts contain `.nojekyll` and license notices.

Expected URL after a successful deployment: `https://wuoc-k.github.io/warframe-mod-translations/`. A local build does not itself publish the website.

## Reliability and tests

HTTP uses four attempts for network/429/5xx failures, exponential backoff, bounded `Retry-After`, 45-second request timeouts and ETag/304 caching. Dictionaries load sequentially; a cached response is not silently substituted for a failed live import. Actions restores the HTTP cache across runs.

Validation checks IDs, schemas, mandatory dictionaries, at least 1,000 mods, translation coverage, trusted image hosts and snapshot hashes. Loss of more than 10% of stable IDs, translations, image references or previously mapped complete cards stops publication. A legitimate large game cleanup may therefore need manual source review before adjusting thresholds.

New versioned files are staged first; the active manifest is atomically replaced last. Tests simulate a disk write failure and verify that the old pointer stays intact. Current and previous snapshots are retained; older generated version folders are pruned with path-boundary checks. Failed imports/tests/builds prevent deployment, leaving the last published Pages version active. Git history retains prior data commits.

`npm test` covers source joins, translations, variants, duplicates, Unicode search, missing data, full-card mapping/host/ambiguity checks, retry/backoff/304, change detection, loss guards, interrupted staging, safe cleanup and actual snapshot integrity. Unit tests are offline; the live importer is checked separately. Browser verification covers the full Vitality card, all 15 names without opening a dialog, copy actions, category/rarity filters and responsive layout.

Use a modern browser supporting ES modules, Unicode property escapes and CSS Grid. Copy requires HTTPS or localhost and clipboard permission; failure leaves selectable text and a clear message. Small screens wrap languages into fewer columns without hiding them. There is no service worker.

### Supplementary Wiki cards

Missing community-export image fields do not mean that a full Wiki card does not exist. The importer queries MediaWiki pageimages in batches of at most 50 exact article titles and validates stable game ID, official name, article title, allowed host and portrait dimensions. Only missing cards are supplemented; existing mappings keep priority. The verified mapping file is retained across updates, so a 403 or temporary API outage does not discard known cards. No card filename is guessed. This repaired 38 mappings, including Capacitance, Calm & Frenzy and the Carnis set. The remaining entries are Oull, Quick Correct and Transmute Core; the checked Wiki responses did not supply a verified individual full card for them.
