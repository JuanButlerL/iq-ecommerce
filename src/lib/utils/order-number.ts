export function generatePublicOrderNumber() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 900 + 100);

  return `IQ-${timestamp}${random}`;
}
