# Mendez95 Open

The public source edition of **Mendez 95**, an interactive portfolio built around a desktop interface and a separate mobile **Pocket** layout.

Explore how the windows, navigation, content system, games, editor, and guide fit together, then fork the project to build your own version. This edition runs with fictional content and original geometric sample artwork. **You do not need access to the private project or its services.**

[Fork and run](#fork-and-run) · [How it is built](#how-it-is-built) · [Make it yours](#make-it-yours) · [Documentation](#documentation)

## What you can explore

- **Desktop interactions:** stackable windows, focus management, direct links, themes, onboarding, and a guided tour.
- **Pocket navigation:** a mobile layout that reuses the same content and application logic.
- **Built-in apps:** portfolio readers, a resume, Field Notes, a photo gallery, browser-based Paint, games, and a chatroom.
- **Content tools:** a local owner editor, publication checks, and a guide that answers from visible content. An optional model adapter runs server-side.

## How it is built

The implementation separates the interface, authored content, and server services so each can evolve independently.

| Layer | Implementation | Design decision |
| --- | --- | --- |
| Interface | React, TypeScript, and Vite | Reusable apps sit inside a desktop shell or Pocket layout. |
| Navigation and state | Shared routes, window state, and browser history | Direct links and Back navigation work alongside desktop-style interactions. |
| Content | JSON collections, TypeScript types, and server-side validation | A public projection filters editorial metadata and unpublished material before it reaches the browser. |
| Local API | Express | Content, authentication, interactive features, and local storage work together without cloud setup. |
| Hosted adapter | Cloudflare Workers and D1 | A separate adapter implements the server features for an edge runtime. |
| Verification | Vitest, Worker tests, and privacy checks | Tests cover interaction rules, content boundaries, and service behavior. |

Some implementation details worth exploring:

- **Windows and Pocket:** [the desktop shell](src/desktop/) manages mounted apps and focus; [Pocket](src/pocket/) provides navigation suited to smaller screens.
- **Content boundaries:** [validation and projection](src/content/validation.ts) control what is publishable. Owner editing uses authentication and CSRF protection; local requests and backups stay outside static asset directories.
- **Paint and games:** [Paint](src/apps/paint/) uses the browser Canvas API and keeps imported images in the browser. [Games](src/apps/games/) isolate round state and make score submission optional.
- **The guide:** [source selection](server/guideCore.ts) builds answers from visible content, with a separate [optional generation adapter](server/guideGeneration.ts).
- **Video production:** the project used Explainroo for product and implementation walkthroughs. The [production guide](docs/VIDEO-WORKFLOW.md) explains the process; the reusable [video player](src/components/VideoPreview.tsx) is included.

See [architecture and decisions](docs/ARCHITECTURE.md) for a closer look.

## Fork and run

**Requirements:** Git, Node.js 24, and npm. The basic local demo needs no API keys, cloud account, or private-repository access.

1. Use **Fork** on this repository to create your own copy.
2. Clone your fork, replacing `YOUR-USERNAME` below. If you rename the repository, adjust the clone URL and directory name too.

```sh
git clone https://github.com/YOUR-USERNAME/mendez95-open.git
cd mendez95-open
npm ci
npm run review
```

3. Open **http://127.0.0.1:5173/**. The Express API runs on `127.0.0.1:3334`; keep the terminal running while you explore. Stop the development processes with **Ctrl+C**.

### Try the local editor

Open **http://127.0.0.1:5173/editor** and sign in with the generated password stored in `.local/owner-review-password` on your computer. You can edit the example content there or edit the JSON files directly.

`npm run review` creates that password, enables local draft review, and disables model generation. Review mode is intended for local loopback use. The `.local/` directory is ignored by Git and holds local state, requests, and backups.

## Make it yours

| Change | Start here |
| --- | --- |
| About, resume, cases, writing, and contact links | The JSON files in [`content/`](content/), or the local editor |
| Profile labels and example social accounts | Search for `Jordan`, `exampleowner`, and `example.invalid`; some defaults are still in components |
| Colors and visual treatment | [`src/styles/tokens.css`](src/styles/tokens.css), the desktop styles, and [`src/pocket/`](src/pocket/) |
| Branding and illustrations | [`public/brand/`](public/brand/), [`content-media/`](content-media/), and their component references |
| Apps, routes, and launchers | [`src/apps/`](src/apps/), [`src/desktop/registry.ts`](src/desktop/registry.ts), and [`src/desktop/router.ts`](src/desktop/router.ts) |
| Your own videos | Add reviewed assets under `public/videos/` and configure [`VideoPreview.tsx`](src/components/VideoPreview.tsx) |

Keep record IDs stable when editing existing content. Publication requires explicit status, clearance, and source references; the supplied records show the expected shape. Field Notes currently expect Medium article URLs, and gallery photos expect individual Instagram post or reel links. The [customization guide](docs/CUSTOMIZATION.md) explains these constraints and where to change them.

Anything committed to your public fork is public. Keep private content and credentials outside Git. The server supports `MENDEZ_OS_CONTENT_DIR`, `MENDEZ_OS_MEDIA_DIR`, and `MENDEZ_OS_DATA_DIR` for separate local storage. `.env.example` documents example settings; the app does **not** automatically load `.env` files.

### Services and hosting

The local Express demo is the quickest path to a working version. Weather and music widgets can contact external providers; social accounts and article links are placeholders. Mail targets a non-deliverable example address and needs your own recipient and transport settings. Model generation also requires explicit configuration and your own credentials. Keep provider keys on the server.

The app needs its API as well as its built frontend. If you choose the Worker adapter, configure your own resources, import your content, and review the deployment settings. The supplied [`wrangler.jsonc`](wrangler.jsonc) is local-only and has no production account, database ID, domain, or mail binding. The public repository has no automatic site-deployment workflow.

## Check your changes

Run these from your fork:

| Command | Checks |
| --- | --- |
| `npm run build` | TypeScript and the frontend build |
| `npm test` | Application and Express behavior |
| `npm run cf:typecheck` | Worker adapter types |
| `npm run cf:test` | Worker tests with local test bindings |
| `npm run public:check` | Public-edition content checks |
| `npm run public:secrets` | Credential patterns using a checksum-pinned Gitleaks release |

Secret scanning downloads the official scanner and currently supports macOS and Linux. The GitHub Actions check workflow runs it on Linux. Review the fictional-content expectations in the tests as you customize your fork.

## Explore the code

```text
src/desktop/    Window management, routing, focus, and onboarding
src/pocket/     Pocket navigation and presentation
src/apps/       Portfolio readers, Paint, games, guide, editor, and widgets
src/content/    Shared schemas, validation, and public projection
server/        Express services and private local storage
worker/        Cloudflare adapter and D1 migrations
content/       Fictional demonstration content
content-media/ Sample content artwork
public/        Static example assets
```

## Documentation

- [Architecture and decisions](docs/ARCHITECTURE.md)
- [Customize your fork](docs/CUSTOMIZATION.md)
- [Public-edition privacy boundary](docs/PRIVACY.md)
- [Video production workflow](docs/VIDEO-WORKFLOW.md)

## What this edition includes

Jordan Example, the biographies, and the case narratives are fictional. Geometric sample SVGs replace personal artwork and photos. Original resumes, recordings, production data, deployment identifiers, credentials, and private Git history are excluded. Personal video controls display an omission notice until you supply your own assets.

## Updates and contributions

This repository is generated automatically from a separately maintained private project. **Your fork is independent:** edit and run it normally; publishing updates here does not overwrite your fork.

Direct edits to this upstream repository's generated files may be replaced by the next export. Open an issue to discuss an upstream change. Public commits describe the exported edition and do not reproduce private commit messages or author details.

## License

The application source and example artwork are [MIT licensed](LICENSE). Dependencies and external media services retain their own terms; see [third-party notices](THIRD-PARTY-NOTICES.md).
