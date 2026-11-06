# T3 Code with minimize to tray

Personal fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code). It adds one thing: on Windows, closing the window keeps the app running in the system tray.

This branch only holds the automation. The code is on [`feat/minimize-to-tray`](https://github.com/x3vyx/t3code/tree/feat/minimize-to-tray), kept as a single commit.

Once a day, `fork-nightly.yml` takes the newest upstream nightly, applies that commit, builds the Windows installer, runs the tray test against the packaged app, and publishes a prerelease. The installed app picks it up through its normal updater.
