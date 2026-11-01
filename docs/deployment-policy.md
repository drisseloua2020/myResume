# Main-Only Production Deployment

Only a successful **push to `main`** may publish release images or request production deployments. `feature_dev` remains a CI-only branch. These repository changes do not by themselves change an existing service's Render dashboard settings or GitHub environment rules.

## Workflow Behavior

| Event | Tests and scans | Publish images | Production deploy request |
| --- | --- | --- | --- |
| Push to `main` | Yes | After checks pass | After checks and production environment rules pass |
| Push to `feature_dev` | Yes | No | No |
| Push to `stage` | Yes | No | No |
| Pull request | Yes | No | No |
| Version tag push | Yes | No | No |
| Manual/reusable call from another event or ref | Caller-dependent | Guarded off | Guarded off |

Both the caller and reusable publishing/deployment jobs check the event and full ref. The Render helper separately rejects any event other than a push to `refs/heads/main` before contacting a service. `latest` image metadata explicitly identifies `main`, not whichever branch is configured as the repository default.

Render requests use `ref=<tested-main-commit-SHA>`, replacing any old `ref` in the hook URL. This prevents a main workflow from accidentally requesting the service's configured feature branch. Both hook URLs are validated before either request is sent; secret hook keys are never printed. This helper is for Git-backed Render services, not image URL overrides. Hook acceptance is not proof that a deployment completed successfully.

## Required Hosting Settings

Render automatic deployments are independent of GitHub Actions. A skipped GitHub deployment job does not stop Render from deploying its own linked branch.

For **both production API and UI services**:

1. Set **Auto-Deploy: Off** before changing the linked branch, to avoid an unintended automatic deployment while updating settings.
2. Set the linked **Branch: main**. Do not leave a production service linked to `feature_dev`.
3. Keep Auto-Deploy off when GitHub Actions deploy hooks are the release mechanism. This prevents automatic deployment from bypassing CI and production approvals.
4. Do not click a manual deploy while applying this policy. Merge reviewed changes to `main` and let its successful workflow request the intended release.

The policy does not merge `feature_dev` into `main` or deploy an older main revision automatically. Ensure the intended fixes are reviewed and merged before the next production release.

Render also disables automatic deploys when a deploy hook specifies a commit SHA, but do not wait for the next main workflow to correct an already-linked feature branch. See [Render automatic deployment settings](https://render.com/docs/deploys#automatic-deploys) and [specific-commit deploy hooks](https://render.com/docs/deploy-hooks#deploying-a-specific-git-commit).

## GitHub Production Environment

In the repository's `production` environment, select **Selected branches and tags** and permit only a **Branch** rule matching `main`. Remove rules permitting feature branches, stage branches or tags to deploy to production. Keep required reviewers where available. These are repository settings, not fields that workflow YAML can enforce by creating an environment name.

See [GitHub environment deployment rules](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments).

## Verification

```bash
python3 -m unittest discover -s .github/scripts -p 'test_*.py' -v
```

Tests use mocked HTTP clients, never live deploy hooks. They verify feature/stage/tag/PR/manual event rejection, tested-main commit pinning, old ref replacement, invalid hook rejection and secret-safe output. The setup workflow runs these tests before the rest of CI.

After merging this policy, verify that a `feature_dev` push runs CI but skips publication/deployment. Confirm the API and UI Render settings separately. No live hosting settings are considered verified solely because the workflow tests pass.
