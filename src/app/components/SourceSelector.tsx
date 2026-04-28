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
    <div className="source-selector">
      <div className="source-selector-row">
        {enabledSources.map((source) => {
          const isChecked = selected.includes(source.id);
          return (
            <label
              key={source.id}
              className={`source-choice${isChecked ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(source.id)}
                disabled={disabled}
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
        <p className="source-selector-warning">
          Selecione pelo menos uma loja para monitorar.
        </p>
      )}
    </div>
  );
}
