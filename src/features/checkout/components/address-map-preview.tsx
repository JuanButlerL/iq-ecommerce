import { MapPinned } from "lucide-react";

export type AddressPreviewInput = {
  street?: string;
  number?: string;
  withoutNumber?: boolean;
  extra?: string;
  locality?: string;
  province?: string;
  postalCode?: string;
  hasAddressErrors?: boolean;
};

export type AddressPreview = {
  query: string;
  hasAddressErrors: boolean;
  mapsHref: string;
  embedSrc: string;
};

// Devuelve null hasta que la dirección está completa, así el mapa no busca destinos a medio escribir.
export function buildAddressPreview({
  street,
  number,
  withoutNumber,
  extra,
  locality,
  province,
  postalCode,
  hasAddressErrors = false,
}: AddressPreviewInput): AddressPreview | null {
  const hasRequiredAddressFields = Boolean(
    street?.trim() && (withoutNumber || number?.trim()) && locality?.trim() && province?.trim() && postalCode?.trim(),
  );

  if (!hasRequiredAddressFields) {
    return null;
  }

  const formattedStreet = [street?.trim(), withoutNumber ? "s/n" : number?.trim()].filter(Boolean).join(" ");
  const query = [formattedStreet, extra?.trim(), locality?.trim(), province?.trim(), postalCode?.trim(), "Argentina"]
    .filter(Boolean)
    .join(", ");

  return {
    query,
    hasAddressErrors,
    mapsHref: `https://www.google.com/maps?q=${encodeURIComponent(query)}`,
    embedSrc: `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`,
  };
}

export function AddressMapPreview({ preview }: { preview: AddressPreview }) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-brand-ink/10 bg-white shadow-card">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-brand-pink/10 p-2 text-brand-pink">
            <MapPinned className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-brand-ink/46">Ubicación</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-brand-ink/78">{preview.query}</p>
          </div>
        </div>
        <p className="text-sm leading-6 text-brand-ink/62">
          {preview.hasAddressErrors
            ? "Revisá calle, altura, localidad o código postal para ubicar mejor el destino."
            : "Si no coincide, modificá la calle, altura o dejanos una aclaración en observaciones."}
        </p>
      </div>
      <div className="border-t border-brand-ink/10 bg-[#f8f6f4] p-2">
        <div className="relative overflow-hidden rounded-[1.4rem] border border-brand-ink/10 bg-white">
          <iframe
            title="Vista previa del destino"
            src={preview.embedSrc}
            className="pointer-events-none h-[280px] w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="absolute inset-0 z-10" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
