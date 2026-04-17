type FilterValues = {
  source: string;
  language: string;
  condition: string;
  minPrice: string;
  maxPrice: string;
  collection: string;
  year: string;
};

type FiltersBarProps = {
  values: FilterValues;
  onChange: (nextValues: FilterValues) => void;
  onApply: () => void;
};

export function FiltersBar({ values, onChange, onApply }: FiltersBarProps) {
  function update<K extends keyof FilterValues>(key: K, value: FilterValues[K]) {
    onChange({
      ...values,
      [key]: value
    });
  }

  return (
    <div className="filter-grid">
      <select value={values.source} onChange={(event) => update("source", event.target.value)}>
        <option value="">Todas as fontes</option>
        <option value="LIGA_POKEMON">Liga Pokemon</option>
        <option value="CARDTRADER">CardTrader</option>
      </select>

      <select value={values.language} onChange={(event) => update("language", event.target.value)}>
        <option value="">Todos os idiomas</option>
        <option value="PORTUGUESE">Portuguese</option>
        <option value="ENGLISH">English</option>
        <option value="JAPANESE">Japanese</option>
        <option value="SPANISH">Spanish</option>
        <option value="ITALIAN">Italian</option>
        <option value="FRENCH">French</option>
        <option value="GERMAN">German</option>
      </select>

      <select value={values.condition} onChange={(event) => update("condition", event.target.value)}>
        <option value="">Todos os estados</option>
        <option value="MINT">Mint</option>
        <option value="NEAR_MINT">Near Mint</option>
        <option value="EXCELLENT">Excellent</option>
        <option value="SLIGHTLY_PLAYED">Slightly Played</option>
        <option value="MODERATELY_PLAYED">Moderately Played</option>
        <option value="PLAYED">Played</option>
        <option value="HEAVILY_PLAYED">Heavily Played</option>
        <option value="POOR">Poor</option>
        <option value="DAMAGED">Damaged</option>
      </select>

      <input
        value={values.minPrice}
        onChange={(event) => update("minPrice", event.target.value)}
        placeholder="Preco minimo"
      />
      <input
        value={values.maxPrice}
        onChange={(event) => update("maxPrice", event.target.value)}
        placeholder="Preco maximo"
      />
      <input
        value={values.collection}
        onChange={(event) => update("collection", event.target.value)}
        placeholder="Colecao"
      />
      <input value={values.year} onChange={(event) => update("year", event.target.value)} placeholder="Ano" />
      <button className="secondary-button" onClick={onApply}>
        Aplicar filtros
      </button>
    </div>
  );
}

