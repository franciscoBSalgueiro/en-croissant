# Downloadable opening catalog

In **New repertoire → From an opening**, click **Download opening catalog**.
The app downloads the five ECO TSV volumes from
https://github.com/lichess-org/chess-openings at revision
`a6189a30dc273ccb21fc2536a9a2fefd5592a67a` over HTTPS.

The source is released under CC0-1.0:
https://github.com/lichess-org/chess-openings/blob/a6189a30dc273ccb21fc2536a9a2fefd5592a67a/COPYING.txt

Downloads are validated and then cached in the application's data directory as
`opening-catalog-<revision>.json`. Subsequent use works offline. Missing or
invalid cache files can be downloaded again from the same dialog. No catalog
files are bundled or checked into this repository. Tests use small synthetic
fixtures and do not require network access.
