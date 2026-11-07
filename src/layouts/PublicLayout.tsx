import { Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { useStore } from '@/data/local/store';

export function PublicLayout({ children }: { children: ReactNode }) {
  const { tema, setTema } = useStore();
  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-4">
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            aria-label="Cambiar tema"
            onClick={() => setTema(tema === 'claro' ? 'oscuro' : 'claro')}
            className="rounded-lg p-2 text-mute hover:bg-sunken"
          >
            {tema === 'claro' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
