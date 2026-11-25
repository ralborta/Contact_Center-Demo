import {
  isWithinSendWindow,
  renderTemplate,
} from './whatsapp.templates';

describe('whatsapp templates', () => {
  it('reemplaza variables de plantilla', () => {
    const out = renderTemplate(
      'Hola {{paciente}}, cita de {{especialidad}} con {{doctor}} el {{fecha}} a las {{hora}}.',
      {
        paciente: 'María García',
        especialidad: 'Cardiología',
        doctor: 'Flores',
        fecha: 'jueves 26 de noviembre',
        hora: '09:00',
      },
    );
    expect(out).toContain('María García');
    expect(out).toContain('Cardiología');
    expect(out).toContain('Flores');
    expect(out).not.toMatch(/\{\{/);
  });

  it('ventana de envío por HH:mm', () => {
    // 12:00 UTC = 08:00 La Paz (UTC-4)
    const noonUtc = new Date('2026-11-26T12:00:00.000Z');
    expect(isWithinSendWindow(noonUtc, '08:00', '20:00')).toBe(true);
    expect(isWithinSendWindow(noonUtc, '09:00', '20:00')).toBe(false);
  });
});
