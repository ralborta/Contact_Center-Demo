import type { TranscriptTurn } from './transcript';

const EN_MARKERS =
  /\b(the user|the agent|the conversation|successfully|requested|provided|initiated|greeting|appointment assistant|hospital central)\b/i;

export function looksEnglish(text?: string | null): boolean {
  if (!text || !String(text).trim()) return false;
  const t = String(text);
  // Si ya tiene español típico y poco inglés → no tocar
  if (/[áéíóúñ¿¡]/i.test(t) && !EN_MARKERS.test(t)) return false;
  return EN_MARKERS.test(t) || /\b(the|and|with|for|was|were|this|that)\b/i.test(t);
}

/**
 * Genera o normaliza un resumen breve en español a partir de tools/resultCode.
 * Si el summary de ElevenLabs ya viene en español, se respeta.
 */
export function ensureSpanishSummary(params: {
  summary?: string | null;
  turns?: TranscriptTurn[];
  toolNames?: string[];
  resultCode?: string | null;
  patientName?: string | null;
}): string {
  const incoming = params.summary ? String(params.summary).trim() : '';
  if (incoming && !looksEnglish(incoming)) return incoming;

  const tools = (params.toolNames || [])
    .map((t) => t.toLowerCase())
    .concat(
      (params.turns || [])
        .filter((t) => t.role === 'tool')
        .map((t) => (t.toolName || t.text || '').toLowerCase()),
    );

  const who = params.patientName?.trim() || 'el paciente';
  const booked = tools.some((t) => /reservar_cita|reservó cita|cita reservada/.test(t));
  const rescheduled = tools.some((t) => /reprogramar_cita|reprogramó|cita reprogramada/.test(t));
  const cancelled = tools.some((t) => /cancelar_cita|canceló|cita cancelada/.test(t));
  const registered = tools.some((t) => /registrar_paciente|registró paciente|paciente registrado/.test(t));
  const identified = tools.some((t) => /identificar_paciente|identificó/.test(t));
  const availability = tools.some((t) => /consultar_disponibilidad|disponibilidad/.test(t));

  const code = params.resultCode || '';
  if (booked || code === 'APPOINTMENT_BOOKED') {
    if (registered) {
      return `Se registró a ${who}, se consultó disponibilidad y se reservó una cita.`;
    }
    return `Se identificó a ${who}, se consultó disponibilidad y se reservó una cita.`;
  }
  if (rescheduled || code === 'RESCHEDULED') {
    return `Se reprogramó una cita para ${who}.`;
  }
  if (cancelled || code === 'CANCELLED') {
    return `Se canceló una cita de ${who}.`;
  }
  if (identified && availability) {
    return `Se identificó a ${who} y se consultó disponibilidad, sin completar una reserva en esta llamada.`;
  }
  if (identified) {
    return `Se identificó a ${who} en el sistema. La llamada no incluyó reserva, reprogramación ni cancelación.`;
  }
  if (availability) {
    return `Se consultó disponibilidad de turnos. No hubo reserva en esta llamada.`;
  }
  return `Llamada de consulta con el asistente de citas del Hospital Central La Paz.`;
}
