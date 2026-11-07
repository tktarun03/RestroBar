---
name: release
description: Ship a new RestroBar version to GitHub Pages - release notes, version bump everywhere, tests, push, and verify the deploy.
---

# Release RestroBar

1. **Pick the version** (semver). Bug fixes → patch, new features → minor.
2. **Release notes**
   - Add an entry at the top of `RELEASES` in `js/core/version.js` (plain user-facing sentences).
   - Add the same at the top of `CHANGELOG.md` as `## X.Y.Z (YYYY-MM-DD)`.
3. **Bump the version everywhere**
   - `APP_VERSION` in `js/core/version.js`
   - every `?v=` in `index.html` (`sed -i 's/?v=OLD/?v=NEW/g' index.html`)
   - `VERSION` in `sw.js`
   - `version` in `package.json`
4. **If a saved field was added**, check it has a default in `Store.migrate()`.
5. **Test**: `npm test`. All must pass. If bill maths or parsing changed, add a case to `tests/billing.test.mjs` or `tests/merge.test.mjs`.
6. **Commit and push to `main`.**
7. **Verify the deploy**: poll until both runs succeed for the pushed commit:
   `gh api "repos/tktarun03/restrobar/actions/runs?head_sha=$(git rev-parse HEAD)" --jq '.workflow_runs[] | [.name, .status, .conclusion] | @tsv'`
   Expect the CI workflow (jobs "Tests" then "Deploy") to conclude `success`. Then open https://tktarun03.github.io/restrobar/ and check Settings → Version history shows the new version.
8. **Report briefly, flaws first**, with [Certain]/[Likely]/[Guessing], and say what was tested in a browser versus on a real phone.
