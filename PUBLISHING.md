# Publishing to npm

English summary of [PUBLICAR.md](PUBLICAR.md).

`.github/workflows/release.yml` publishes to npm with provenance when a GitHub release tagged `vX.Y.Z` is
published.

1. **First release only:** npm has no pending publishers, so 0.1.0 goes out with a short-lived granular
   token in the `NPM_TOKEN` secret of the `npm` environment. Then add the trusted publisher on npmjs.com
   (owner `typesearch-ai`, repository `typesearch-js`, workflow `release.yml`, environment `npm`), disallow
   tokens, and delete both the token and the secret.
2. **Every release:** bump `package.json`, date the `CHANGELOG.md` entry, merge to `main`, then publish a
   GitHub release tagged `vX.Y.Z`. The workflow fails if the tag does not match the version.
