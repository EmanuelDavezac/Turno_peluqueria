interface Opcion<T extends string> { value: T; label: string; activeClass?: string }

export function Segmented<T extends string>({
  value, onChange, opciones, label,
}: { value: T; onChange: (v: T) => void; opciones: Opcion<T>[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-sunken p-1">
      {opciones.map((o) => {
        const activo = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onChange(o.value)}
            className={`rounded-lg px-2 py-2 text-sm font-semibold transition-colors ${
              activo ? (o.activeClass ?? 'bg-brand text-brand-ink') + ' shadow-sm' : 'text-mute hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
