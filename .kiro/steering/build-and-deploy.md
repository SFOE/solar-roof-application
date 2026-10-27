---
inclusion: fileMatch
fileMatchPattern: '{vite.config.ts,package.json,backend/**,.github/workflows/**,.env*}'
---

# Build, CI & Deployment

Activated because a build-, CI-, or deployment-related file is in context.

## Build & dev pipeline

```
npm run dev          = vite (dev server, port 5173, VESE dev proxy active)
npm run build         = type-check + build-only (run in parallel via npm-run-all2)
npm run build-only    = vite build -> dist/
npm run preview       = vite preview (serves the dist/ build, port 4173)
npm run type-check    = vue-tsc --build
npm run lint-check    = oxlint . && eslint .      (CI runs this, no auto-fix)
npm run lint          = oxlint --fix && eslint --fix --cache
npm run format        = prettier --write src/
```

E2E tests need a production build first: `npm run build-only && npm run test:e2e`
(the `start-server-and-test` package boots `vite preview` on port 4173, waits
for it, then runs `cypress run --e2e`).

## Installing dependencies — `npm ci` only

A `preinstall` guard (`scripts/guard-install.js`) blocks plain `npm install`
(locally and in CI) so nobody accidentally drifts off the committed,
reviewed `package-lock.json`. Only two install paths are legitimate:

- `npm ci` — normal install, from the lockfile, for a fresh checkout or
  after pulling changes. This is what the guard allows and what every CI
  workflow uses.
- `npm install <package> --ignore-scripts` — the *only* way to add/update a
  dependency, since `--ignore-scripts` is also the only way to bypass the
  guard itself (an npm limitation, not a workaround specific to this repo).
  Commit the resulting `package.json`/`package-lock.json` diff.

Every CI workflow installs with `npm ci --ignore-scripts`, so a dependency's
`postinstall`/`prepare` scripts never execute during a workflow run. The one
script CI actually needs — downloading the Cypress browser binary, normally
a `postinstall` side effect — is run explicitly instead
(`npx cypress install` + `npx cypress verify` in `lint-test-build.yml`,
cached by `package-lock.json`'s hash). Never add `ignore-scripts=true` to
`.npmrc`; that would disable the `preinstall` guard for everyone, not just
bypass it for one `npm install` command.

## Environment files

Three env files, each with a distinct role — don't conflate them:

| File                | Committed? | Purpose                                                              |
| -------------------- | ---------- | --------------------------------------------------------------------- |
| `.env.local`         | No (gitignored) | Developer-only secret: `VITE_VESE_API_KEY`. Read only by the Node-side Vite dev proxy, never bundled. |
| `.env.production`    | Yes        | Public dev-environment config (`VITE_PVTARIF_API_URL` for the dev Lambda). Used by the default build and by CI. |
| `.env.prod`          | Yes        | Public prod-environment config. Used only when building with `--mode prod`. |

`VITE_PVTARIF_API_URL` is safe to commit — it's just the API Gateway URL, not
a secret. Never add an actual secret to `.env.production`/`.env.prod`;
anything in a `VITE_*`-prefixed variable ends up in the shipped JS bundle
regardless of which `.env*` file it came from.

## CI/CD workflows (`.github/workflows/`)

- **`lint-test-build.yml`** — lint, type-check, build, E2E. Runs on every PR,
  and is called by the frontend deploy pipeline on every push to `main`. Never
  deploys, never touches the backend.
- **`check-backend.yml`** — syntax + lint (`ruff`, pinned) of
  `backend/lambda_function.py`. Runs on *every* PR (no path filter) so it can
  be a required check; the backend package pipeline runs it first. No tests
  (none exist yet for the Lambda), no AWS access.
- **`package-and-deploy-frontend.yml`** — automatic on every push to `main`
  (including merged Dependabot PRs). Runs `lint-test-build.yml` first; only on
  success does it build and deploy to **dev** (S3 sync + CloudFront
  invalidation). A manual run can target `dev` or `prod` — `prod` is **never**
  deployed automatically. The env selects which `.env.*` file bakes into the
  build (`.env.production` for dev, `.env.prod` for prod via `--mode prod`).
- **`package-and-push-backend.yml`** — manual only. Packages
  `backend/lambda_function.py` into a zip, tags it, and pushes it to the
  target environment's artifact store. It does **not** deploy the Lambda —
  that happens by setting `source_code_version` to the new tag in
  `deploy.auto.tfvars.json` in the infrastructure repo and pushing there.
  Tags must be explicit (no `latest`, no unusual characters) and are not
  checked for reuse — pick a tag that hasn't been used.
- **`security.yml`** — `npm audit` via `audit-ci` (config: `audit-ci.jsonc`),
  on every PR and on push to `main`. Fails on a high/critical advisory with
  no allowlisted entry; use `audit-ci.jsonc`'s `allowlist` for a specific,
  reviewed advisory that has no fix available yet, rather than disabling the
  gate. Installs with `npm ci --ignore-scripts` like the other workflows;
  this job only audits the lockfile, so it never needs the Cypress binary.
- **Dependabot** (`dependabot.yml` + `dependabot-automerge.yml`) — monthly
  grouped PR for npm deps + GitHub Actions. A `cooldown` (7 days default, 3
  patch / 14 minor / 30 major) delays how soon a freshly published version
  can be proposed, so a version published during a supply-chain compromise
  isn't picked up immediately. Every Dependabot PR (including majors)
  auto-merges once its required checks pass, since `main` only auto-deploys
  to **dev**. Before the first prod deployment, tighten auto-merge back to
  patch/minor. `main` requires `lint-test-build.yml` and `check-backend.yml`
  as passing status checks for this to actually gate anything.

## Deploying to prod (manual, two repos)

1. Run `package-and-push-backend.yml` with `environment: prod` and a new
   version tag (e.g. `v1.2.0`).
2. In the **infrastructure repo**, set that tag as `source_code_version` in
   `deploy.auto.tfvars.json` for prod and push.
3. Run `package-and-deploy-frontend.yml` with `environment: prod`.

Never skip step 2 when releasing a backend change — the frontend deploy only
redeploys the static site; it does not touch the Lambda.

## Required GitHub secrets

`SFOE_SOLAR_ROOF_PIPELINE_ROLE_{DEV,PROD}` (OIDC role ARNs) and
`SFOE_SOLAR_ROOF_CLOUDFRONT_{DEV,PROD}` (distribution IDs). The VESE API key
itself is **not** a GitHub secret — it lives only in AWS Secrets Manager and
is referenced by name from the infrastructure repo.

## Lambda proxy deployment notes

The Lambda has no dependencies to install (a single stdlib + `boto3` file,
`boto3` is provided by the Lambda runtime) — that's why there's no backend
build step beyond packaging the zip. Keep it that way; adding a third-party
dependency means also adding a packaging/vendoring step that doesn't exist
today.
