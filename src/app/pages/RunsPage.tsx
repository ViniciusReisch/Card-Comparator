import { format } from "date-fns";
import { useEffect, useState } from "react";
import { apiClient, type RunsResponse } from "../api/client";

export function RunsPage() {
  const [data, setData] = useState<RunsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setError(null);
        const response = await apiClient.getRuns();
        setData(response);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Falha ao carregar execucoes.");
      }
    })();
  }, []);

  return (
    <section className="stack">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Historico</p>
            <h3>Execucoes do monitor</h3>
          </div>
        </div>

        {error ? <div className="notice notice-error">{error}</div> : null}

        {!data ? (
          <div className="notice">Carregando execucoes...</div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Status</th>
                  <th>Cards</th>
                  <th>Ofertas</th>
                  <th>Novas</th>
                  <th>Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((run) => (
                  <tr key={run.id}>
                    <td>{format(new Date(run.startedAt), "dd/MM/yyyy HH:mm")}</td>
                    <td>{run.status}</td>
                    <td>{run.totalCardsFound}</td>
                    <td>{run.totalOffersFound}</td>
                    <td>{run.newOffersFound}</td>
                    <td className="muted">
                      {run.sources.map((source) => `${source.source}: ${source.status}`).join(" | ")}
                      {run.errorMessage ? ` | ${run.errorMessage}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

