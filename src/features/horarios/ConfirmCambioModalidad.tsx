import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';

export type Decision = 'mantener' | 'cancelar';

/** Regla 8: hay turnos reservados en un día que deja de admitir turnos. */
export function ConfirmCambioModalidad({
  cantidad, descripcion, onDecidir, onVolver,
}: {
  cantidad: number;
  descripcion: string;
  onDecidir: (d: Decision) => void;
  onVolver: () => void;
}) {
  return (
    <Dialog open={cantidad > 0} onClose={onVolver} title="Hay turnos reservados">
      <p className="text-sm text-mute">
        {descripcion} ya {cantidad === 1 ? 'tiene 1 turno reservado' : `tiene ${cantidad} turnos reservados`}. ¿Qué querés hacer?
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Button onClick={() => onDecidir('mantener')}>Mantener los turnos</Button>
        <Button variante="danger" onClick={() => onDecidir('cancelar')}>
          Cancelarlos y avisar a los clientes
        </Button>
        <Button variante="ghost" onClick={onVolver}>
          Volver sin cambiar
        </Button>
      </div>
    </Dialog>
  );
}
