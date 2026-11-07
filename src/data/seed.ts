import { getDia } from '@/domain/getDia';
import { permiteFila, permiteTurnos } from '@/domain/modalidad';
import type {
  Cliente, Cobro, ConfigDia, EntradaFila, Excepcion, Franja, Profesional, Servicio, Turno,
} from '@/domain/types';
import { fromMin, sumarDias, toMin } from '@/lib/horas';

// Todo lo de este archivo son DATOS DE EJEMPLO.

const franjaCortada: Franja[] = [{ desde: '09:00', hasta: '12:30' }, { desde: '16:00', hasta: '20:30' }];

export const SEMANA_DEFAULT: ConfigDia[] = [
  { dia: 0, modalidad: 'cerrado', franjas: [] },
  { dia: 1, modalidad: 'cerrado', franjas: [] },
  { dia: 2, modalidad: 'turnos', franjas: franjaCortada },
  { dia: 3, modalidad: 'turnos', franjas: franjaCortada },
  { dia: 4, modalidad: 'turnos', franjas: franjaCortada },
  { dia: 5, modalidad: 'llegada', franjas: [{ desde: '09:00', hasta: '12:30' }, { desde: '16:00', hasta: '21:00' }] },
  { dia: 6, modalidad: 'turnos', franjas: [{ desde: '08:30', hasta: '13:30' }] },
];

export const PROFESIONALES: Profesional[] = [
  { id: 'p1', nombre: 'Profesional 1 (ejemplo)', color: '#2a6f6b', comisionPct: 50, activo: true },
  { id: 'p2', nombre: 'Profesional 2 (ejemplo)', color: '#b0563a', comisionPct: 50, activo: true },
];

export const SERVICIOS: Servicio[] = [
  { id: 's1', nombre: 'Corte', duracionMin: 30, precio: 11000 },
  { id: 's2', nombre: 'Corte + barba', duracionMin: 45, precio: 14000 },
  { id: 's3', nombre: 'Barba', duracionMin: 20, precio: 6000 },
  { id: 's4', nombre: 'Corte niño', duracionMin: 25, precio: 9000 },
  { id: 's5', nombre: 'Color / mechas', duracionMin: 90, precio: 28000 },
  { id: 's6', nombre: 'Lavado y peinado', duracionMin: 30, precio: 8000 },
];

const NOMBRES = [
  'Martín Gómez', 'Lucas Ferreyra', 'Sofía Benítez', 'Julián Acosta',
  'Camila Rojas', 'Nicolás Vera', 'Valentina Paz', 'Tomás Sosa',
];
export const CLIENTES: Cliente[] = NOMBRES.map((nombre, i) => ({
  id: `c${i + 1}`,
  nombre,
  whatsapp: `3496 ${String(40 + i * 7)}-${String(1000 + i * 731).padStart(4, '0')}`,
  notas: i === 0 ? 'Máquina 2 a los costados' : undefined,
}));

const MEDIOS: Cobro['medio'][] = ['efectivo', 'transferencia', 'mercadopago', 'debito'];

function slotsDe(franjas: Franja[]): string[] {
  const out: string[] = [];
  for (const f of franjas) for (let m = toMin(f.desde); m + 30 <= toMin(f.hasta); m += 30) out.push(fromMin(m));
  return out;
}

export interface SeedData {
  turnos: Turno[];
  fila: EntradaFila[];
  cobros: Cobro[];
}

/** Turnos/cobros de los últimos 7 días y próximos 14, más fila de hoy si corresponde. */
export function generarSeed(hoy: string, semana: ConfigDia[], excepciones: Excepcion[]): SeedData {
  const turnos: Turno[] = [];
  const fila: EntradaFila[] = [];
  const cobros: Cobro[] = [];
  let k = 0;

  for (let off = -7; off <= 14; off++) {
    const fecha = sumarDias(hoy, off);
    const dia = getDia(fecha, semana, excepciones);
    const pasado = off < 0;
    const slots = slotsDe(dia.franjas);

    if (permiteTurnos(dia.modalidad) && slots.length) {
      // Cada hora del día cae en un profesional fijo: nunca hay solapes.
      const elegidos = slots.filter((_, i) => (i + off + 20) % 3 !== 0).slice(0, 7);
      elegidos.forEach((hora, i) => {
        const prof = PROFESIONALES[slots.indexOf(hora) % 2];
        const sv = SERVICIOS[(k + i) % 4]; // servicios cortos (<= 45 min)
        const cli = CLIENTES[(k + i) % CLIENTES.length];
        turnos.push({
          id: `t_seed_${k++}`, fecha, hora, profesionalId: prof.id, servicioId: sv.id, clienteId: cli.id,
          estado: pasado ? 'atendido' : 'reservado', origen: i % 3 === 0 ? 'local' : 'online',
        });
        if (pasado) {
          cobros.push({
            id: `cb_seed_${k}`, fecha, hora, profesionalId: prof.id, servicioId: sv.id, clienteNombre: cli.nombre,
            monto: sv.precio, medio: MEDIOS[k % 4], origen: 'turno',
          });
        }
      });
    }

    if (permiteFila(dia.modalidad) && (pasado || off === 0)) {
      const base = slots[0] ?? '09:00';
      const cant = pasado ? 9 : 5;
      for (let i = 0; i < cant; i++) {
        const sv = SERVICIOS[(k + i) % 4];
        const cli = CLIENTES[(k + i + 3) % CLIENTES.length];
        const prof = PROFESIONALES[i % 2];
        const min = toMin(base) + i * 25;
        const hhmm = fromMin(min);
        // Hoy: 2 listos, 1 atendiendo, 2 en espera.
        const estado: EntradaFila['estado'] = pasado || i < 2 ? 'listo' : i === 2 ? 'atendiendo' : 'espera';
        const ingresoAt = `${fecha}T${hhmm}:00`;
        fila.push({
          id: `f_seed_${k++}`, fecha, numero: i + 1, clienteNombre: cli.nombre, servicioId: sv.id,
          profesionalId: estado === 'espera' ? undefined : prof.id,
          estado, origen: i % 2 ? 'online' : 'local', ingresoAt,
          inicioAt: estado === 'espera' ? undefined : ingresoAt,
          finAt: estado === 'listo' ? `${fecha}T${fromMin(min + sv.duracionMin)}:00` : undefined,
        });
        if (estado === 'listo') {
          cobros.push({
            id: `cb_seed_${k}`, fecha, hora: fromMin(min + sv.duracionMin), profesionalId: prof.id,
            servicioId: sv.id, clienteNombre: cli.nombre, monto: sv.precio, medio: MEDIOS[k % 4], origen: 'llegada',
          });
        }
      }
    }
  }
  return { turnos, fila, cobros };
}
