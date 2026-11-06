// End-to-end check of close-to-tray on the packaged fork build, fully isolated from the live app.
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync, spawn } = require("child_process");

const repo = process.env.T3_REPO;
const { _electron } = require(path.join(repo, "apps/desktop/node_modules/playwright-core"));
const exe = process.argv[2];
const shotDir = process.argv[3];
const FIXTURE = path.join(repo, "scripts/fixtures/desktop-launch/statev2.sqlite");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "t3-tray-e2e-"));
const t3Home = path.join(root, "t3");
for (const d of ["roaming", "local", "home", "t3/userdata"]) fs.mkdirSync(path.join(root, d), { recursive: true });
fs.copyFileSync(FIXTURE, path.join(t3Home, "userdata/statev2.sqlite"));

const env = {
  ...process.env,
  APPDATA: path.join(root, "roaming"),
  LOCALAPPDATA: path.join(root, "local"),
  USERPROFILE: path.join(root, "home"),
  HOME: path.join(root, "home"),
  T3CODE_HOME: t3Home,
  T3CODE_TELEMETRY_ENABLED: "false",
  T3CODE_DISABLE_AUTO_UPDATE: "true",
};

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -- " + detail : ""}`);
};
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms, label) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn().catch(() => undefined);
    if (v) return v;
    if (Date.now() > end) throw new Error("timed out: " + label);
    await delay(150);
  }
}

function postMessage(hwnd, msg, wParam, lParam = "0") {
  const script = `
Add-Type -Namespace W -Name U -MemberDefinition '[System.Runtime.InteropServices.DllImport("user32.dll")] public static extern bool PostMessage(System.IntPtr h, uint m, System.UIntPtr w, System.IntPtr l);'
[void][W.U]::PostMessage([System.IntPtr]::new([long]${hwnd}), ${msg}, [System.UIntPtr]::new([uint64]${wParam}), [System.IntPtr]::new([long]${lParam}))`;
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { stdio: "ignore" });
}
const clickX = (hwnd) => postMessage(hwnd, 0x0112, 0xf060); // WM_SYSCOMMAND / SC_CLOSE

const mainInfo = (app) =>
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .filter((w) => !w.webContents.getURL().startsWith("data:"))
      .map((w) => ({
        visible: w.isVisible(),
        hwnd: w.getNativeWindowHandle().readBigUInt64LE(0).toString(),
        url: w.webContents.getURL(),
      }))[0],
  );

const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const killTree = (pid) => {
  if (!isAlive(pid)) return;
  try {
    execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  } catch {}
};

const mainPage = (app) =>
  until(async () => app.windows().find((w) => !w.url().startsWith("data:")), 30_000, "main page");

async function launch() {
  const app = await _electron.launch({ executablePath: exe, env, timeout: 90_000 });
  const pid = app.process().pid;
  const info = await until(async () => {
    const i = await mainInfo(app);
    return i && i.visible ? i : undefined;
  }, 90_000, "main window visible");
  return { app, pid, info };
}

async function main() {
  // A: X hides, relaunch reveals, quit from hidden is clean.
  {
    const { app, pid, info } = await launch();
    try {
      check("A1 main window opens visible", info.visible, info.url);
      clickX(info.hwnd);
      await until(async () => (await mainInfo(app)).visible === false, 8_000, "window hidden");
      await delay(1500);
      const hidden = await mainInfo(app);
      check("A2 X hides the window", hidden.visible === false);
      check("A3 app process survives the X", isAlive(pid));
      const page = await mainPage(app);
      check("A4 renderer still alive while hidden", (await page.evaluate(() => 1 + 1)) === 2);

      const second = spawn(exe, [], { env, stdio: "ignore" });
      await until(async () => (await mainInfo(app)).visible === true, 15_000, "window revealed");
      check("A5 opening the app again reveals the hidden window", true);
      await new Promise((r) => (second.exitCode !== null ? r() : second.once("exit", r)));
      check("A6 second launch exits, one instance stays", isAlive(pid));

      clickX(info.hwnd);
      await until(async () => (await mainInfo(app)).visible === false, 8_000, "hidden again");
      await app.evaluate(({ app: a }) => void a.quit()).catch(() => {});
      await until(async () => !isAlive(pid), 30_000, "exit after quit");
      check("A7 Quit while hidden exits the app", true);
    } finally {
      killTree(pid);
    }
  }

  // B: turning the setting off in the real UI makes the X quit again.
  {
    const { app, pid, info } = await launch();
    try {
      const page = await mainPage(app);
      await page.evaluate(() => {
        window.location.hash = "#/settings/general";
      });
      const toggle = page.getByRole("switch", { name: "Minimize to tray on close" });
      try {
        await toggle.waitFor({ timeout: 30_000 });
      } catch (error) {
        console.log("page url:", page.url());
        await page.screenshot({ path: path.join(shotDir, "tray-setting-fail.png") });
        throw error;
      }
      check("B1 setting row is shown, on by default", (await toggle.getAttribute("aria-checked")) === "true" || (await toggle.isChecked()));
      await toggle.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(shotDir, "tray-setting.png") });
      await toggle.click();
      const file = path.join(t3Home, "userdata/client-settings.json");
      await until(async () => /"closeToTray"\s*:\s*false/.test(fs.readFileSync(file, "utf8")), 10_000, "setting persisted");
      check("B2 turning it off persists", true);
      clickX(info.hwnd);
      await until(async () => !isAlive(pid), 30_000, "exit after X with setting off");
      check("B3 X quits the app with the setting off", true);
    } finally {
      killTree(pid);
    }
  }

  // C: a Windows shutdown must never be blocked by a window hiding itself.
  {
    fs.writeFileSync(path.join(t3Home, "userdata/client-settings.json"), JSON.stringify({ closeToTray: true }));
    const { app, pid, info } = await launch();
    try {
      postMessage(info.hwnd, 0x0016, 1, "2147483648"); // WM_ENDSESSION, ENDSESSION_LOGOFF
      await delay(1000);
      if (isAlive(pid)) clickX(info.hwnd);
      await until(async () => !isAlive(pid), 30_000, "exit after session end");
      check("C1 session end lets the app close", true);
    } finally {
      killTree(pid);
    }
  }
}

main()
  .catch((e) => {
    check("run completed", false, e.message);
  })
  .finally(() => {
    try {
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 5 });
    } catch {}
    const failed = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
  });
