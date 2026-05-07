# kessler-pro-scripts

Frontend scripts for [kessler-pro.com](https://kessler-pro.com).

## Architecture

A minimal **bootstrap script** is registered once in Webflow Site Settings → Custom Code (Footer). On every page load it inspects the DOM and lazy-loads only the page-specific bundles needed.

```
Webflow Bootstrap (inline, ~20 lines)
            │
            └─→ jsDelivr CDN
                    │
                    ├─→ globals.js   (always)
                    ├─→ plp.js       (if PLP detected)
                    ├─→ pdp.js       (if PDP detected)
                    └─→ home.js      (if homepage detected)
```

## Page Detection (DOM-based, locale-agnostic)

Bootstrap detects which page-bundle to load by inspecting unique DOM markers — works across all locales (`/produkte`, `/pl/produkty`, etc.).

| Marker | Loads |
|---|---|
| `#plp-grid` exists | `plp.js` |
| `.product-card_wrapper` on home `.product-grid_wrapper` | `home.js` |
| `body[data-page="pdp"]` | `pdp.js` |
| (always) | `globals.js` |

## Versioning

Releases are tagged via Git (e.g., `v1.0.0`). The bootstrap script in Webflow references a specific version:

```
https://cdn.jsdelivr.net/gh/SaschaKesslerPro/kessler-pro-scripts@v1.0.0/dist/globals.js
```

To deploy a new version:
1. Edit files in `dist/`
2. Commit and push
3. Create a new git tag (`git tag v1.0.1 && git push --tags`)
4. Update version string in Webflow bootstrap script (single value change)

## File overview

| File | Purpose |
|---|---|
| `dist/globals.js` | Always loaded: header mega-menu, mobile drawer, scrollbar-hide, judgeme reviews loader, recently-viewed tracker/render, PDP carousel header fix, rating fallback |
| `dist/plp.js` | PLP-specific: filter CSS, drawer toggle, sort/cleanup, filter section toggle, card variants, active-filter tag pills |
| `dist/home.js` | Homepage product carousel |
| `dist/pdp.js` | Reserved for PDP-specific logic |

## Local development

No build pipeline — files are served directly from `dist/`. To preview changes locally before tagging, you can use jsDelivr's branch-mode URL:

```
https://cdn.jsdelivr.net/gh/SaschaKesslerPro/kessler-pro-scripts@main/dist/plp.js
```

## License

MIT — see LICENSE.
