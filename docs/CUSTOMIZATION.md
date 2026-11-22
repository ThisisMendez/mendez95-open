# Build your own version

Start with the fictional demo, then customize its profile, add a complete case study and change its visual identity. Every name, organization and project below is invented. Work in your own copy of the public repository.

## 1. Create your copy and run it

Choose **[Use this template](https://github.com/ThisisMendez/mendez95-open/generate)** for an independent project with fresh history. Choose **[Fork](https://github.com/ThisisMendez/mendez95-open/fork)** to retain a relationship with this upstream repository. Replace the placeholders with your new repository's owner and name:

```sh
git clone https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
cd YOUR-REPOSITORY
npm ci
npm run review
```

Use Node.js 24. Open http://127.0.0.1:5173/ and keep that terminal running. The local API listens on `127.0.0.1:3334`. This path needs no private project, API token or cloud account.

For visual editing, open http://127.0.0.1:5173/editor and use the password in `.local/owner-review-password`. The editor saves into your copy's content files and keeps backups under ignored `.local/`. Review mode is for local loopback use.

## 2. Replace the fictional profile

Try another fictional identity first: **Taylor Sample**, a product builder at **Sample Workshop**.

| File | Example edit |
| --- | --- |
| `content/resume.json` | Set `name` to `Taylor Sample`; replace the introduction and example career entry. |
| `content/about.json` | Update the `introduction` journey entry's title and body. Keep its ID. |
| `content/elsewhere.json` | Replace example contact links with destinations you intend to make public. |
| `src/pocket/PocketChrome.tsx` | Update the home-screen heading and role. |
| `src/desktop/DesktopShell.tsx` | Update the desktop footer. |

Search remaining source for `Jordan`, `exampleowner` and `example.invalid` to find startup labels, accessibility labels, social placeholders and server defaults. Identity is not yet driven by one shared configuration file. Keep the `MENDEZ_OS_` environment-variable names unless you also update their readers.

The tests in `src/content/exampleContent.test.ts` and `server/exampleContent.test.ts` explicitly expect the fictional name. If you change it, update those identity expectations while retaining the publication, authentication and metadata-filtering assertions.

Keep private details outside a public fork. `MENDEZ_OS_CONTENT_DIR`, `MENDEZ_OS_MEDIA_DIR` and `MENDEZ_OS_DATA_DIR` support separate local storage. Supply variables through your launcher; the app does not automatically load `.env` files.

## 3. Add a complete case study

The included [Reading List case](examples/reading-list-case.json) is a complete fictional record. It uses authored Markdown and needs no external media or services.

From your repository root, run this in a second terminal:

```sh
node docs/examples/add-reading-list.mjs
```

The helper appends one record to your own `content/stories.json`. It refuses duplicate IDs or slugs and preserves existing cases. Restart the review command, then open:

**http://127.0.0.1:5173/work/example-reading-list**

You should see **A Reading List That Stays Useful**, followed by problem, decision and verification sections. It also appears in Portfolio's All view. Edit the record's prose and fields to explore the schema.

### Why is this record publishable?

- A stable lowercase, hyphenated `slug`, unique `id`, title, context, role and summary.
- `status: "published"` and `disclosureStatus: "cleared"` after review.
- A nonempty `sourceRefs` list. This example cites its fictional tutorial source; real cases need appropriate editorial evidence.
- An `articleMarkdown` value with a top-level title and section headings.
- Ordering, tags, related IDs and a featured flag matching the shared schema.

The public API removes editorial source references. That filtering does not make a JSON file committed to a public repository private. Keep sensitive source material outside public Git history.

New IDs appear under All. For explicit category membership, add the ID to `src/content/portfolioCategories.ts`. Preserve IDs when updating existing cases so links and relationships remain stable.

## 4. Change the visual identity

1. In `src/styles/tokens.css`, find the theme you use, such as `html[data-theme="retro"]`. Adjust its color variables, then check contrast and keyboard focus in the running app.
2. Replace `public/brand/logo.svg`, `public/brand/logo-mark.svg` and `public/brand/favicon.svg` with artwork you own. The [sample TS mark](examples/sample-mark.svg) is an optional fictional starting point. Review sizes and accessible labels in `src/components/visual/BrandLogo.tsx` when changing proportions.
3. Replace profile illustrations in `src/apps/core/media/` and `public/brand/pocket/`; update component references and alt text too.

Content images live under `content-media/` and need reviewed photo records or case references before the API serves them. Gallery photos currently require individual Instagram post/reel links; Field Notes require HTTPS Medium article URLs. Change those validators deliberately if your project uses a different source model.

For your own videos, add reviewed assets under `public/videos/` and configure `src/components/VideoPreview.tsx`. An empty source intentionally displays an omission notice. See the [video workflow](VIDEO-WORKFLOW.md).

## 5. Check the result

```sh
npm run build
npm test
npm run cf:typecheck
npm run cf:test
npm run public:check
npm run public:secrets
```

Inspect desktop and Pocket layouts, open the new case directly, use browser Back and check images and keyboard focus. The repository screenshots show the unmodified fictional starter; replace them with your own reviewed captures when sharing a customized version.

Email and optional model integrations need your own server configuration. Both server adapters use a deliberately non-deliverable example mail recipient. Configure your recipient and transport before enabling delivery; keep real credentials out of browser code and tests.

## 6. Choose hosting when ready

Express is the supported out-of-the-box local demo. A hosted version needs its API as well as its built frontend. The Worker adapter demonstrates D1 storage; configure your own resources, seed content and review deployment settings before hosting it. The supplied configuration contains no production account, database ID or domain.

Changes to your copy are yours to maintain. Upstream publishing does not overwrite independent projects or forks.
