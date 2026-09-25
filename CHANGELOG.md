# Changelog

All notable changes to `typesearch-js` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.1.0] - Unreleased

First release.

- `Typesearch` client for every endpoint of the typesearch API v1: `search`, `searchStream`, `similar`,
  `contents`, `siteSearch`, `siteSearchAndWait`, `siteSearchStream`, `jobs.get`, `jobs.wait`, `sources`
  and `usage`.
- Request and response types generated from the API's OpenAPI document.
- Automatic retries with exponential backoff and jitter for connection errors, timeouts, `429 rate_limited`
  and `5xx`, honouring `Retry-After`; `quota_exceeded` is never retried.
- Per-request `timeout`, `maxRetries`, `signal` and `headers`.
- Typed errors: `APIError` and its subclasses by status, `APIConnectionError`, `APITimeoutError`,
  `JobFailedError`.
- ESM and CommonJS builds with no runtime dependencies, for Node 18+, Bun, Deno and edge runtimes.
