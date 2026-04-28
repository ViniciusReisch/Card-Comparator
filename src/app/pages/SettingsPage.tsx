import { useEffect, useMemo, useState } from "react";
import {
  apiClient,
  type AppSettingsResponse,
  type AppSettingsUpdate
} from "../api/client";
import {
  BROWSER_NOTIFICATIONS_STORAGE_KEY,
  WEB_PUSH_SUBSCRIBED_KEY,
  registerWebPush,
  unregisterWebPush
} from "../components/BrowserNotificationBridge";

type BrowserPermission = "unsupported" | NotificationPermission;

function getBrowserPermission(): BrowserPermission {
  if (!("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

function permissionLabel(permission: BrowserPermission): string {
  if (permission === "granted") return "permitida";
  if (permission === "denied") return "bloqueada";
  if (permission === "default") return "pendente";
  return "indisponivel";
}

function emptySettings(): AppSettingsResponse {
  return {
    monitor: {
      intervalMinutes: 10,
      schedulerEnabled: true
    },
    notifications: {
      ntfy: {
        enabled: false,
        baseUrl: "https://ntfy.sh",
        topic: "",
        priority: "default"
      },
      telegram: {
        enabled: false,
        botTokenConfigured: false,
        chatId: ""
      }
    }
  };
}

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettingsResponse>(emptySettings());
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [browserPermission, setBrowserPermission] = useState<BrowserPermission>(() => getBrowserPermission());
  const [browserEnabled, setBrowserEnabled] = useState(() => {
    return window.localStorage.getItem(BROWSER_NOTIFICATIONS_STORAGE_KEY) === "true";
  });
  const [webPushSubscribed, setWebPushSubscribed] = useState(() =>
    window.localStorage.getItem(WEB_PUSH_SUBSCRIBED_KEY) === "true"
  );
  const [webPushLoading, setWebPushLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Array<{ provider: string; status: string; message: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadSettings() {
    try {
      setLoading(true);
      setError(null);
      setSettings(await apiClient.getSettings());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao carregar ajustes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  const canSave = useMemo(() => {
    return settings.monitor.intervalMinutes >= 1 && settings.monitor.intervalMinutes <= 1440;
  }, [settings.monitor.intervalMinutes]);

  function updateDraft(input: AppSettingsUpdate) {
    setSettings((current) => ({
      monitor: {
        ...current.monitor,
        ...(input.monitor ?? {})
      },
      notifications: {
        ntfy: {
          ...current.notifications.ntfy,
          ...(input.notifications?.ntfy ?? {})
        },
        telegram: {
          ...current.notifications.telegram,
          ...(input.notifications?.telegram
            ? {
                enabled: input.notifications.telegram.enabled ?? current.notifications.telegram.enabled,
                chatId: input.notifications.telegram.chatId ?? current.notifications.telegram.chatId,
                botTokenConfigured: current.notifications.telegram.botTokenConfigured
              }
            : {})
        }
      }
    }));
  }

  async function handleSave() {
    const payload: AppSettingsUpdate = {
      monitor: settings.monitor,
      notifications: {
        ntfy: settings.notifications.ntfy,
        telegram: {
          enabled: settings.notifications.telegram.enabled,
          chatId: settings.notifications.telegram.chatId,
          ...(telegramBotToken.trim() ? { botToken: telegramBotToken.trim() } : {})
        }
      }
    };

    try {
      setSaving(true);
      setMessage(null);
      setError(null);
      const saved = await apiClient.updateSettings(payload);
      setSettings(saved);
      setTelegramBotToken("");
      setMessage("Ajustes salvos.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao salvar ajustes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTestNotifications() {
    try {
      setTesting(true);
      setMessage(null);
      setTestResults(null);
      setError(null);
      const response = await apiClient.testNotifications();
      const sent = response.results.filter((result) => result.status === "sent").length;
      const failed = response.results.filter((result) => result.status === "failed").length;
      setMessage(`${sent} enviada(s), ${failed} falha(s).`);
      setTestResults(response.results);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Falha ao testar notificacoes.");
    } finally {
      setTesting(false);
    }
  }

  async function handleBrowserPermission() {
    if (!("Notification" in window)) {
      setBrowserPermission("unsupported");
      setError("Este navegador nao suporta notificacoes.");
      return;
    }

    if (!window.isSecureContext) {
      setError("Permissao de notificacao do navegador exige localhost ou HTTPS.");
      return;
    }

    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);
    const enabled = permission === "granted";
    setBrowserEnabled(enabled);
    window.localStorage.setItem(BROWSER_NOTIFICATIONS_STORAGE_KEY, String(enabled));

    if (enabled) {
      new Notification("Rayquaza Monitor", {
        body: "Notificacoes do navegador ativadas.",
        icon: "/notification-icon-192.png"
      });
    }
  }

  async function handleBrowserToggle(enabled: boolean) {
    if (!enabled) {
      setBrowserEnabled(false);
      window.localStorage.setItem(BROWSER_NOTIFICATIONS_STORAGE_KEY, "false");
      return;
    }

    if (!("Notification" in window)) {
      setBrowserPermission("unsupported");
      setBrowserEnabled(false);
      setError("Este navegador nao suporta notificacoes.");
      return;
    }

    if (!window.isSecureContext) {
      setBrowserEnabled(false);
      setError("Abra por localhost ou pelo link HTTPS do Cloudflare para ativar notificacoes.");
      return;
    }

    const permission =
      browserPermission === "granted" ? browserPermission : await Notification.requestPermission();
    setBrowserPermission(permission);

    if (permission !== "granted") {
      setBrowserEnabled(false);
      window.localStorage.setItem(BROWSER_NOTIFICATIONS_STORAGE_KEY, "false");
      setError(
        permission === "denied"
          ? "A permissao foi bloqueada no navegador. Libere nas configuracoes do site."
          : "Permissao de notificacao ainda pendente."
      );
      return;
    }

    setError(null);
    setBrowserEnabled(true);
    window.localStorage.setItem(BROWSER_NOTIFICATIONS_STORAGE_KEY, "true");
    new Notification("Rayquaza Monitor", {
      body: "Notificacoes do navegador ativadas.",
      icon: "/notification-icon-192.png"
    });
  }

  async function handleWebPushToggle(enable: boolean) {
    setWebPushLoading(true);
    setError(null);

    if (!enable) {
      await unregisterWebPush();
      setWebPushSubscribed(false);
      setWebPushLoading(false);
      return;
    }

    const result = await registerWebPush();

    if (result === "subscribed") {
      setWebPushSubscribed(true);
      setMessage("Push ativado. Voce recebera notificacoes mesmo com o navegador fechado.");
    } else if (result === "permission-denied") {
      setError("Permissao de notificacao bloqueada. Libere nas configuracoes do site.");
    } else if (result === "unsupported") {
      setError("Este navegador ou contexto nao suporta Web Push. Abra via localhost ou HTTPS.");
    } else {
      setError("Falha ao registrar push. Tente novamente.");
    }

    setWebPushLoading(false);
  }

  return (
    <section className="stack">
      <div className="topbar">
        <h2 className="topbar-title">Ajustes</h2>
        <p className="topbar-sub">Monitoramento e notificacoes.</p>
      </div>

      <div className="page-content">
        <div className="settings-layout">
          {error ? <div className="notice notice-error">{error}</div> : null}
          {message ? <div className="notice">{message}</div> : null}
          {loading ? <div className="notice">Carregando ajustes...</div> : null}

          <section className="panel settings-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Monitoramento</div>
                <div className="panel-sub">Intervalo atual: {settings.monitor.intervalMinutes} min</div>
              </div>
            </div>

            <div className="settings-grid">
              <label className="field">
                <span>Intervalo em minutos</span>
                <input
                  className="filter-input"
                  type="number"
                  min={1}
                  max={1440}
                  value={settings.monitor.intervalMinutes}
                  onChange={(event) =>
                    updateDraft({
                      monitor: {
                        intervalMinutes: Number(event.target.value)
                      }
                    })
                  }
                />
              </label>

              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={settings.monitor.schedulerEnabled}
                  onChange={(event) =>
                    updateDraft({
                      monitor: {
                        schedulerEnabled: event.target.checked
                      }
                    })
                  }
                />
                <span>Agendador ativo</span>
              </label>
            </div>
          </section>

          <section className="panel settings-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">ntfy</div>
                <div className="panel-sub">{settings.notifications.ntfy.enabled ? "habilitado" : "desabilitado"}</div>
              </div>
            </div>

            <div className="settings-grid">
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={settings.notifications.ntfy.enabled}
                  onChange={(event) =>
                    updateDraft({
                      notifications: {
                        ntfy: {
                          enabled: event.target.checked
                        }
                      }
                    })
                  }
                />
                <span>Enviar por ntfy</span>
              </label>

              <label className="field">
                <span>Topico</span>
                <input
                  className="filter-input"
                  value={settings.notifications.ntfy.topic}
                  onChange={(event) =>
                    updateDraft({
                      notifications: {
                        ntfy: {
                          topic: event.target.value
                        }
                      }
                    })
                  }
                />
              </label>

              <label className="field">
                <span>Servidor</span>
                <input
                  className="filter-input"
                  value={settings.notifications.ntfy.baseUrl}
                  onChange={(event) =>
                    updateDraft({
                      notifications: {
                        ntfy: {
                          baseUrl: event.target.value
                        }
                      }
                    })
                  }
                />
              </label>

              <label className="field">
                <span>Prioridade</span>
                <select
                  className="filter-select"
                  value={settings.notifications.ntfy.priority}
                  onChange={(event) =>
                    updateDraft({
                      notifications: {
                        ntfy: {
                          priority: event.target.value
                        }
                      }
                    })
                  }
                >
                  <option value="min">min</option>
                  <option value="low">low</option>
                  <option value="default">default</option>
                  <option value="high">high</option>
                  <option value="urgent">urgent</option>
                </select>
              </label>
            </div>
          </section>

          <section className="panel settings-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Telegram</div>
                <div className="panel-sub">{settings.notifications.telegram.enabled ? "habilitado" : "desabilitado"}</div>
              </div>
            </div>

            <div className="settings-grid">
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={settings.notifications.telegram.enabled}
                  onChange={(event) =>
                    updateDraft({
                      notifications: {
                        telegram: {
                          enabled: event.target.checked
                        }
                      }
                    })
                  }
                />
                <span>Enviar por Telegram</span>
              </label>

              <label className="field">
                <span>Bot token</span>
                <input
                  className="filter-input"
                  type="password"
                  value={telegramBotToken}
                  placeholder={settings.notifications.telegram.botTokenConfigured ? "token salvo" : ""}
                  onChange={(event) => setTelegramBotToken(event.target.value)}
                />
              </label>

              <label className="field">
                <span>Chat ID</span>
                <input
                  className="filter-input"
                  value={settings.notifications.telegram.chatId}
                  onChange={(event) =>
                    updateDraft({
                      notifications: {
                        telegram: {
                          chatId: event.target.value
                        }
                      }
                    })
                  }
                />
              </label>
            </div>
          </section>

          <section className="panel settings-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Push do navegador</div>
                <div className="panel-sub">
                  {webPushSubscribed ? "ativo — funciona mesmo com o navegador fechado" : "inativo"}
                </div>
              </div>
            </div>

            <div className="settings-grid">
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={webPushSubscribed}
                  disabled={webPushLoading}
                  onChange={(event) => { void handleWebPushToggle(event.target.checked); }}
                />
                <span>Ativar notificacoes push</span>
              </label>
              <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>
                Requer HTTPS ou localhost. Funciona com Chrome/Edge/Firefox. No Windows, o Chrome precisa estar aberto (pode estar minimizado).
              </p>
            </div>
          </section>

          <section className="panel settings-panel">
            <div className="panel-header">
              <div>
                <div className="panel-title">Navegador (aba aberta)</div>
                <div className="panel-sub">Permissao: {permissionLabel(browserPermission)}</div>
              </div>
            </div>

            <div className="settings-grid">
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={browserEnabled}
                  disabled={browserPermission === "unsupported"}
                  onChange={(event) => { void handleBrowserToggle(event.target.checked); }}
                />
                <span>Notificar quando a aba estiver aberta</span>
              </label>

              <button className="btn btn-secondary" type="button" onClick={handleBrowserPermission}>
                Pedir permissao
              </button>
            </div>
          </section>

          <div className="settings-actions">
            <button className="btn btn-primary" type="button" onClick={handleSave} disabled={saving || !canSave}>
              {saving ? "Salvando..." : "Salvar ajustes"}
            </button>
            <button className="btn btn-secondary" type="button" onClick={handleTestNotifications} disabled={testing}>
              {testing ? "Testando..." : "Enviar teste"}
            </button>
          </div>

          {testResults ? (
            <section className="panel settings-panel">
              <div className="panel-header">
                <div className="panel-title">Resultado do teste</div>
              </div>
              <ul style={{ listStyle: "none", padding: "0.75rem 1.25rem", margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {testResults.map((result) => (
                  <li key={result.provider} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", fontSize: "0.875rem" }}>
                    <span style={{
                      fontWeight: 700,
                      color: result.status === "sent" ? "var(--color-success, #16a34a)" : result.status === "failed" ? "var(--color-error, #dc2626)" : "var(--text-secondary)"
                    }}>
                      {result.status === "sent" ? "✓" : result.status === "failed" ? "✗" : "—"}
                    </span>
                    <span>
                      <strong>{result.provider}</strong>
                      {": "}
                      <span style={{ color: "var(--text-secondary)" }}>{result.message}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}
