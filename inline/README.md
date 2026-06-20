# Inline snippets (pasted into Webflow custom code)

These scripts are **not** served via jsDelivr - they are registered as inline
scripts in Webflow (via the Scripts API) and pasted into the site's custom code.
They live here for version control and review only.

Why inline (and not in `dist/` via jsDelivr)?

- **bootstrap.footer.js** - the loader that injects the jsDelivr `dist/*.js`
  files. Must be inline so there is no chicken-and-egg dependency.
  Applied as registered inline script `kesslerbootstrap` (footer).
  When `dist/` changes, bump the commit hash `V`, re-register a new version,
  and `add_site_script` (footer).

- **currency-init.head.js** - sets the Storesynk presentment market to DE (EUR)
  via `localStorage['_sf-country']`. Must run **synchronously in <head> before
  Storesynk initialises**, so it cannot be an async jsDelivr file.
  Applied as registered inline script `kesslercurrency` (header).
  No IP geolocation / no tracking -> no cookie consent required.

Everything else (cart glue, wishlist, PLP, header, search, hub, ...) lives in
`dist/` and is loaded from jsDelivr by the bootstrap.
