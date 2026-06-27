import { useEffect, useRef, useState } from "react";
import { searchCoins, type CoinResult } from "../services/crypto";

export function CryptoSearch({
  onSelect,
  selected,
  onClear,
}: {
  onSelect: (coin: CoinResult) => void;
  selected: string;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CoinResult[]>([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLLabelElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      searchCoins(q)
        .then((coins) => {
          if (!cancelled) setResults(coins);
        })
        .catch(() => {});
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (selected) {
    return (
      <label className="field stock-search-field">
        <span>Coin</span>
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
      <span>Search coin</span>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => query.length > 0 && setOpen(true)}
        placeholder="Type a coin name or symbol..."
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <div className="stock-dropdown">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              className="stock-option"
              onClick={() => {
                onSelect(c);
                setQuery("");
                setOpen(false);
              }}
            >
              <strong>{c.symbol}</strong>
              <span>{c.name}</span>
              <small>crypto</small>
            </button>
          ))}
        </div>
      )}
    </label>
  );
}
