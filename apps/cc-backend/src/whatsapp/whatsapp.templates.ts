export const DEFAULT_CONFIRM_TEMPLATE =
  'Hola {{paciente}}, te escribimos del Hospital Santa María para confirmar tu turno de {{especialidad}} con el/la Dr(a). {{doctor}} el {{fecha}} a las {{hora}}. ¿Confirmás tu asistencia? Respondé CONFIRMAR, CANCELAR o CAMBIAR.';

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template || DEFAULT_CONFIRM_TEMPLATE;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'gi'), v);
  }
  return out;
}

export function formatArgentinaParts(date: Date): { fecha: string; hora: string } {
  const fecha = date.toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const hora = date.toLocaleTimeString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
  });
  return { fecha, hora };
}

/** HH:mm en America/Argentina/Buenos_Aires */
export function argentinaHm(now = new Date()): string {
  return now.toLocaleTimeString('en-GB', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function argentinaYmd(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

export function isWithinSendWindow(
  now: Date,
  startHm: string,
  endHm: string,
): boolean {
  const hm = argentinaHm(now);
  return hm >= startHm && hm <= endHm;
}
