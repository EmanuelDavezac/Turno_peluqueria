import type { ButtonHTMLAttributes } from 'react';

type Variante = 'primary' | 'ghost' | 'danger';
const V: Record<Variante, string> = {
  primary: 'bg-brand text-brand-ink hover:opacity-90',
  ghost: 'border border-line bg-surface text-ink hover:bg-sunken',
  danger: 'bg-red-700 text-white hover:bg-red-800',
};

export function Button({ variante = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type="button"
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${V[variante]} ${className}`}
    />
  );
}
