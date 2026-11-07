import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
export const formatARS = (n: number): string => ars.format(n);

/** "viernes 6 de noviembre" */
export const fechaLarga = (iso: string): string => format(parseISO(iso), "EEEE d 'de' MMMM", { locale: es });
