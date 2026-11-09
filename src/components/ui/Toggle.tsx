/** Interruptor accesible (role="switch"). */
export function Toggle({ checked, onChange, label, descripcion, disabled, compacto }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  descripcion?: string;
  disabled?: boolean;
  /** Solo el interruptor, sin texto visible (el label queda como nombre accesible). */
  compacto?: boolean;
}) {
  const boton = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${checked ? 'bg-brand' : 'bg-line'}`}
    >
      <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow transition-all ${checked ? 'left-[1.375rem]' : 'left-0.5'}`} />
    </button>
  );
  if (compacto) return boton;
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="font-semibold">{label}</p>
        {descripcion && <p className="text-sm text-mute">{descripcion}</p>}
      </div>
      {boton}
    </div>
  );
}
