import { useLocale } from "gt-react";

import { usePrimarySettings } from "../../hooks/useSettings";

// Kept here instead of in the translation files so the fork adds no keys to them.
const USED_WORD: Record<string, string> = {
  de: "verbraucht",
  es: "usado",
  fr: "utilisé",
  ja: "使用済み",
  ko: "사용",
  "pt-BR": "usado",
  ru: "использовано",
  sv: "använt",
  zh: "已用",
};

export interface LimitDirection {
  readonly used: boolean;
  /** Turns a remaining percentage into the one to display. */
  readonly show: (remainingPercent: number) => number;
  /** `leftText` is the translated "% left" text for the same percentage. */
  readonly percent: (remainingPercent: number, leftText: string) => string;
  /** `leftWord` is the translated word for "left". */
  readonly word: <Left>(leftWord: Left) => Left | string;
}

const LEFT: LimitDirection = {
  used: false,
  show: (percent) => percent,
  percent: (_percent, leftText) => leftText,
  word: (leftWord) => leftWord,
};

export function useLimitDirection(): LimitDirection {
  const used = usePrimarySettings((settings) => settings.usageLimitsShowUsed);
  const usedWord = USED_WORD[useLocale()] ?? "used";
  if (!used) return LEFT;
  return {
    used: true,
    show: (percent) => 100 - percent,
    percent: (percent) => `${100 - percent}% ${usedWord}`,
    word: () => usedWord,
  };
}
