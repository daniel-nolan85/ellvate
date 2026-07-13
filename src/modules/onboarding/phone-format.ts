export const COMPLETE_PHONE_LENGTH = 14;

export function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length === 0) {
    return '';
  }
  const parts = [`(${digits.slice(0, 3)}${digits.length >= 3 ? ')' : ''}`];
  if (digits.length > 3) {
    parts.push(` ${digits.slice(3, 6)}`);
  }
  if (digits.length > 6) {
    parts.push(`-${digits.slice(6)}`);
  }
  return parts.join('');
}
