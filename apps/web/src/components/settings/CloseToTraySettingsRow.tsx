/* oxlint-disable t3code/no-untranslated-copy -- fork-only copy stays out of the translation files */
import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts/settings";

import { isElectron } from "../../env";
import { isWindowsPlatform } from "../../lib/utils";
import { Switch } from "../ui/switch";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { useSearchableSetting } from "./settingsSearch";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";

export function CloseToTraySettingsRow() {
  const setting = useSearchableSetting();
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();

  if (!isElectron || !isWindowsPlatform(navigator.platform)) return null;

  return (
    <SettingsRow
      {...setting("close-to-tray")}
      description="Closing the window keeps T3 Code running in the system tray. Quit from the tray icon."
      resetAction={
        settings.closeToTray !== DEFAULT_UNIFIED_SETTINGS.closeToTray ? (
          <SettingResetButton
            ariaLabel="Reset minimize to tray on close to default"
            onClick={() => updateSettings({ closeToTray: DEFAULT_UNIFIED_SETTINGS.closeToTray })}
          />
        ) : null
      }
      control={
        <Switch
          checked={settings.closeToTray}
          onCheckedChange={(checked) => updateSettings({ closeToTray: Boolean(checked) })}
          aria-label="Minimize to tray on close"
        />
      }
    />
  );
}
