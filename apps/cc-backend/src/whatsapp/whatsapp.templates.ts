export const DEFAULT_CONFIRM_TEMPLATE =
  'Hola {{paciente}}, te escribimos del Hospital Central La Paz para confirmar tu cita de {{especialidad}} con el/la Dr(a). {{doctor}} el {{fecha}} a las {{hora}}. ¿Confirmás tu asistencia? Respondé CONFIRMAR, CANCELAR o CAMBIAR.';

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

export function formatLaPazParts(date: Date): { fecha: string; hora: string } {
  const fecha = date.toLocaleDateString('es-BO', {
    timeZone: 'America/La_Paz',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const hora = date.toLocaleTimeString('es-BO', {
    timeZone: 'America/La_Paz',
    hour: '2-digit',
    minute: '2-digit',
  });
  return { fecha, hora };
}

/** HH:mm en America/La_Paz */
export function laPazHm(now = new Date()): string {
  return now.toLocaleTimeString('en-GB', {
    timeZone: 'America/La_Paz',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function laPazYmd(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });
}

export function isWithinSendWindow(
  now: Date,
  startHm: string,
  endHm: string,
): boolean {
  const hm = laPazHm(now);
  return hm >= startHm && hm <= endHm;
}
