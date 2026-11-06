/* oxlint-disable t3code/no-untranslated-copy -- fork-only copy stays out of the translation files */
import { DEFAULT_UNIFIED_SETTINGS } from "@t3tools/contracts/settings";

import { Switch } from "../ui/switch";
import { SettingResetButton, SettingsRow } from "./settingsLayout";
import { useSearchableSetting } from "./settingsSearch";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";

export function UsageLimitsUsedSettingsRow() {
  const setting = useSearchableSetting();
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();

  return (
    <SettingsRow
      {...setting("usage-limits-show-used")}
      description="Usage limits show how much you have used instead of how much is left."
      resetAction={
        settings.usageLimitsShowUsed !== DEFAULT_UNIFIED_SETTINGS.usageLimitsShowUsed ? (
          <SettingResetButton
            ariaLabel="Reset show usage limits as used to default"
            onClick={() =>
              updateSettings({
                usageLimitsShowUsed: DEFAULT_UNIFIED_SETTINGS.usageLimitsShowUsed,
              })
            }
          />
        ) : null
      }
      control={
        <Switch
          checked={settings.usageLimitsShowUsed}
          onCheckedChange={(checked) => updateSettings({ usageLimitsShowUsed: Boolean(checked) })}
          aria-label="Show usage limits as used"
        />
      }
    />
  );
}
