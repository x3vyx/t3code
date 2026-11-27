# T3 Code with minimize to tray

Personal fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code). It adds one thing: on Windows, closing the window keeps the app running in the system tray.

This branch only holds the automation. The code is on [`feat/minimize-to-tray`](https://github.com/x3vyx/t3code/tree/feat/minimize-to-tray), as a few commits on top of upstream `main`.

Once a day, `fork-nightly.yml` takes the newest upstream nightly, applies those commits, builds the Windows installer, runs the tray test against the packaged app, and publishes a prerelease. The installed app picks it up through its normal updater.

## What the branch carries

The workflow cherry-picks every commit the branch has ahead of upstream `main`, oldest first. The first one is the tray and must apply, or the run fails. A later one that conflicts is left out: the build is still published, with "(partial)" in the release title and the missing commit named in the notes. Until 2026-11-19 everything was one commit, and a conflict in the usage screens cost the whole build three days in a row.

Keep one commit per feature, tray first, and amend changes into the commit they belong to. A commit must build without the ones after it.

- **Tray** (commit 1). Shaped as insertions so it rarely conflicts: the logic lives in fork-only files (`CloseToTray.ts`, `DesktopTray.ts`, `CloseToTraySettingsRow.tsx`), and upstream files get one-line hooks. Keep new tray code in those files.
- **Bootstrap timeout** (commit 2). `apps/server/src/bootstrap.ts` waits 30 s instead of 1 s for the desktop bootstrap envelope. With 1 s, a slow cold start made the server drop the envelope and come up in web mode, and the desktop then failed with "Failed to create the local desktop bearer session". Reported upstream in [#17367](https://github.com/pingdotgg/t3code/issues/17367#issuecomment-6850165045). Drop this commit once upstream ships its own fix; until then it is left out by itself when it stops applying.
- **Usage limits as used** (commit 3). A "Show usage limits as used" setting (Settings → General, off by default so upstream's tests still pass). When on, the Limits views and the thread details show the percentage used and the bars fill by what is used. The logic is in the fork-only `limitDirection.ts` and `UsageLimitsUsedSettingsRow.tsx`; `UsageLimits.tsx`, `UsageLimitsPooled.tsx` and `ThreadDetailsUsage.tsx` call it. Upstream translates its copy; the fork's copy stays in English, except the word "used", which `limitDirection.ts` carries per language so the fork adds no keys to the translation files. This commit touches the most upstream code and is the one that usually gets left out. Requested upstream in [discussion 32499](https://github.com/pingdotgg/t3code/discussions/32499); drop it if they ship their own.

Codex connected through "Sign in with ChatGPT" shows no limits because that connection spends a separate allowance T3 Code cannot read ([discussion 37464](https://github.com/pingdotgg/t3code/discussions/37464)). A Codex instance added with "Configure manually" uses the CLI login and shows them.

If the bearer-session error shows up on a build without the fix, quit from the tray icon and reopen. Closing the window only hides it and keeps the broken backend.

## When the nightly fails or comes out partial

The usual cause is a cherry-pick conflict because upstream touched a line next to one of the hooks. A run that fails in a later step is a change in upstream's build instead: read the failed step first. A failed run means the tray commit conflicted (`gh run view <id> -R x3vyx/t3code --log-failed`); a "(partial)" release names the commit that was left out. Either way, in a checkout of `feat/minimize-to-tray`:

```sh
git fetch upstream --tags
git branch -f backup/tray-pre-rebase-<date> HEAD
git rebase upstream/main            # resolve keeping upstream's side plus the fork's hook
pnpm install                        # upstream's lockfile moves; stale node_modules fails typecheck
vp run check:changed
git push --force-with-lease=feat/minimize-to-tray:<old-sha> origin feat/minimize-to-tray
gh workflow run "Fork nightly" -R x3vyx/t3code --ref fork-automation
```

The workflow skips a nightly tag that already has a release here. To replace a partial release, delete it first. To try a build without publishing, run with `-f force=true -f publish=false`.

## State on 2026-11-27

- Latest release: `v0.1.14-nightly.20261127.5332`, with all three commits (`46a720b831`, `d6729d902d`, `66ca39ec1a`). The branch before that rebase is the local branch `backup/tray-pre-rebase-1127`.
- No release came out from 2026-11-23 to 2026-11-26. The native Windows build passed the file-count guard the workflow had raised to 100 (now 150), and upstream fused off Node inspector flags in packaged builds (#43039), which Playwright needs to drive the app. The packaged-app test now runs on a copy of the app with that one fuse turned back on (`enable-inspect-fuse.cjs`); the published installer keeps it off.
- `vp run check:changed` fails locally on Windows in `DesktopWindow.test.ts` (two upstream cases compare a POSIX preload path). It is unrelated to the fork.
- The usage setting passed the component tests but was not checked by eye in the running app. With it on, the bar tooltip drops the "% of the window left" part and screen-reader labels still say how much is left.
- The browser tests need Playwright's headless shell: `playwright install chromium-headless-shell` from `apps/web`.
- Open: drop the bootstrap timeout change when upstream fixes #17367.
- Open: the run's checkout cleanup logs a `git` exit code 128 annotation. It does not fail the run and was not investigated.
