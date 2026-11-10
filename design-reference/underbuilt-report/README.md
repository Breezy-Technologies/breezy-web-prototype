# Underbuilt Report Versions (Claude design)

`Underbuilt Report Versions.html` is the self-contained export of the Claude design artifact
https://claude.ai/artifact/6tDhxvianA9DP2mqEaJKUL (five report versions, A to E, over sample data for
418 Wren Hollow Lane). Open it in a browser; it unpacks itself and works offline.

The prototype uses **version D ("Property"), main column only**: the scrolling analysis, without the
sticky property card. It is recorded from this file by `scripts/extract-ub-report.mjs` into
`public/ub-report/` and rendered by `components/report/UBReport.tsx` as the report sheet's
"Build guidelines" tab. Re-run the script after the design changes (usage in its header).

The rule icons (`assets/icons-v3/*.svg`) aren't bundled in the export; they come from the published
artifact's `project/assets/icons-v3/` and live in `public/ub-report/icons-v3/`.
