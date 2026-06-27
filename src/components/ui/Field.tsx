export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
  max,
  step,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  min?: number;
  max?: number;
  step?: string;
}) {
  const numeric = type === "number";
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        min={min}
        max={max}
        step={step}
        value={value}
        placeholder={placeholder}
        className={numeric ? "num" : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
