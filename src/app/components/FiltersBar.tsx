export type FilterValues = {
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
};

export function FiltersBar({ values, onChange, onApply, onClear, showSearch = false }: FiltersBarProps) {
  function update<K extends keyof FilterValues>(key: K, value: FilterValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <div className="filter-grid" style={{ gap: "0.5rem" }}>
      {showSearch && (
        <input
          className="filter-input"
          value={values.search ?? ""}
          onChange={(e) => update("search", e.target.value)}
          placeholder="Buscar por nome, coleção, vendedor..."
          style={{ gridColumn: "1 / -1" }}
        />
      )}

      <div className="filter-group">
        <label className="filter-label">Fonte</label>
        <select className="filter-select" value={values.source} onChange={(e) => update("source", e.target.value)}>
          <option value="">Todas</option>
          <option value="LIGA_POKEMON">Liga Pokémon</option>
          <option value="CARDTRADER">CardTrader</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Idioma</label>
        <select className="filter-select" value={values.language} onChange={(e) => update("language", e.target.value)}>
          <option value="">Todos</option>
          <option value="PORTUGUESE">🇧🇷 Português</option>
          <option value="ENGLISH">🇺🇸 English</option>
          <option value="JAPANESE">🇯🇵 Japonês</option>
          <option value="SPANISH">🇪🇸 Español</option>
          <option value="FRENCH">🇫🇷 Français</option>
          <option value="GERMAN">🇩🇪 Deutsch</option>
          <option value="ITALIAN">🇮🇹 Italiano</option>
          <option value="KOREAN">🇰🇷 Coreano</option>
          <option value="CHINESE_SIMPLIFIED">🇨🇳 Chinês Simpl.</option>
          <option value="CHINESE_TRADITIONAL">🇹🇼 Chinês Trad.</option>
          <option value="THAI">🇹🇭 Tailandês</option>
          <option value="INDONESIAN">🇮🇩 Indonésio</option>
          <option value="RUSSIAN">🇷🇺 Russo</option>
          <option value="DUTCH">🇳🇱 Holandês</option>
          <option value="UNKNOWN">🌐 Desconhecido</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Estado</label>
        <select className="filter-select" value={values.condition} onChange={(e) => update("condition", e.target.value)}>
          <option value="">Todos</option>
          <option value="M">M — Mint</option>
          <option value="NM">NM — Near Mint</option>
          <option value="EX">EX — Excellent</option>
          <option value="SP">SP — Slightly Played</option>
          <option value="MP">MP — Moderately Played</option>
          <option value="PL">PL — Played</option>
          <option value="PO">PO — Poor/Damaged</option>
          <option value="UNKNOWN">? — Desconhecido</option>
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label">Preço mín. (R$)</label>
        <input
          className="filter-input"
          value={values.minPrice}
          onChange={(e) => update("minPrice", e.target.value)}
          placeholder="0,00"
          type="number"
          min="0"
        />
      </div>

      <div className="filter-group">
        <label className="filter-label">Preço máx. (R$)</label>
        <input
          className="filter-input"
          value={values.maxPrice}
          onChange={(e) => update("maxPrice", e.target.value)}
          placeholder="9999,00"
          type="number"
          min="0"
        />
      </div>

      <div className="filter-group">
        <label className="filter-label">Coleção</label>
        <input
          className="filter-input"
          value={values.collection}
          onChange={(e) => update("collection", e.target.value)}
          placeholder="Ex: Base Set"
        />
      </div>

      <div className="filter-group">
        <label className="filter-label">Ano</label>
        <input
          className="filter-input"
          value={values.year}
          onChange={(e) => update("year", e.target.value)}
          placeholder="Ex: 2024"
          type="number"
        />
      </div>

      <div className="filter-group" style={{ justifyContent: "flex-end", flexDirection: "row", gap: "0.4rem", alignItems: "flex-end" }}>
        <button className="btn btn-primary btn-sm" onClick={onApply}>
          Filtrar
        </button>
        {onClear && (
          <button className="btn btn-ghost btn-sm" onClick={onClear}>
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}
