# Dhiya examples

## `vite-demo/` — full API walkthrough (local dev)

Runs the library from this repo (via `file:../..`), so build the package first:

```bash
# from the repo root
npm install && npm run build
cd examples/vite-demo
npm install
npm run dev
```

Open http://localhost:5173 — index the sample knowledge, then ask questions.
The page also mounts the `<dhiya-chat>` widget sharing the same client.

## `cdn.html` — zero-build integration

A single static page that loads the published package from jsDelivr and adds
a chat widget with inline knowledge. Serve it over HTTP (module imports and
IndexedDB do not work from `file://`):

```bash
npx serve examples   # or: python3 -m http.server -d examples 8000
```

Then open http://localhost:3000/cdn.html (or the port your server prints).
