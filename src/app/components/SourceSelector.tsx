interface Source {
  id: string;
  name: string;
  enabled: boolean;
}

interface SourceSelectorProps {
  sources: Source[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

export function SourceSelector({ sources, selected, onChange, disabled }: SourceSelectorProps) {
  const enabledSources = sources.filter((s) => s.enabled);

  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  function selectAll() {
    onChange(enabledSources.map((s) => s.id));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        {enabledSources.map((source) => {
          const isChecked = selected.includes(source.id);
          return (
            <label
              key={source.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                cursor: disabled ? "not-allowed" : "pointer",
                fontSize: "0.85rem",
                color: "var(--text-secondary)",
                opacity: disabled ? 0.6 : 1
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(source.id)}
                disabled={disabled}
                style={{ accentColor: "var(--accent)", cursor: disabled ? "not-allowed" : "pointer" }}
              />
              {source.name}
            </label>
          );
        })}
        <button
          className="btn btn-ghost btn-xs"
          type="button"
          onClick={selectAll}
          disabled={disabled || selected.length === enabledSources.length}
        >
          Todas
        </button>
        <button
          className="btn btn-ghost btn-xs"
          type="button"
          onClick={clearAll}
          disabled={disabled || selected.length === 0}
        >
          Limpar
        </button>
      </div>
      {selected.length === 0 && (
        <p className="muted" style={{ fontSize: "0.78rem", margin: 0 }}>
          Selecione pelo menos uma loja para monitorar.
        </p>
      )}
    </div>
  );
}
