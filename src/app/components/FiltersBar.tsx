export type FilterValues = {
  newOnly: boolean;
  activeOnly: boolean;
  source: string;
  language: string;
  condition: string;
  minPrice: string;
  maxPrice: string;
  collection: string;
  year: string;
  search: string;
};

export type FiltersBarProps = {
  values: FilterValues;
  onChange: (nextValues: FilterValues) => void;
  onApply: () => void;
  onClear?: () => void;
  showSearch?: boolean;
  showNewOnlyToggle?: boolean;
  showActiveOnlyToggle?: boolean;
};

export function FiltersBar({
  values,
  onChange,
  onApply,
  onClear,
  showSearch = false,
  showNewOnlyToggle = false,
  showActiveOnlyToggle = false
}: FiltersBarProps) {
  function update<K extends keyof FilterValues>(key: K, value: FilterValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="filter-grid" style={{ gap: "0.5rem" }}>
      {(showNewOnlyToggle || showActiveOnlyToggle) ? (
        <div className="filter-toggle-row" style={{ gridColumn: "1 / -1" }}>
          {showNewOnlyToggle ? (
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={values.newOnly}
                onChange={(event) => update("newOnly", event.target.checked)}
              />
              <span>Novos anuncios</span>
            </label>
          ) : null}

          {showActiveOnlyToggle ? (
            <label className="filter-checkbox">
              <input
                type="checkbox"
                checked={values.activeOnly}
                onChange={(event) => update("activeOnly", event.target.checked)}
              />
              <span>Apenas ativos</span>
            </label>
          ) : null}
        </div>
      ) : null}

      {showSearch ? (
        <input
          className="filter-input"
          value={values.search}
          onChange={(event) => update("search", event.target.value)}
          placeholder="Buscar por nome, colecao ou vendedor..."
          style={{ gridColumn: "1 / -1" }}
        />
      ) : null}

      <div className="filter-group">
        <label className="filter-label">Fonte</label>
        <select className="filter-select" value={values.source} onChange={(event) => update("source", event.target.value)}>
          <option value="">Todas</option>
          <option value="LIGA_POKEMON">Liga Pokemon</option>
          <option value="CARDTRADER">CardTrader</option>
          <option value="MYPCARDS">MYP Cards</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Idioma</label>
        <select className="filter-select" value={values.language} onChange={(event) => update("language", event.target.value)}>
          <option value="">Todos</option>
          <option value="PORTUGUESE">PT - Portugues</option>
          <option value="ENGLISH">EN - English</option>
          <option value="JAPANESE">JP - Japanese</option>
          <option value="SPANISH">ES - Spanish</option>
          <option value="FRENCH">FR - French</option>
          <option value="GERMAN">DE - German</option>
          <option value="ITALIAN">IT - Italian</option>
          <option value="KOREAN">KO - Korean</option>
          <option value="CHINESE_SIMPLIFIED">ZH - Chinese Simplified</option>
          <option value="CHINESE_TRADITIONAL">ZH-TW - Chinese Traditional</option>
          <option value="THAI">TH - Thai</option>
          <option value="INDONESIAN">ID - Indonesian</option>
          <option value="RUSSIAN">RU - Russian</option>
          <option value="DUTCH">NL - Dutch</option>
          <option value="UNKNOWN">Desconhecido</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Estado</label>
        <select className="filter-select" value={values.condition} onChange={(event) => update("condition", event.target.value)}>
          <option value="">Todos</option>
          <option value="M">M - Mint</option>
          <option value="NM">NM - Near Mint</option>
          <option value="EX">EX - Excellent</option>
          <option value="SP">SP - Slightly Played</option>
          <option value="MP">MP - Moderately Played</option>
          <option value="PL">PL - Played</option>
          <option value="PO">PO - Poor / Damaged</option>
          <option value="UNKNOWN">Desconhecido</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Preco min. (R$)</label>
        <input
          className="filter-input"
          value={values.minPrice}
          onChange={(event) => update("minPrice", event.target.value)}
          placeholder="0.00"
          type="number"
          min="0"
        />
      </div>

      <div className="filter-group">
        <label className="filter-label">Preco max. (R$)</label>
        <input
          className="filter-input"
          value={values.maxPrice}
          onChange={(event) => update("maxPrice", event.target.value)}
          placeholder="9999.00"
          type="number"
          min="0"
        />
      </div>

      <div className="filter-group">
        <label className="filter-label">Colecao</label>
        <input
          className="filter-input"
          value={values.collection}
          onChange={(event) => update("collection", event.target.value)}
          placeholder="Ex: Deoxys"
        />
      </div>

      <div className="filter-group">
        <label className="filter-label">Ano</label>
        <input
          className="filter-input"
          value={values.year}
          onChange={(event) => update("year", event.target.value)}
          placeholder="Ex: 2024"
          type="number"
        />
      </div>

      <div
        className="filter-group"
        style={{ justifyContent: "flex-end", flexDirection: "row", gap: "0.4rem", alignItems: "flex-end" }}
      >
        <button className="btn btn-primary btn-sm" onClick={onApply}>
          Filtrar
        </button>
        {onClear ? (
          <button className="btn btn-ghost btn-sm" onClick={onClear}>
            Limpar
          </button>
        ) : null}
      </div>
    </div>
  );
}
