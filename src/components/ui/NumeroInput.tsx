import { useEffect, useState } from 'react';

/**
 * Input numérico que no pelea con el tipeo: guarda el texto mientras escribís y
 * solo confirma el valor cuando es un número válido dentro de [min, max].
 */
export function NumeroInput({ value, onCommit, min = 0, max, label, sufijo, className = '' }: {
  value: number;
  onCommit: (n: number) => void;
  min?: number;
  max?: number;
  label: string;
  sufijo?: string;
  className?: string;
}) {
  const [texto, setTexto] = useState(String(value));
  useEffect(() => setTexto(String(value)), [value]);

  const n = Number(texto);
  const valido = texto.trim() !== '' && Number.isFinite(n) && n >= min && (max === undefined || n <= max);

  return (
    <label className={`relative block ${className}`}>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={texto}
        aria-invalid={!valido}
        aria-label={label}
        onChange={(e) => {
          setTexto(e.target.value);
          const v = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(v) && v >= min && (max === undefined || v <= max)) onCommit(v);
        }}
        onBlur={() => !valido && setTexto(String(value))}
        className={`w-full rounded-lg border bg-surface px-3 py-2 text-base tabular-nums ${valido ? 'border-line' : 'border-red-500'} ${sufijo ? 'pr-9' : ''}`}
      />
      {sufijo && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-mute">{sufijo}</span>}
    </label>
  );
}
