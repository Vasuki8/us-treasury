# Cloudflare deployment

Cloudflare is the selected production host. The configuration uses **Workers Static Assets**, Cloudflare's recommended platform for new static sites. It serves `dist/` directly; no Worker server script, framework migration or database is needed. [Official static hosting guidance](https://developers.cloudflare.com/workers/static-assets/), [GitHub Actions deployment](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/).

## Migration status

The Cloudflare deployment configuration and Actions job are prepared. Cloudflare publication is not active until the Worker and deployment credential are configured and a real deployment passes verification. The existing [GitHub Pages site](https://vasuki8.github.io/us-treasury/) remains available during setup. A skipped Cloudflare job does not establish that Cloudflare is live.

The target Worker is `us-treasury` in the signed-in account. Its existing workers.dev account subdomain is `patelvasuki.workers.dev`, so the expected address is `https://us-treasury.patelvasuki.workers.dev/`; this address must be verified after publication. No custom domain is attached by this configuration.

## One-time account setup

1. In [Cloudflare Workers & Pages](https://dash.cloudflare.com/), create a separate application named **us-treasury**, using **Upload your static files**. Upload the contents of the locally tested `dist/` folder (or the prepared `test-results/cloudflare-static.zip`, with `index.html` at the archive root). Complete the initial publication so a token can be scoped to this Worker. Use the existing account and workers.dev subdomain. Other Workers and domain routes are outside this migration.
2. Create an **account-owned API token** with **Workers Editor** access limited to this Worker. Current Cloudflare permissions distinguish editing an existing Worker from creating one; creating a new Worker needs broader Workers product Admin access. Bootstrapping first avoids granting the CI token that broader access. No zone or custom-domain permission is needed for workers.dev hosting. [Authorization reference](https://developers.cloudflare.com/workers/authorization/).
3. Save that token directly in [the repository's Actions secrets](https://github.com/Vasuki8/us-treasury/settings/secrets/actions) as **CLOUDFLARE_API_TOKEN**. Do not put it in chat, a source file, a workflow literal, a command argument or a committed environment file.
4. **CLOUDFLARE_ACCOUNT_ID** is already configured in [repository Actions variables](https://github.com/Vasuki8/us-treasury/settings/variables/actions) for the selected account. Set **DEPLOY_TARGET** to **cloudflare** only after the Worker and token are ready. Missing credentials fail with an explicit error.
5. Run **Test, build and deploy** manually on `main`, or push a commit to `main`. Check **Deploy Cloudflare** and its public verification step. The deployment URL appears in the `cloudflare-production` environment.

## Automated path

- Pull requests run the Node 22/24 tests, build and local HTTP smoke check; they do not deploy or receive the Cloudflare credential.
- Main pushes/manual runs and daily scheduled runs must pass both verification jobs. The daily run at 23:37 UTC refreshes all official data and release calendars first; a manual `main` run does the same when **refresh_data** is enabled. Source or validation failures stop publication. The Cloudflare job downloads `meridian-static-node-24` from that same run and checks out deployment configuration from its exact verified commit, then publishes the artifact with the pinned Wrangler action and CLI version. It does not rebuild different app assets during deployment.
- `wrangler.json` includes only `dist/`. Missing assets return 404; the app's existing hash routes work at the origin root. Source scripts, tests, documentation, credentials and unrelated local exports are not published.
- `scripts/check-live.mjs` verifies the HTTPS deployment entry and imported asset graph against the downloaded build, including exact byte content and JavaScript MIME types. A failed public check fails the deployment job for investigation; it does not silently change the hosting target or automatically roll back.
- Main workflow runs are serialized, preserving an in-progress deployment. Deployment secrets are passed only to the gated Cloudflare job.

Until `DEPLOY_TARGET=cloudflare`, the existing Pages job remains the active deployment path. Selecting Cloudflare skips the Pages artifact and deployment jobs. The existing Pages URL is retained as a migration fallback; it is not deleted automatically.

## Local checks

```powershell
npm test
npm run build
node scripts/check-build.mjs
npx --yes wrangler@4.151.3 deploy --dry-run
```

Wrangler is deployment tooling; the application itself retains no package dependencies. Local `.wrangler/` output is ignored. The dry run checks packaging without account changes or publication.

After a deployment, run `node scripts/check-live.mjs https://YOUR-DEPLOYMENT/` against the same local build. Exact byte checks should use the same checkout/line endings as CI; Git normalizes tracked source to LF.

## Rollback and later domains

For a content rollback, revert the faulty commit, test and push to `main`; the same deployment gates apply. Cloudflare also records prior Worker deployments. During migration, clearing `DEPLOY_TARGET` restores the Pages deployment path on the next main run. Keep the existing site until the Cloudflare address has been verified.

A custom domain can be attached after the workers.dev deployment is verified and the intended hostname is chosen. Domain routing and any additional token permissions are a separate account change; the current Worker needs none. The official data rights policy, required BLS notice, snapshots and calculation provenance apply on both hosts. Advertising implementation and privacy/consent work remain separate from this hosting configuration.

## Preparation verification — October 21, 2026

All 96 Node tests passed, the production build passed its commercial-data check, and the local built HTTP smoke test loaded 12 assets. Wrangler 4.151.3 accepted the assets-only configuration in a dry run without publishing. The initial-upload ZIP contains only the static build, with `index.html` at its root. Independent review found no workflow or verifier blockers. Public Cloudflare verification remains pending account setup; the production-target variable was not switched during preparation.
