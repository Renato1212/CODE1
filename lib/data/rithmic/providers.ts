export type RithmicProvider =
  | "rithmic-paper"
  | "rithmic-live"
  | "lucid"
  | "topstep"
  | "apex"
  | "amp"
  | "custom";

export interface ProviderPreset {
  label: string;
  gateway: "test" | "chicago" | "europe";
  system: string;
  hint?: string;
}

export const RITHMIC_PROVIDERS: Record<RithmicProvider, ProviderPreset> = {
  "rithmic-paper": {
    label: "Rithmic Paper Trading",
    gateway: "test",
    system: "Rithmic Paper Trading",
    hint: "Free paper account from yyy3.rithmic.com",
  },
  "rithmic-live": {
    label: "Rithmic Live",
    gateway: "chicago",
    system: "Rithmic 01",
    hint: "Direct Rithmic live account",
  },
  lucid: {
    label: "Lucid Trading",
    gateway: "chicago",
    system: "Rithmic 01",
    hint: "Usernames look like LT-XXXXXXXX",
  },
  topstep: {
    label: "Topstep",
    gateway: "chicago",
    system: "TopstepTrader",
    hint: "Combine, Funded, or eval accounts",
  },
  apex: {
    label: "Apex Trader Funding",
    gateway: "chicago",
    system: "Rithmic Test",
    hint: "Apex evaluation / PA accounts",
  },
  amp: {
    label: "AMP Futures",
    gateway: "chicago",
    system: "Rithmic 01",
    hint: "AMP direct Rithmic accounts",
  },
  custom: {
    label: "Custom",
    gateway: "test",
    system: "",
    hint: "Pick your own gateway + system name",
  },
};

export function guessProviderFromUser(user: string): RithmicProvider | null {
  if (!user) return null;
  const u = user.trim().toUpperCase();
  if (u.startsWith("LT-")) return "lucid";
  if (u.startsWith("TS-") || u.startsWith("TOPSTEP")) return "topstep";
  if (u.startsWith("APEX") || u.includes("APEX")) return "apex";
  return null;
}

// CME / CBOT / NYMEX / COMEX month codes.
// F=Jan G=Feb H=Mar J=Apr K=May M=Jun N=Jul Q=Aug U=Sep V=Oct X=Nov Z=Dec
const MONTH_LETTERS = ["F", "G", "H", "J", "K", "M", "N", "Q", "U", "V", "X", "Z"];

// Most equity-index futures only trade quarterly (Mar / Jun / Sep / Dec).
const QUARTERLY_ROOTS = new Set([
  "ES", "NQ", "YM", "RTY",
  "MES", "MNQ", "MYM", "M2K",
  "ZN", "ZB", "ZF",   // Treasuries: also quarterly (HMUZ)
  "6E", "6J", "6B",   // FX: quarterly
]);

/**
 * Best-effort front-month guess. Equity-index roots roll quarterly (HMUZ),
 * everything else monthly. Roll happens ~8 calendar days before the contract's
 * third-Friday expiry, but for sonification a one-week-before-expiry heuristic
 * is fine.
 */
export function guessFrontMonth(root: string, now = new Date()): string {
  const yDigit = now.getUTCFullYear() % 10;
  const month = now.getUTCMonth();   // 0-11
  const day = now.getUTCDate();
  const lateInMonth = day >= 22;     // roll once we're past mid-late month

  if (QUARTERLY_ROOTS.has(root)) {
    const quarterly = [2, 5, 8, 11]; // Mar Jun Sep Dec (0-indexed)
    let target = quarterly.find(qm => qm > month || (qm === month && !lateInMonth));
    let yr = yDigit;
    if (target === undefined) { target = quarterly[0]; yr = (yDigit + 1) % 10; }
    return `${root}${MONTH_LETTERS[target]}${yr}`;
  }

  let targetMonth = month + (lateInMonth ? 1 : 0);
  let yr = yDigit;
  if (targetMonth > 11) { targetMonth -= 12; yr = (yr + 1) % 10; }
  return `${root}${MONTH_LETTERS[targetMonth]}${yr}`;
}
