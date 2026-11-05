import Link from "next/link";

import { Button } from "@/components/ui/button";

type ProductCardActionsViewProps = {
  quantity: number;
  added: boolean;
  accent: string;
  buttonLabel: string;
  productHref: string;
  onAdd: () => void;
  onDecrease: () => void;
  onIncrease: () => void;
};

// Botones de la tarjeta de producto, compartidos por la tienda y el canal mayorista. Cada canal aporta su carrito.
export function ProductCardActionsView({
  quantity,
  added,
  accent,
  buttonLabel,
  productHref,
  onAdd,
  onDecrease,
  onIncrease,
}: ProductCardActionsViewProps) {
  return (
    <div className="space-y-3">
      {quantity === 0 ? (
        <Button
          type="button"
          className="h-11 w-full rounded-[0.9rem] bg-brand-pink text-sm font-extrabold text-white shadow-none hover:bg-[#EA737D]"
          onClick={onAdd}
        >
          Agregar al carrito
        </Button>
      ) : (
        <div className="flex items-stretch gap-2">
          <div className="flex h-11 w-full items-center justify-between rounded-[0.9rem] border border-brand-ink/10 bg-white px-1 shadow-sm md:w-auto md:justify-start">
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-[0.7rem] text-lg font-extrabold text-brand-ink transition hover:bg-brand-ink/5"
              aria-label="Restar cantidad"
              onClick={onDecrease}
            >
              -
            </button>
            <span className="flex min-w-8 justify-center text-sm font-extrabold text-brand-ink">{quantity}</span>
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-[0.7rem] text-lg font-extrabold text-brand-ink transition hover:bg-brand-ink/5"
              aria-label="Sumar cantidad"
              onClick={onIncrease}
            >
              +
            </button>
          </div>

          <Button
            type="button"
            className="hidden h-11 flex-1 whitespace-nowrap rounded-[0.9rem] bg-brand-pink px-2 text-sm font-extrabold text-white shadow-none hover:bg-[#EA737D] md:inline-flex"
            onClick={onAdd}
          >
            {added ? (
              "Agregado"
            ) : (
              <>
                {/* Con cuatro tarjetas por fila no entra el texto completo al lado del contador. */}
                Agregar<span className="hidden md:inline xl:hidden 2xl:inline">&nbsp;al carrito</span>
              </>
            )}
          </Button>
        </div>
      )}

      <Link
        href={productHref}
        className="hidden h-11 w-full items-center justify-center rounded-[0.9rem] border text-sm font-extrabold transition md:flex"
        style={{ borderColor: accent, color: accent }}
      >
        {buttonLabel}
      </Link>
    </div>
  );
}
