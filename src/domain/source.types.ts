export const sourceKeys = ["LIGA_POKEMON", "CARDTRADER", "MYPCARDS"] as const;

export type SourceKey = (typeof sourceKeys)[number];

export const sourceLabels: Record<SourceKey, string> = {
  LIGA_POKEMON: "Liga Pokemon",
  CARDTRADER: "CardTrader",
  MYPCARDS: "MYP Cards"
};

export const monitorStatuses = ["running", "success", "partial", "error"] as const;

export type MonitorStatus = (typeof monitorStatuses)[number];

export type SourceScrapeStatus = Exclude<MonitorStatus, "running">;

