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
  (Dependabot batches start it by `workflow_dispatch` instead). Runs `lint-test-build.yml` first; only on
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
- **Dependabot** (`dependabot.yml` + `dependabot-automerge.yml`) — monthly,
  one grouped PR for npm deps and one for GitHub Actions, with a 7-day
  `cooldown` (only versions released ≥ 7 days ago; security updates are not
  delayed). PRs are **not** merged as they arrive: the "Dependabot batch
  merge" workflow runs weekly (cron `0 6 * * 1`, Monday 06:00 UTC, or manually), merges
  every open Dependabot PR whose checks are green (`gh pr checks`), majors
  included, then starts **one** dev deployment via `workflow_dispatch`
  (a merge made with `GITHUB_TOKEN` does not trigger the push workflow).
  PRs with a failing or running check are skipped. Before relying on this
  for prod, tighten it back to patch/minor.
  **Caveat:** the repository is private on the GitHub Free organisation plan,
  where branch protection rules and rulesets are **not enforced**, which is
  why the workflow checks the results itself. Don't describe `main` as
  protected until the repository is public or the plan is upgraded.

## Deploying to prod (manual, two repos)

1. Run `package-and-push-backend.yml` with `environment: prod` and a new
   version tag (e.g. `v1.2.0`).
2. In the **prod infrastructure repo** (`prometheon-solar-roof-prod`), set that
   tag as `source_code_version` in `deploy.auto.tfvars.json`, on a branch, and
   open a PR. Its pipeline plans on the PR and applies when the PR is merged to
   `main` (the dev repo `prometheon-solar-roof-dev` works the same way).
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
