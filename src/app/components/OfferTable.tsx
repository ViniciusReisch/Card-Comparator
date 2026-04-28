import { format } from "date-fns";
import type { OfferItem } from "../api/client";
import { formatBrl, formatOriginalPrice } from "../api/client";
import { ConditionBadge } from "./ConditionBadge";
import { FinishBadges } from "./FinishBadges";
import { LanguageBadge } from "./LanguageBadge";
import { NewOfferBadge } from "./NewOfferBadge";

type OfferTableProps = {
  title: string;
  offers: OfferItem[];
};

export function OfferTable({ title, offers }: OfferTableProps) {
  return (
    <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <div className="panel-header" style={{ padding: "1rem 1.25rem" }}>
        <div className="panel-title">{title}</div>
        <span className="muted" style={{ fontSize: "0.8rem" }}>
          {offers.length} oferta{offers.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Preco (BRL)</th>
              <th>Idioma</th>
              <th>Estado</th>
              <th>Extra</th>
              <th>Vendedor / Loja</th>
              <th>Primeira aparicao</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => {
              const brl = formatBrl(offer.priceBrlCents ?? (offer.currency === "BRL" ? offer.priceCents : null));
              const original = formatOriginalPrice(offer.priceCents, offer.currency);

              return (
                <tr key={offer.id}>
                  <td>
                    <span className="price-brl">{brl}</span>
                    {original ? <span className="price-original">{original}</span> : null}
                  </td>
                  <td>
                    <LanguageBadge value={offer.languageNormalized} />
                  </td>
                  <td>
                    <div className="badge-row">
                      <ConditionBadge value={offer.conditionNormalized} />
                      {offer.isNew ? <NewOfferBadge /> : null}
                      {!offer.isActive ? <span className="badge badge-sold">Vendido</span> : null}
                    </div>
                  </td>
                  <td>
                    <FinishBadges tags={offer.finishTags} raw={offer.finishRaw} />
                  </td>
                  <td style={{ fontSize: "0.85rem" }}>
                    {offer.storeName ?? offer.sellerName ?? <span className="muted">-</span>}
                  </td>
                  <td style={{ fontSize: "0.78rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
                    {format(new Date(offer.firstSeenAt), "dd/MM/yyyy HH:mm")}
                  </td>
                  <td>
                    {offer.offerUrl ? (
                      <a href={offer.offerUrl} target="_blank" rel="noreferrer" className="table-link">
                        Abrir
                      </a>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
