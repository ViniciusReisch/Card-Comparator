import { format } from "date-fns";
import type { OfferItem } from "../api/client";
import { ConditionBadge } from "./ConditionBadge";
import { LanguageBadge } from "./LanguageBadge";
import { NewOfferBadge } from "./NewOfferBadge";

type OfferTableProps = {
  title: string;
  offers: OfferItem[];
};

export function OfferTable({ title, offers }: OfferTableProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Fonte</p>
          <h3>{title}</h3>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Preco</th>
              <th>Idioma</th>
              <th>Estado</th>
              <th>Loja / vendedor</th>
              <th>Pais</th>
              <th>Primeira aparicao</th>
              <th>Ultima visualizacao</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => (
              <tr key={offer.id}>
                <td>
                  <strong>{(offer.priceCents / 100).toFixed(2)} {offer.currency}</strong>
                </td>
                <td><LanguageBadge value={offer.languageNormalized} /></td>
                <td>
                  <div className="badge-row">
                    <ConditionBadge value={offer.conditionNormalized} />
                    {offer.isNew ? <NewOfferBadge /> : null}
                  </div>
                </td>
                <td>{offer.storeName ?? offer.sellerName ?? "Nao informado"}</td>
                <td>{offer.sellerCountry ?? "Nao informado"}</td>
                <td>{format(new Date(offer.firstSeenAt), "dd/MM/yyyy HH:mm")}</td>
                <td>{format(new Date(offer.lastSeenAt), "dd/MM/yyyy HH:mm")}</td>
                <td>
                  {offer.offerUrl ? (
                    <a href={offer.offerUrl} target="_blank" rel="noreferrer" className="table-link">
                      Abrir
                    </a>
                  ) : (
                    <span className="muted">n/d</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

