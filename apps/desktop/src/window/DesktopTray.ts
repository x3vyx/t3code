import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";

import * as Electron from "electron";

import * as DesktopAssets from "../app/DesktopAssets.ts";
import * as DesktopEnvironment from "../app/DesktopEnvironment.ts";
import { makeComponentLogger } from "../app/DesktopObservability.ts";
import * as DesktopState from "../app/DesktopState.ts";
import * as ElectronApp from "../electron/ElectronApp.ts";
import * as DesktopWindow from "./DesktopWindow.ts";

const { logWarning: logTrayWarning } = makeComponentLogger("desktop-tray");

class DesktopTrayCreateError extends Schema.TaggedError<DesktopTrayCreateError>()(
  "DesktopTrayCreateError",
  { cause: Schema.Defect() },
) {
  override get message(): string {
    return "Could not create the tray icon.";
  }
}

// Windows only: macOS already keeps the app alive in the Dock, and Linux trays
// can vanish silently (stock GNOME has none), which would strand a hidden window.
export const register = Effect.gen(function* () {
  const environment = yield* DesktopEnvironment.DesktopEnvironment;
  if (environment.platform !== "win32") return;

  const assets = yield* DesktopAssets.DesktopAssets;
  const desktopState = yield* DesktopState.DesktopState;
  const desktopWindow = yield* DesktopWindow.DesktopWindow;
  const electronApp = yield* ElectronApp.ElectronApp;
  const runPromise = Effect.runPromiseWith(yield* Effect.context<never>());

  const iconPath = Option.getOrUndefined((yield* assets.iconPaths).ico);
  if (iconPath === undefined) {
    yield* logTrayWarning("tray icon not found; closing the window will quit");
    return;
  }

  const openMainWindow = () => {
    void runPromise(
      desktopWindow.activate.pipe(
        Effect.catchCause((cause) => logTrayWarning("failed to open from tray", { cause })),
      ),
    );
  };

  yield* Effect.acquireRelease(
    Effect.try({
      try: () => {
        const tray = new Electron.Tray(iconPath);
        tray.setToolTip(environment.displayName);
        tray.setContextMenu(
          Electron.Menu.buildFromTemplate([
            { label: `Open ${environment.displayName}`, click: openMainWindow },
            { type: "separator" },
            {
              label: `Quit ${environment.displayName}`,
              click: () => void runPromise(electronApp.quit),
            },
          ]),
        );
        tray.on("click", openMainWindow);
        return tray;
      },
      catch: (cause) => new DesktopTrayCreateError({ cause }),
    }).pipe(Effect.tap(() => Ref.set(desktopState.trayActive, true))),
    (tray) =>
      Ref.set(desktopState.trayActive, false).pipe(
        Effect.andThen(Effect.sync(() => tray.destroy())),
      ),
  ).pipe(
    Effect.catchCause((cause) =>
      logTrayWarning("failed to create tray icon; closing the window will quit", { cause }),
    ),
  );
}).pipe(Effect.withSpan("desktop.tray.register"));
