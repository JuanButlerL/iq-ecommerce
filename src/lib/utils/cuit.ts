// CUIT/CUIL: 11 dígitos, el último es verificador (módulo 11 con pesos 5-4-3-2-7-6-5-4-3-2).
const CUIT_WEIGHTS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function normalizeCuit(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidCuit(value: string) {
  const digits = normalizeCuit(value);

  if (!/^\d{11}$/.test(digits)) {
    return false;
  }

  const sum = CUIT_WEIGHTS.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
  const remainder = 11 - (sum % 11);
  const checkDigit = remainder === 11 ? 0 : remainder === 10 ? 9 : remainder;

  return checkDigit === Number(digits[10]);
}

export function formatCuit(value: string) {
  const digits = normalizeCuit(value);
  return digits.length === 11 ? `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}` : value;
}
