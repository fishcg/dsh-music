# dsh-acgay-player

A DeepSeek Harness (DSH) plugin that embeds the online [acgay.cn](https://www.acgay.cn) music site in a right-side drawer, with an optional import path for missing tracks.

## Features

- A small vinyl button in the DSH top-right corner opens a right drawer.
- The drawer preloads behind the scenes and keeps its iframe mounted, so reopening is instant and the acgay login session is preserved.
- The site header, footer and bottom navigation are hidden inside the drawer. Login is available at the top of the drawer.
- Search queries acgay and an online catalog in parallel; acgay results are always listed first.
- Online catalog rows can be imported into acgay, where they are published immediately (`status = 1`).
- A compact top player controls play/pause, previous/next, progress, and shows the current cover/title.
- The drawer and the surrounding workspace animate open/closed. Clicking outside closes it; `Esc` also closes it.

## Requirements

- DSH desktop with the profile patched to load this package.
- `ffmpeg` and `ffprobe` on `PATH` for imports. Search and playback do not need ffmpeg.
- Node.js 20+ (the DSH runtime is normally sufficient).

## Install

Add the package to the DSH profile and patch the profile:

```jsonc
// ~/.dsh/profiles/desktop/package.json
{
  "dependencies": {
    "@fishcg/dsh-acgay-player": "link:/absolute/path/to/dsh-acgay-player"
  },
  "dsh": {
    "profile": {
      "bundles": ["@fishcg/dsh-acgay-player"]
    }
  }
}
```

```yaml
# ~/.dsh/profiles/desktop/cordis.patch.yml
- insert:
    - id: acgay-player
      name: '@fishcg/dsh-acgay-player'
```

Reload DSH after adding the package. If the client half does not appear on an already-running app, restart DSH once.

## Import credential (optional)

Import is **disabled when no credential is configured**. Search, playback, login, and the mini player still work.

The host resolves the token in this order:

1. `ACGAY_IMPORT_TOKEN` environment variable.
2. `config.importToken` / `config.token` in the plugin row.
3. `ACGAY_IMPORT_TOKEN_FILE` environment variable (path to a file).
4. `~/.acgay-import-token`.
5. `~/.dsh/profiles/desktop/acgay-import-token` (legacy location).

The file contains the raw token, one line. Import is enabled when a non-empty token is found.

When no token is set:

- `/dsh-acgay-player/state` returns `imports: false`.
- Per-row import buttons and the “抓取并入库” action are hidden.
- A direct POST to `/dsh-acgay-player/import` returns HTTP 503.

Do **not** commit the token. It is a shared write credential for the acgay import endpoint.

## Optional environment variables

| Variable | Default | Purpose |
|---|---|---|
| `ACGAY_BASE_URL` | `https://www.acgay.cn` | Upstream site used by the proxy and the importer. |
| `ACGAY_IMPORT_TOKEN` | unset | Enables import. |
| `ACGAY_IMPORT_TOKEN_FILE` | unset | Read the token from a custom path. |
| `ACGAY_FFMPEG` | `ffmpeg` | ffmpeg executable. |
| `ACGAY_FFPROBE` | `ffprobe` | ffprobe executable. |
| `DSH_ACGAY_NODE_BIN` | `process.execPath` | Node executable used for the import worker. |

## How import works

1. The client asks acgay for online catalog candidates along with the normal site search.
2. Clicking “导入”, or “抓取并入库”, calls the plugin host route `POST /dsh-acgay-player/import` with `{ query }`; a catalog item id may be sent instead.
3. The host starts `scripts/import-one.mjs` as a short-lived child process.
4. `scripts/import-direct.mjs` selects one candidate, downloads it, converts it to 192 kbps mp3 with ffmpeg, and POSTs a multipart request to acgay’s `/api/plugin/import` with the token.
5. acgay writes the audio/cover to OSS, inserts a published `lab_music` row and an `lab_import_log` row, and returns the production id. The drawer navigates to `/sound/{id}`.

Nothing is written to a local MySQL database or local OSS client.

## Security notes

- The shared import token grants upload + auto-publish permission. Never ship it in a public repository or client bundle.
- A shared token should only be used in a trusted self-hosted setup. For multi-user deployments, use per-user tokens or a rate-limited endpoint.
- The plugin performs no database, OSS, or catalog account authentication itself; all privileged writes happen in the acgay server endpoint.

## Development

- `index.js`: DSH host half; proxy, state, import route.
- `client.js`: DSH web client half; vinyl button, drawer, search panel, mini player.
- `assets/bridge.js`: injected into proxied pages; forwards `window.__ACGAY_PLAYER__` state and commands.
- `scripts/import-direct.ts`: source for the importer.
- `scripts/import-direct.mjs`: runtime bundle (generated from the TS source).
- `scripts/lib/*.ts` / `*.mjs`: vendored catalog client used by the importer.

## License

MIT
