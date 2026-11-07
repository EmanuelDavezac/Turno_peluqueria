export const PLANTILLA_DEFAULT =
  'Hola {nombre}! Te recordamos tu turno en {local} el {dia} a las {hora} con {profesional}. ¡Te esperamos!';

export interface VariablesRecordatorio {
  nombre: string;
  local: string;
  dia: string;
  hora: string;
  profesional: string;
}

export function armarMensaje(plantilla: string, v: VariablesRecordatorio): string {
  return plantilla.replace(/\{(nombre|local|dia|hora|profesional)\}/g, (_, k: keyof VariablesRecordatorio) => v[k]);
}
