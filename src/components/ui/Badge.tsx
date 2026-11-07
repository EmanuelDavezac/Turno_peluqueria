import { MODALIDAD_CLASES, MODALIDAD_LABEL } from '@/domain/modalidad';
import type { Modalidad } from '@/domain/types';

export function ModalidadBadge({ modalidad, className = '' }: { modalidad: Modalidad; className?: string }) {
  const c = MODALIDAD_CLASES[modalidad];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.badge} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {MODALIDAD_LABEL[modalidad]}
    </span>
  );
}
