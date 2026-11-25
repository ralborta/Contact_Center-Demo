export type TranscriptTurn = {
  role: 'agent' | 'user' | 'tool';
  text: string;
  t?: number;
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
        turns.push({ role: 'tool', text: toolLabel(name, args).trim(), t });
      }
    }

    if (Array.isArray(item.tool_results)) {
      for (const tr of item.tool_results) {
        const name = tr?.tool_name || tr?.name || '';
        let val = tr?.result_value ?? tr?.result;
        if (typeof val === 'string') {
          try {
            val = JSON.parse(val);
          } catch {
            /* keep */
          }
        }
        if (val && typeof val === 'object') {
          const citaId = val?.cita?.id || val?.citaId || val?.appointmentId;
          if (citaId && /reservar/i.test(name)) {
            turns.push({
              role: 'tool',
              text: `Cita reservada · ${String(citaId).slice(0, 8)}…`,
              t,
            });
          }
        }
      }
    }

    // Already-normalized tool turn from our own storage
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

export function extractAppointmentIdFromTranscript(raw: any): string | null {
  const list = Array.isArray(raw) ? raw : raw?.transcript;
  if (!Array.isArray(list)) return null;
  for (const item of list) {
    for (const tr of item.tool_results || []) {
      const name = tr?.tool_name || '';
      let val = tr?.result_value ?? tr?.result;
      if (typeof val === 'string') {
        try {
          val = JSON.parse(val);
        } catch {
          continue;
        }
      }
      if (val && typeof val === 'object') {
        const citaId = val?.cita?.id || val?.citaId || val?.appointmentId;
        if (citaId && /reservar|reprogram|cancel/i.test(name)) {
          return String(citaId);
        }
      }
    }
  }
  return null;
}

export function inferResultCodeFromTurns(
  turns: TranscriptTurn[],
  summary?: string | null,
): string | null {
  const blob = `${turns.map((t) => t.text).join(' ')} ${summary || ''}`.toLowerCase();
  if (turns.some((t) => t.role === 'tool' && /reserv/i.test(t.text)) || /reserv/.test(blob)) {
    return 'APPOINTMENT_BOOKED';
  }
  if (turns.some((t) => t.role === 'tool' && /reprogram/i.test(t.text)) || /reprogram/.test(blob)) {
    return 'RESCHEDULED';
  }
  if (turns.some((t) => t.role === 'tool' && /cancel/i.test(t.text)) || /cancel/.test(blob)) {
    return 'CANCELLED';
  }
  return 'RESOLVED';
}
