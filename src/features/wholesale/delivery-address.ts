// El maestro y los pedidos mayoristas guardan calle y altura en un solo campo; el checkout las pide por separado.
// Separar y volver a unir tiene que dar el mismo texto: si cambiara, la dirección dejaría de coincidir con la del
// maestro y el cliente perdería el pago diferido.

export type StreetParts = {
  street: string;
  number: string;
  withoutNumber: boolean;
};

const STREET_WITH_NUMBER = /^(.*\S)\s+(\d{1,8}(?:\s*(?:bis|[a-z]))?)$/i;

export function splitStreet(value: string): StreetParts {
  const trimmed = value.trim();

  if (!trimmed) {
    return { street: "", number: "", withoutNumber: false };
  }

  const match = STREET_WITH_NUMBER.exec(trimmed);

  return match ? { street: match[1]!, number: match[2]!, withoutNumber: false } : { street: trimmed, number: "", withoutNumber: true };
}

export function joinStreet({ street, number, withoutNumber }: StreetParts) {
  return (withoutNumber ? street.trim() : `${street.trim()} ${number.trim()}`).trim();
}
