import { Router } from "express";
import { env } from "../../config/env.js";

export const configRouter = Router();

// Expõe flags seguras para o frontend consumir.
// Nunca expõe secrets, tokens ou paths sensíveis.
configRouter.get("/", (_req, res) => {
  res.json({
    betaSafeMode: env.ENABLE_BETA_SAFE_MODE,
    schedulerEnabled: env.ENABLE_SCHEDULER,
    adminActionsEnabled: env.ENABLE_ADMIN_DANGEROUS_ACTIONS,
    sources: [
      { id: "LIGA_POKEMON", name: "Liga Pokémon", enabled: true },
      { id: "CARDTRADER", name: "CardTrader", enabled: true },
      { id: "MYPCARDS", name: "MYP Cards", enabled: env.MYP_ENABLED }
    ]
  });
});
