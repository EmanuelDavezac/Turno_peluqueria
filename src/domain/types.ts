export type Modalidad = 'turnos' | 'llegada' | 'mixto' | 'cerrado';
export type Franja = { desde: string; hasta: string }; // "09:00"
export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = domingo (date-fns)

export interface ConfigDia { dia: DiaSemana; modalidad: Modalidad; franjas: Franja[] }
export interface Excepcion { id: string; fecha: string; modalidad: Modalidad; franjas: Franja[]; motivo?: string }

export interface Profesional { id: string; nombre: string; color: string; comisionPct: number; activo: boolean }
export interface Servicio { id: string; nombre: string; duracionMin: number; precio: number }
export interface Cliente { id: string; nombre: string; whatsapp: string; notas?: string }

export interface Turno {
  id: string; fecha: string; hora: string;
  profesionalId: string; servicioId: string; clienteId: string;
  estado: 'reservado' | 'llego' | 'atendido' | 'cancelado' | 'ausente';
  origen: 'online' | 'local';
}

export interface Cobro {
  id: string; fecha: string; hora: string;
  profesionalId: string; servicioId: string; clienteNombre: string;
  monto: number; medio: 'efectivo' | 'transferencia' | 'mercadopago' | 'debito';
  origen: 'turno';
}

/** Resultado de resolver una fecha: lo que realmente rige ese día. */
export interface DiaResuelto {
  fecha: string;
  modalidad: Modalidad;
  franjas: Franja[];
  /** Presente si rige una excepción en vez de la config semanal. */
  excepcion?: Excepcion;
}
