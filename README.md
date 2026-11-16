# T3 Code with minimize to tray

Personal fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code). It adds one thing: on Windows, closing the window keeps the app running in the system tray.

This branch only holds the automation. The code is on [`feat/minimize-to-tray`](https://github.com/x3vyx/t3code/tree/feat/minimize-to-tray), kept as a single commit.

Once a day, `fork-nightly.yml` takes the newest upstream nightly, applies that commit, builds the Windows installer, runs the tray test against the packaged app, and publishes a prerelease. The installed app picks it up through its normal updater.

## What the commit carries

The workflow cherry-picks only the tip of `feat/minimize-to-tray`. Every fork change must be amended into that one commit; a second commit is silently left out of the build.

- **Tray.** The commit is shaped as insertions so it rarely conflicts: the logic lives in fork-only files (`CloseToTray.ts`, `DesktopTray.ts`, `CloseToTraySettingsRow.tsx`), and upstream files get one-line hooks. Keep new tray code in those files.
- **Bootstrap timeout.** `apps/server/src/bootstrap.ts` waits 30 s instead of 1 s for the desktop bootstrap envelope. With 1 s, a slow cold start made the server drop the envelope and come up in web mode, and the desktop then failed with "Failed to create the local desktop bearer session". Reported upstream in [#17367](https://github.com/pingdotgg/t3code/issues/17367#issuecomment-6850165045). Remove this change from the commit once upstream ships its own fix; it will conflict on that line when they do.
- **Usage limits as used.** A "Show usage limits as used" setting (Settings → General, off by default so upstream's tests still pass). When on, the Limits views and the thread details show the percentage used and the bars fill by what is used. The logic is in the fork-only `limitDirection.ts` and `UsageLimitsUsedSettingsRow.tsx`; `UsageLimits.tsx`, `UsageLimitsPooled.tsx` and `ThreadDetailsUsage.tsx` call it. Requested upstream in [discussion 32499](https://github.com/pingdotgg/t3code/discussions/32499); drop it if they ship their own.

Codex connected through "Sign in with ChatGPT" shows no limits because that connection spends a separate allowance T3 Code cannot read ([discussion 37464](https://github.com/pingdotgg/t3code/discussions/37464)). A Codex instance added with "Configure manually" uses the CLI login and shows them.

If the bearer-session error shows up on a build without the fix, quit from the tray icon and reopen. Closing the window only hides it and keeps the broken backend.

## When the nightly fails

The usual cause is a cherry-pick conflict because upstream touched a line next to one of the hooks. Check with `gh run view <id> -R x3vyx/t3code --log-failed`, then in a checkout of `feat/minimize-to-tray`:

```sh
git fetch upstream --tags
git branch -f backup/tray-pre-rebase-<date> HEAD
git rebase upstream/main            # resolve keeping upstream's side plus the tray hook
pnpm install                        # upstream's lockfile moves; stale node_modules fails typecheck
vp run check:changed
# prints only a tree hash when the commit applies cleanly on the newest nightly tag
git merge-tree --write-tree --name-only --merge-base HEAD~1 <nightly-tag> HEAD
git push --force-with-lease=feat/minimize-to-tray:<old-sha> origin feat/minimize-to-tray
gh workflow run "Fork nightly" -R x3vyx/t3code --ref fork-automation
```

The workflow skips a nightly tag that already has a release here. To rebuild one, delete that release first.

## State on 2026-11-16

- Latest release: `v0.1.10-nightly.20261116.4761`, the first build with the usage setting. Tray commit `53bc25ca1f`. The bootstrap timeout change has shipped since `4682`.
- The usage setting passed the component tests but was not checked by eye in the running app.
- The browser tests need Playwright's headless shell: `playwright install chromium-headless-shell` from `apps/web`.
- Open: drop the bootstrap timeout change when upstream fixes #17367.
- Open: the run's checkout cleanup logs a `git` exit code 128 annotation. It does not fail the run and was not investigated.
