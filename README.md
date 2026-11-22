# Mendez95 Open

A forkable desktop-inspired portfolio with a separate Pocket interface, fictional content, and reusable application code.

## Run locally

Use Node.js 24 and npm:

```sh
npm ci
npm run review
```

Open http://127.0.0.1:5173. The local API listens on 127.0.0.1:3334. Review mode creates a random local owner password in `.local/owner-review-password`. Open `/editor` to explore editing the fictional content. That password stays on your computer.

```sh
npm run build
npm test
npm run cf:typecheck
npm run cf:test
npm run public:check
npm run public:secrets
```

## Explore the code

- `src/desktop/`: windows, routing, focus, onboarding and preferences.
- `src/pocket/`: responsive Pocket navigation and presentation.
- `src/apps/`: portfolio readers, Paint, games, guide, editor and widgets.
- `src/content/`: schemas, validation and public content projection.
- `server/`: local Express services, owner authentication and private local storage.
- `worker/`: Cloudflare adapter, D1 schema and request handling.
- `content/`: entirely fictional demonstration data.

See [architecture and decisions](docs/ARCHITECTURE.md), [customization](docs/CUSTOMIZATION.md), [privacy](docs/PRIVACY.md), and [video production](docs/VIDEO-WORKFLOW.md).

## What this edition includes

This is a generated source edition of Mendez 95. Jordan Example, all biographies and all case narratives are fictional. Artwork is geometric sample SVG; no personal photos, resumes, original recordings, production databases, deployment identifiers, credentials or private Git history are included. Personal video controls display an omission notice; the reusable video player remains in the code.

The Worker configuration is local-only. There are no production routes, mail bindings, browser bindings or deployment workflows. Running this project does not connect it to the original site's services. Local weather/music widgets can contact the external providers described in the code. Social account names are placeholders. Email/model integrations are unavailable until you configure your own services. Never put provider keys in browser variables.

## Updates and contributions

This repository is published automatically from a separately maintained private project. You can edit your own fork normally. Direct edits to this repository's generated files may be replaced by the next export; discuss proposed upstream changes in an issue. Public commits describe the exported edition and do not reproduce private commit messages or authors.

MIT licensed. See LICENSE and THIRD-PARTY-NOTICES.md.

Temporary automatic-publishing verification: `PUBLIC_SYNC_TEST_0bc268703b8d4fffa9509db862597830`.
