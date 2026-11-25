import {
  isTestConversationId,
  parseConversationTranscript,
  stripExpressiveTags,
} from './transcript';

describe('transcript helpers', () => {
  it('stripExpressiveTags quita [warm]/[happy]', () => {
    expect(stripExpressiveTags('Hola [warm] Natalia [happy] listo.')).toBe(
      'Hola Natalia listo.',
    );
  });

  it('parseConversationTranscript usa original_message completo', () => {
    const turns = parseConversationTranscript({
      transcript: [
        {
          role: 'agent',
          message: '¡Hola! [warm] Con gusto te ayudo con tu cita de traumato...',
          original_message:
            '¡Hola! [warm] Con gusto te ayudo con tu cita de traumatología. ¿Me confirmás tu DNI?',
          time_in_call_secs: 1,
        },
      ],
    });
    expect(turns).toHaveLength(1);
    expect(turns[0].text).toBe(
      '¡Hola! Con gusto te ayudo con tu cita de traumatología. ¿Me confirmás tu DNI?',
    );
    expect(turns[0].text).not.toMatch(/\[\w+\]/);
    expect(turns[0].text).not.toMatch(/\.\.\.$/);
  });

  it('detecta conversation ids de prueba', () => {
    expect(isTestConversationId('test-trun_5001abc')).toBe(true);
    expect(isTestConversationId('conv_test_reg_123')).toBe(true);
    expect(isTestConversationId('conv_0301m8adn0r8faft18f1p4mgtcc1')).toBe(false);
  });
});
