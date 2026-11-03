import { calculateBuyXPayYFreeUnits, formatBuyXPayYLabel } from "@/features/catalog/lib/product-discount";
import { cn } from "@/lib/utils/cn";
import { formatArs } from "@/lib/utils/currency";

type ProductPriceProps = {
  priceArs: number;
  listPriceArs?: number | null;
  discountPercentage?: number | null;
  // Active buy X pay Y promo (e.g. 3 and 2 for a 3x2).
  buyQuantity?: number | null;
  payQuantity?: number | null;
  quantity?: number;
  className?: string;
  priceClassName?: string;
  listPriceClassName?: string;
  showBadge?: boolean;
};

export function ProductPrice({
  priceArs,
  listPriceArs,
  discountPercentage,
  buyQuantity,
  payQuantity,
  quantity = 1,
  className,
  priceClassName,
  listPriceClassName,
  showBadge = true,
}: ProductPriceProps) {
  const promoLabel = buyQuantity && payQuantity ? formatBuyXPayYLabel(buyQuantity, payQuantity) : null;
  const freeUnits = buyQuantity && payQuantity ? calculateBuyXPayYFreeUnits(quantity, buyQuantity, payQuantity) : 0;
  const hasPercentageDiscount = Boolean(listPriceArs && listPriceArs > priceArs);
  const struckTotalArs = hasPercentageDiscount
    ? (listPriceArs as number) * quantity
    : freeUnits > 0
      ? priceArs * quantity
      : null;
  const totalArs = priceArs * (quantity - freeUnits);

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      {struckTotalArs ? (
        <s className={cn("text-[0.8em] font-semibold text-brand-ink/40", listPriceClassName)}>
          <span className="sr-only">Antes </span>
          {formatArs(struckTotalArs)}
        </s>
      ) : null}
      <span className={priceClassName}>
        {struckTotalArs ? <span className="sr-only">Ahora </span> : null}
        {formatArs(totalArs)}
      </span>
      {hasPercentageDiscount && showBadge && discountPercentage ? (
        <span className="self-center rounded-full bg-brand-pink px-2 py-0.5 text-[11px] font-extrabold leading-4 text-white">
          -{discountPercentage}%
        </span>
      ) : null}
      {promoLabel && showBadge ? (
        <span className="self-center rounded-full bg-brand-pink px-2 py-0.5 text-[11px] font-extrabold leading-4 text-white">
          {promoLabel}
        </span>
      ) : null}
    </span>
  );
}
