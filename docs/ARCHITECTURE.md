# Architecture and decisions

React and TypeScript render a desktop shell and a separate Pocket layout. A shared router resolves direct links; window state keeps mounted apps available as focus changes. Native history, keyboard focus and reduced-motion preferences shape navigation.

Editorial content is loaded server-side, validated, and projected through an explicit public schema. The editor uses owner authentication and CSRF protection. Runtime state, requests and backups live outside static asset directories. The demonstration uses invented records while retaining the original validation and projection mechanisms.

Express supports a straightforward local development path. A separate Cloudflare Worker adapter uses D1 for content/state and an asset binding for the interface. The public Worker configuration has no remote resources attached. Its SQL migrations show the storage design; production migration records are excluded.

Paint uses the browser Canvas API and keeps imported images in the browser. Games use isolated round state and optional score submission. The guide assembles answers from visible content; an optional server-side provider adapter can be configured separately. Widgets expose truthful unavailable states when services are disabled.

The public release retains general behavior tests and supplies example-content boundary tests. Tests tied to the private biography, media inventory or production release facts are excluded. No claim is made that the fictional content reproduces production case studies.
