# Public edition privacy boundary

The publisher copies explicitly reviewed source paths, rewrites presentation identifiers only in the export, and overlays authored fictional data and SVG examples. Original content JSON, images, PDFs, videos, planning records, captured logs, private runtime state and Git history are never copied. The public repository has its own independent commit history.

The two JPEGs under `docs/screenshots/` are a narrow exception to the original-media exclusion. They show only the fictional local demo and were visually reviewed. Exact hashes, dimensions and a JPEG metadata policy gate these files; EXIF, comments, profiles and embedded thumbnails are rejected. `docs/screenshots/review.json` records the approved bytes. They contain no original personal photographs or browser chrome.

Text files pass content/credential checks and screenshots pass their review gate before dependency installation, builds and tests. Publication stops on a failed check. Pattern scanning cannot recognize every future disclosure; new source paths require review and newly written code must avoid personal information or secrets.

Runtime forms in your own local fork can save information under `.local`; keep it private. The demonstration's local owner password, state and backups are not part of Git. Publicly displaying your own information in a future deployment makes that displayed information public regardless of source repository visibility.
