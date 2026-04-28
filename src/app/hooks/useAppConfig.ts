import { useEffect, useState } from "react";
import { apiClient, type AppConfigResponse } from "../api/client";

const DEFAULT_CONFIG: AppConfigResponse = {
  betaSafeMode: false,
  schedulerEnabled: true,
  adminActionsEnabled: true,
  sources: [
    { id: "LIGA_POKEMON", name: "Liga Pokémon", enabled: true },
    { id: "CARDTRADER", name: "CardTrader", enabled: true },
    { id: "MYPCARDS", name: "MYP Cards", enabled: true }
  ]
};

export function useAppConfig() {
  const [config, setConfig] = useState<AppConfigResponse>(DEFAULT_CONFIG);

  useEffect(() => {
    apiClient.getConfig().then(setConfig).catch(() => {});
  }, []);

  return config;
}
