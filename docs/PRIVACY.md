# Public edition privacy boundary

The publisher copies explicitly reviewed source paths, rewrites presentation identifiers only in the export, and overlays authored fictional data and SVG examples. Original content JSON, images, PDFs, videos, planning records, captured logs, private runtime state and Git history are never copied. The public repository has its own independent commit history.

All files pass text/credential checks before publication, followed by dependency installation, build/type checks and automated tests. Publication stops on a failed check. Pattern scanning cannot recognize every possible future disclosure; new source paths require review and any newly written code must continue to avoid embedding personal information or secrets.

Runtime forms in your own local fork can save information under `.local`; keep it private. The demonstration's local owner password, state and backups are not part of Git. Publicly displaying your own information in a future deployment makes that displayed information public regardless of source repository visibility.
