import { useEffect, useState } from 'react';

/** Texto obligatorio: confirma mientras escribís solo si no está vacío; al salir, un campo vacío vuelve al valor anterior. */
export function TextoInput({ value, onCommit, label, maxLength, className = '' }: {
  value: string;
  onCommit: (v: string) => void;
  label: string;
  maxLength?: number;
  className?: string;
}) {
  const [texto, setTexto] = useState(value);
  useEffect(() => setTexto(value), [value]);
  const vacio = texto.trim() === '';

  return (
    <label className={`block ${className}`}>
      <input
        type="text"
        value={texto}
        aria-invalid={vacio}
        aria-label={label}
        maxLength={maxLength}
        onChange={(e) => {
          setTexto(e.target.value);
          if (e.target.value.trim()) onCommit(e.target.value);
        }}
        onBlur={() => vacio && setTexto(value)}
        className={`w-full rounded-lg border bg-surface px-3 py-2 text-base ${vacio ? 'border-red-500' : 'border-line'}`}
      />
    </label>
  );
}
