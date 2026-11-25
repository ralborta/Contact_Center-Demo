/** Normaliza para comparación: minúsculas, sin tildes, espacios colapsados. */
export function normalizeText(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Quita prefijos Dr/Dra del query. */
export function stripDoctorPrefix(s: string): string {
  return normalizeText(s).replace(/^(dr\.?a?|dra\.?)\s+/i, '').trim();
}

/**
 * Coincide nombre parcial sin tildes/mayúsculas: apellido, nombre o nombre completo.
 * Ej: "Miranda", "jose vargas", "José Vargas", "Dr. Vargas".
 */
export function doctorMatchesName(
  doctor: { firstName: string; lastName: string },
  query?: string | null,
): boolean {
  const q = stripDoctorPrefix(query || '');
  if (!q) return true;

  const first = normalizeText(doctor.firstName);
  const last = normalizeText(doctor.lastName);
  const full = `${first} ${last}`;
  const fullRev = `${last} ${first}`;

  if (
    first.includes(q) ||
    last.includes(q) ||
    full.includes(q) ||
    fullRev.includes(q)
  ) {
    return true;
  }

  const tokens = q.split(' ').filter(Boolean);
  if (tokens.length > 1) {
    return tokens.every((t) => full.includes(t) || fullRev.includes(t));
  }

  return false;
}
