export class PiiMasker {
  static maskPhone(phone: string): string {
    if (!phone || phone.length < 4) return phone;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 4) return phone;
    const last4 = cleaned.slice(-4);
    const masked = '*'.repeat(Math.max(0, cleaned.length - 4));
    return phone.replace(cleaned, masked + last4);
  }

  static maskEmail(email: string): string {
    if (!email || !email.includes('@')) return email;
    const [local, domain] = email.split('@');
    if (local.length <= 2) return email;
    const maskedLocal = local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];
    return `${maskedLocal}@${domain}`;
  }

  static maskDni(dni: string): string {
    if (!dni || dni.length < 4) return dni;
    const cleaned = dni.replace(/\D/g, '');
    if (cleaned.length < 4) return dni;
    const last2 = cleaned.slice(-2);
    return '*'.repeat(cleaned.length - 2) + last2;
  }
}
