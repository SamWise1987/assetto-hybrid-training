import type { ButtonHTMLAttributes, CSSProperties, InputHTMLAttributes, ReactNode } from "react";

export function Button({ className = "", variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  return <button className={`button button-${variant} ${className}`} {...props} />;
}

export function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`surface ${className}`}>{children}</section>;
}

export function Field({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

/** Barra progressiva per sensazioni / scale numeriche (più comoda dei bottoni). */
export function ScaleControl({
  label,
  value,
  min,
  max,
  onChange,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  lowLabel?: string;
  highLabel?: string;
}) {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <fieldset className="progress-scale">
      <legend>
        <span>{label}</span>
        <strong aria-live="polite">{value}</strong>
      </legend>
      <div className="progress-scale-track">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-label={label}
          onChange={(event) => onChange(Number(event.target.value))}
          style={{ "--scale-pct": `${pct}%` } as CSSProperties}
        />
      </div>
      <div className="progress-scale-ends">
        <span>{lowLabel ?? min}</span>
        <span>{highLabel ?? max}</span>
      </div>
    </fieldset>
  );
}

export function Toggle({ label, checked, onChange, danger = false }: { label: string; checked: boolean; onChange: (value: boolean) => void; danger?: boolean }) {
  return (
    <button type="button" className={`toggle ${checked ? "is-on" : ""} ${danger ? "is-danger" : ""}`} aria-pressed={checked} onClick={() => onChange(!checked)}>
      <span>{label}</span><span aria-hidden="true">{checked ? "Sì" : "No"}</span>
    </button>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><h3>{title}</h3><p>{text}</p></div>;
}
