import { ensureSpanishSummary, looksEnglish } from './summary-es';

describe('summary-es', () => {
  it('detecta inglés típico de ElevenLabs', () => {
    expect(
      looksEnglish(
        'The user requested an appointment. The agent successfully booked it.',
      ),
    ).toBe(true);
    expect(
      looksEnglish(
        'Se identificó al paciente y se reservó una cita en Cardiología.',
      ),
    ).toBe(false);
  });

  it('reescribe resumen en inglés según tools', () => {
    const out = ensureSpanishSummary({
      summary: 'The user successfully booked an appointment with the agent.',
      toolNames: ['identificar_paciente', 'reservar_cita'],
      resultCode: 'APPOINTMENT_BOOKED',
      patientName: 'Ana Pérez',
    });
    expect(out).toMatch(/Ana Pérez/);
    expect(out).toMatch(/reservó/);
    expect(looksEnglish(out)).toBe(false);
  });

  it('respeta resumen ya en español', () => {
    const es = 'Paciente identificado; se consultó disponibilidad sin reservar.';
    expect(ensureSpanishSummary({ summary: es, toolNames: [] })).toBe(es);
  });
});
