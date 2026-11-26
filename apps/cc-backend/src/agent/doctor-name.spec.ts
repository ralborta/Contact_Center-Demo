import { doctorMatchesName, normalizeText, stripDoctorPrefix } from './doctor-name';

describe('doctorMatchesName', () => {
  const miranda = { firstName: 'Fernando', lastName: 'Miranda' };
  const vargas = { firstName: 'José', lastName: 'Vargas' };

  it('normaliza tildes', () => {
    expect(normalizeText('José')).toBe('jose');
    expect(stripDoctorPrefix('Dr. Vargas')).toBe('vargas');
  });

  it('coincide por apellido parcial', () => {
    expect(doctorMatchesName(miranda, 'Miranda')).toBe(true);
    expect(doctorMatchesName(miranda, 'mirand')).toBe(true);
  });

  it('coincide por nombre completo sin tildes', () => {
    expect(doctorMatchesName(vargas, 'jose vargas')).toBe(true);
    expect(doctorMatchesName(vargas, 'José Vargas')).toBe(true);
  });

  it('no coincide con otro médico', () => {
    expect(doctorMatchesName(miranda, 'Giménez')).toBe(false);
    expect(doctorMatchesName(vargas, 'inexistente')).toBe(false);
  });
});
