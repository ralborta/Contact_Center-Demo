export type TranscriptTurn = {
  role: 'agent' | 'user' | 'tool';
  text: string;
  t?: number;
  toolName?: string;
  appointmentId?: string;
};

const TOOL_LABELS: Record<string, (args?: any) => string> = {
  consultar_disponibilidad: (a) =>
    `Buscó disponibilidad${a?.especialidad ? ` en ${a.especialidad}` : a?.doctor ? ` con ${a.doctor}` : ''}`,
  buscar_doctores: (a) =>
    `Buscó médicos${a?.especialidad ? ` de ${a.especialidad}` : a?.nombre || a?.doctor ? `: ${a.nombre || a.doctor}` : ''}`,
  listar_especialidades: () => 'Consultó especialidades',
  identificar_paciente: () => 'Identificó al paciente',
  reservar_cita: () => 'Reservó cita',
  reprogramar_cita: () => 'Reprogramó cita',
  cancelar_cita: () => 'Canceló cita',
  listar_citas_paciente: () => 'Consultó citas del paciente',
};

function parseArgs(raw: any) {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

function toolLabel(name: string, args?: any) {
  const labelFn = TOOL_LABELS[name];
  return labelFn
    ? labelFn(args)
    : `Usó herramienta ${String(name || 'desconocida').replace(/_/g, ' ')}`;
}

function parseToolResultValue(raw: any) {
  let val = raw;
  if (typeof val === 'string') {
    try {
      val = JSON.parse(val);
    } catch {
      return null;
    }
  }
  return val && typeof val === 'object' ? val : null;
}

function citaIdFromResult(val: any): string | null {
  if (!val || typeof val !== 'object') return null;
  const id =
    val?.cita?.id ||
    val?.citaId ||
    val?.appointmentId ||
    val?.appointment?.id ||
    null;
  return id ? String(id) : null;
}

/** Normaliza transcript ElevenLabs (array o string) a turns de chat + tools legibles. */
export function parseConversationTranscript(data: any): TranscriptTurn[] {
  const raw = data?.transcript ?? data;
  const turns: TranscriptTurn[] = [];

  if (!Array.isArray(raw)) {
    if (typeof raw === 'string' && raw.trim()) {
      for (const line of raw.split('\n')) {
        const m = line.match(/^(agent|user|assistant|paciente|agente)\s*[:\-]\s*(.*)$/i);
        if (m) {
          const role = /user|paciente/i.test(m[1]) ? 'user' : 'agent';
          turns.push({ role, text: m[2] });
        } else if (line.trim()) {
          turns.push({ role: 'agent', text: line.trim() });
        }
      }
    }
    return turns;
  }

  for (const item of raw) {
    const t = item.time_in_call_secs ?? item.time_in_call ?? item.t ?? undefined;
    const roleRaw = String(item.role || item.speaker || '').toLowerCase();
    const message = item.message || item.text || '';

    if (Array.isArray(item.tool_calls)) {
      for (const tc of item.tool_calls) {
        const name = tc?.tool_name || tc?.name || tc?.function?.name || 'herramienta';
        const args = parseArgs(tc?.params || tc?.arguments || tc?.function?.arguments);
        turns.push({
          role: 'tool',
          text: toolLabel(name, args).trim(),
          t,
          toolName: String(name),
        });
      }
    }

    if (Array.isArray(item.tool_results)) {
      for (const tr of item.tool_results) {
        const name = String(tr?.tool_name || tr?.name || '');
        const val = parseToolResultValue(tr?.result_value ?? tr?.result);
        const citaId = citaIdFromResult(val);
        if (citaId && /reservar/i.test(name) && val?.ok !== false) {
          turns.push({
            role: 'tool',
            text: `Cita reservada · ${String(citaId).slice(0, 8)}…`,
            t,
            toolName: name || 'reservar_cita',
            appointmentId: citaId,
          });
        } else if (citaId && /reprogram/i.test(name) && val?.ok !== false) {
          turns.push({
            role: 'tool',
            text: `Cita reprogramada · ${String(citaId).slice(0, 8)}…`,
            t,
            toolName: name || 'reprogramar_cita',
            appointmentId: citaId,
          });
        } else if (/cancelar/i.test(name) && val?.ok !== false) {
          turns.push({
            role: 'tool',
            text: `Cita cancelada${citaId ? ` · ${String(citaId).slice(0, 8)}…` : ''}`,
            t,
            toolName: name || 'cancelar_cita',
            appointmentId: citaId || undefined,
          });
        }
      }
    }

    if (roleRaw === 'tool' && message) {
      turns.push({ role: 'tool', text: String(message), t });
      continue;
    }

    if (message && !/^\[.*\]$/.test(String(message).trim())) {
      if (String(message).trim().startsWith('{') && String(message).trim().endsWith('}')) {
        continue;
      }
      const role: 'agent' | 'user' =
        roleRaw === 'user' || roleRaw === 'paciente' ? 'user' : 'agent';
      turns.push({ role, text: String(message), t });
    }
  }

  return turns;
}

/** Solo la cita creada/tocada por tools de ESA conversación (nunca “última del paciente”). */
export function extractAppointmentIdFromTranscript(raw: any): string | null {
  const list = Array.isArray(raw) ? raw : raw?.transcript;
  if (Array.isArray(list)) {
    let found: string | null = null;
    for (const item of list) {
      for (const tr of item.tool_results || []) {
        const name = String(tr?.tool_name || tr?.name || '');
        if (!/reservar|reprogram|cancel/i.test(name)) continue;
        const val = parseToolResultValue(tr?.result_value ?? tr?.result);
        if (!val || val.ok === false) continue;
        const citaId = citaIdFromResult(val) || (val.citaId ? String(val.citaId) : null);
        if (citaId) found = citaId;
      }
    }
    if (found) return found;
  }

  // turns ya normalizados
  const turns = parseConversationTranscript(raw);
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].appointmentId) return turns[i].appointmentId!;
  }
  return null;
}

/**
 * resultCode SOLO a partir de tools realmente ejecutadas.
 * No usar el summary (alucina “reservó” sin tool).
 */
export function inferResultCodeFromTurns(turns: TranscriptTurn[]): string | null {
  const toolNames = turns
    .filter((t) => t.role === 'tool')
    .map((t) => (t.toolName || t.text || '').toLowerCase());

  if (toolNames.some((n) => /reservar_cita|reservó cita|cita reservada/.test(n))) {
    return 'APPOINTMENT_BOOKED';
  }
  if (toolNames.some((n) => /reprogramar_cita|reprogramó|cita reprogramada/.test(n))) {
    return 'RESCHEDULED';
  }
  if (toolNames.some((n) => /cancelar_cita|canceló|cita cancelada/.test(n))) {
    return 'CANCELLED';
  }
  return 'RESOLVED';
}

/** Nombres de tools crudos del transcript ElevenLabs. */
export function extractExecutedToolNames(raw: any): string[] {
  const list = Array.isArray(raw) ? raw : raw?.transcript;
  const names: string[] = [];
  if (!Array.isArray(list)) return names;
  for (const item of list) {
    for (const tc of item.tool_calls || []) {
      const n = tc?.tool_name || tc?.name;
      if (n) names.push(String(n));
    }
  }
  return names;
}
