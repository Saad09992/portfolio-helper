import { formatCurrency, formatPercent } from "../utils";

export function ActionRow({
  item,
  kind,
  total,
}: {
  item: {
    id: string;
    key: string;
    mode: "sector" | "ticker";
    gapValue: number;
    drift: number;
    targetWeight: number;
    currentWeight: number;
    price: number;
    shares: number;
  };
  kind: "buy" | "sell";
  total: number;
}) {
  const impact = total > 0 ? (Math.abs(item.gapValue) / total) * 100 : 0;
  return (
    <div className={`action-row action-row--${kind}`}>
      <div className="action-row-main">
        <strong>{item.key}</strong>
        <span className="action-row-mode">{item.mode}</span>
        <span className="action-row-amount num">{formatCurrency(Math.abs(item.gapValue))}</span>
      </div>
      <div className="action-row-detail">
        <span className="num">
          {formatPercent(item.currentWeight)} → {formatPercent(item.targetWeight)}
        </span>
        {item.mode === "ticker" && item.shares > 0 && (
          <span className="num">~{item.shares.toFixed(0)} sh @ {formatCurrency(item.price)}</span>
        )}
        <span className="action-row-impact num">{impact.toFixed(1)}% of book</span>
      </div>
    </div>
  );
}
