# $0 deployment runbook

1. Fork or push the public repository.
2. Run `pnpm i`, then `pnpm verify` and `pnpm e2e`.
3. In Cloudflare Pages, connect the repository.
4. Use build command `pnpm --filter @rasoiguide/web build` and output `apps/web/dist`.
5. Deploy. Pull requests receive free preview URLs.

No backend, environment variables, secrets, database, card, or paid plan is required.

Recipe releases are semver folders under `content/packs`. Validate a pack with the content-schema tests, tag the content release, and publish immutable public-repository assets through a pinned jsDelivr URL. An active cook remains pinned to the pack version it started with.

## Optional Play Store appendix

A Trusted Web Activity can be packaged later with Bubblewrap. Google Play's one-time developer registration charge is outside v1 and is the only optionally paid item in the architecture.
