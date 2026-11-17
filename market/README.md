# Plugin market index

`index.json` is a format 1 DSH plugin index with one entry, **Gloss**. See the DSH plugin-market documentation for the format; `README.md` in the DSH source explains the fields. `icon.svg` is copied from the package icon so the relative icon reference resolves next to the index.

## Regenerate

`index.json` is generated; do not hand-edit it.

```sh
npm run market:sync
```

The default entry is a **Git source pinned to HEAD**. The script reads `package.json` (name, version, repository, homepage, author, keywords, `engines.dsh`) and the locale `meta` fields, requires a clean working tree, and records the commit id plus its committer time as `publishTimestamp`.

After a code change: commit it, run `npm run market:sync`, then commit `market/index.json` and `market/icon.svg`. The index therefore pins the commit before the index commit, which is expected.

Useful flags:

```sh
npm run market:sync -- --allow-dirty          # pin HEAD despite uncommitted changes
npm run market:sync -- --source=npm           # registry entry instead
npm run market:sync -- --timestamp=1763424000 # override the recorded time
```

For `--source=npm`, `publishTimestamp` comes from the registry publish time of the current version; before the first publish it falls back to the current time with a warning.

## Host it

The index URL must be a canonical `http(s)` URL without credentials or a fragment, and it must not redirect. GitHub Pages serving the repository root works:

1. Push the repository.
2. **Settings → Pages → Deploy from a branch → `main` / root**.
3. The index is then at `https://djtang-404.github.io/dsh-gloss/market/index.json`, with the icon next to it.

Any static HTTPS host works, as long as `index.json` and `icon.svg` stay in the same directory.

## Try it locally

The DSH reader accepts a loopback `http:` URL:

```sh
python3 -m http.server 8000
```

Then in DSH: **Plugins → Experimental plugins → Custom plugin indexes**, add `http://127.0.0.1:8000/market/index.json`, and install **Gloss** from Discover. This also validates the index before you publish it.

## Notes

- There is no official DSH index in 0.2.2-alpha.3; the market reads only the sources a user adds, and the feature lives behind the experimental bundle.
- The index is not signed. Users are trusting the index URL; keep it on a stable domain and keep the source repository public.
- DSH does not upgrade bundles through the market yet; a new version is uninstall + install.
- `engines.dsh` in the index must equal `package.json`'s range; the generator copies it unchanged.
