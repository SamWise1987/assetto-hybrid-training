import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

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

export function ScaleControl({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <fieldset className="scale-control">
      <legend>{label}</legend>
      <div>
        {Array.from({ length: max - min + 1 }, (_, index) => index + min).map((option) => (
          <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)}>{option}</button>
        ))}
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
