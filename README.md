# Warframe Mod Names

Find a Warframe mod by its name in any language and compare all available official translations alongside its complete mod card.

[Website](https://wuoc-k.github.io/warframe-mod-translations/) · [Report an issue](https://github.com/Wuoc-k/warframe-mod-translations/issues)

## Features

- Search across all imported languages with partial-word and accent-insensitive matching.
- Compare every available translation directly in each result. The interface is in English.
- Copy names by clicking the text or its copy button.
- Filter by category, mod type and rarity; sort by name, category or rarity.
- View complete mod cards and open the corresponding Warframe Wiki article.
- Responsive layout, sticky search, lazy-loaded images and paginated results.

The site is fully static: HTML, CSS, vanilla JavaScript and prebuilt JSON. It does not need a backend, database or frontend framework.

## Run locally

Install [Node.js](https://nodejs.org/) 24 LTS, then:

```sh
git clone https://github.com/Wuoc-k/warframe-mod-translations.git
cd warframe-mod-translations
npm ci
npm run dev
```

Open **http://127.0.0.1:4173**. A generated data snapshot is included, so a fresh import is not required to run the site. Use the local server rather than opening `index.html` directly.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server. |
| `npm run update:data` | Fetch sources and generate a validated data snapshot. Requires internet access. |
| `npm test` | Run offline unit tests and checks against the included snapshot. |
| `npm run validate` | Check snapshot integrity and listing metadata. |
| `npm run build` | Prepare the static site in `dist/`. |
| `node scripts/serve.mjs --dist` | Preview the built site locally. |

Set `PORT` to use another local port. There are no npm runtime dependencies.

## Data and images

Names and translations come from [Warframe Public Export Plus](https://github.com/calamity-inc/warframe-public-export-plus). They are joined using stable game IDs and localization keys, without machine translation or fuzzy name matching.

Full-card references come from [WFCD / warframe-items](https://github.com/WFCD/warframe-items), supplemented by the [Warframe Wiki](https://wiki.warframe.com/) MediaWiki image API. Verified supplementary references are retained in `sources/wiki-cards.json`, so temporary API failures do not discard known cards. Original artwork from the official export CDN or [browse.wf](https://browse.wf/) is used when a full card cannot be verified.

Images are hosted externally, never cropped, and loaded only as needed. Failed images fall back to artwork or a local placeholder. Names and metadata are served from this site's static files; visitors do not query the source APIs. External image hosts receive normal connection information, but the site sends no page referrer and uses no analytics.

See [`data/manifest.json`](data/manifest.json) for the current mod count, languages, card coverage and source revisions.

### Limitations

- Coverage follows the upstream exports and can include historical entries. Riven records represent base types, not individual rolls.
- Same-name variants with different game IDs remain separate, including Flawed mods.
- Missing translations are shown as **Not available**. An official dictionary may itself use the English name as a fallback.
- Card availability depends on verifiable source mappings and external image hosts. Printed card text can reflect a different rank or game version.
- Categories and tags are derived from export fields and game paths, rather than a complete Wiki taxonomy.

## Updates and deployment

The [GitHub Actions workflow](.github/workflows/pages.yml) imports and validates data, runs tests, builds the site and deploys it with the official GitHub Pages actions. It runs on pushes to `main`, daily at **04:23 UTC**, and manually through `workflow_dispatch`.

To deploy your own copy:

1. Enable GitHub Actions in your repository.
2. Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
3. Allow the workflow to commit generated data to `main`; repository rules or branch protection may require an adjusted persistence strategy.
4. Run **Update mods and deploy Pages** from the Actions tab and check the deployment result.

No additional secrets are required. Paths are relative, so the site supports GitHub Project Pages under a repository subpath. Forks should update the website and issue links in this README.

Unchanged data does not create a new commit. Validation rejects empty or duplicate records and substantial losses of IDs, translations or images. New snapshots are staged before the active manifest is switched; failed imports, tests or builds stop deployment. The current and previous snapshots are retained.

## Project layout

```text
index.html          Site entry point
src/                Search, rendering and styles
assets/             Local SVG assets
scripts/            Import, normalization, validation, build and local server
sources/            Verified supplementary Wiki image references
data/               Generated snapshots and active manifest
tests/              Unit tests, fixtures and snapshot checks
.github/workflows/  Automated updates and Pages deployment
```

`.cache/`, `node_modules/` and `dist/` are local generated directories and are excluded from Git.

## Contributing

Report incorrect names, image mappings or categories through [Issues](https://github.com/Wuoc-k/warframe-mod-translations/issues). Include the English mod name, affected language and a reliable source when possible.

For changes, run `npm test`, `npm run validate` and `npm run build`. Prefer fixing the importer or source mapping over editing generated snapshot files directly. Do not add credentials or downloaded game images to the repository.

## License and credits

The application code is available under the [MIT license](LICENSE). Third-party data and imagery retain their own terms; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Warframe names and game imagery belong to Digital Extremes Ltd. This is an unofficial, non-commercial fan project, not affiliated with Digital Extremes. Use of game content is subject to the [Warframe Content Policy](https://www.warframe.com/en/contentpolicy).

Inspired by [WarframeTools](https://blackscorp.github.io/WarframeTools/).
