import { useEffect, useRef, useState } from "react";
import { apiUrl } from "../services/api-url";

type PsxStock = { ticker: string; name: string; sector: string };

export function StockSearch({
  onSelect,
  selected,
  onClear,
}: {
  onSelect: (stock: PsxStock) => void;
  selected: string;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [stocks, setStocks] = useState<PsxStock[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    fetch(apiUrl("/api/psx/stocks"))
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setStocks(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const q = query.toUpperCase();
  const filtered = query.length > 0
    ? stocks
        .filter(
          (s) =>
            s.ticker.includes(q) ||
            s.name.toUpperCase().includes(q),
        )
        .slice(0, 8)
    : [];

  if (selected) {
    return (
      <label className="field stock-search-field">
        <span>Stock</span>
        <div className="stock-selected">
          <span>{selected}</span>
          <button type="button" className="stock-clear" onClick={onClear}>
            &times;
          </button>
        </div>
      </label>
    );
  }

  return (
    <label className="field stock-search-field" ref={wrapRef}>
      <span>Search stock</span>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => query.length > 0 && setOpen(true)}
        placeholder="Type ticker or company name..."
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="stock-dropdown">
          {filtered.map((s) => (
            <button
              key={s.ticker}
              type="button"
              className="stock-option"
              onClick={() => {
                onSelect(s);
                setQuery("");
                setOpen(false);
              }}
            >
              <strong>{s.ticker}</strong>
              <span>{s.name}</span>
              <small>{s.sector}</small>
            </button>
          ))}
        </div>
      )}
    </label>
  );
}
