export const PLANTILLA_DEFAULT =
  'Hola {nombre}! Te recordamos tu turno en {local} el {dia} a las {hora} con {profesional}. ¡Te esperamos!';

export const VARIABLES = ['nombre', 'local', 'dia', 'hora', 'profesional'] as const;
export type Variable = (typeof VARIABLES)[number];
export type VariablesRecordatorio = Record<Variable, string>;

export function armarMensaje(plantilla: string, v: VariablesRecordatorio): string {
  return plantilla.replace(/\{(nombre|local|dia|hora|profesional)\}/g, (_, k: Variable) => v[k]);
}

/** Variables entre llaves que no existen (por ejemplo, un error de tipeo como {hroa}). */
export function variablesDesconocidas(plantilla: string): string[] {
  const usadas = [...plantilla.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);
  return [...new Set(usadas.filter((u) => !(VARIABLES as readonly string[]).includes(u)))];
}
