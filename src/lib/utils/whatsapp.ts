export function buildWhatsappUrl(phone: string, message: string) {
  const sanitized = phone.replace(/[^\d]/g, "");
  const text = encodeURIComponent(message);

  return `https://wa.me/${sanitized}?text=${text}`;
}
