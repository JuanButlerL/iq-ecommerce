export function buildOrderNumberPrefix(date = new Date()) {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}${month}`;
}

export function buildNextOrderNumber(prefix: string, lastOrderNumber?: string | null) {
  const lastSequence = lastOrderNumber ? Number(lastOrderNumber.slice(-4)) : null;
  const nextSequence =
    lastSequence === null ? 1000 : lastSequence === 9999 ? 0 : lastSequence + 1;

  return `${prefix}${String(nextSequence).padStart(4, "0")}`;
}
