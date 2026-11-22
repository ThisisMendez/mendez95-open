# Customize your fork

1. Edit the fictional JSON under `content/`, or use the local `/editor`. Keep IDs stable when changing existing records. Field Notes currently require HTTPS Medium article URLs; the supplied article link is fictional. Publication requires explicit clearance and source references; the examples explain their fictional origin.
2. Replace sample SVG artwork and update references. The photo gallery currently expects individual Instagram post/reel source links; use your own authorized sources or change that validation for a different gallery.
3. Search for `Jordan`, `exampleowner`, `example.invalid`, and `demo-` to find presentation defaults and example account names. There are still identity strings in components; they are not all driven by content JSON.
4. Use your own server configuration for mail/model providers. Mail currently targets a deliberately non-deliverable example address; change the recipient in both adapters when configuring your fork. Never use a real mailbox or credentials in test fixtures.
5. Add your own videos to `public/videos/` and configure the video objects in `src/components/VideoPreview.tsx`. Empty sources intentionally display an omission notice.
6. Deploy only to resources you own after reviewing security and privacy. The supplied Worker config intentionally contains no account ID, database ID or production domain. Express is the supported out-of-the-box demo; Worker database seeding and hosting are your own setup.

Keep `.local`, `.env`, `.dev.vars`, private content/media directories and credentials ignored. `MENDEZ_OS_CONTENT_DIR`, `MENDEZ_OS_MEDIA_DIR` and `MENDEZ_OS_DATA_DIR` allow private local files outside the source tree. The app does not automatically load `.env`; use your launcher/runtime's environment configuration.
