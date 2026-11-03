import { cn } from "@/lib/utils/cn";
import { formatArs } from "@/lib/utils/currency";

type ProductPriceProps = {
  priceArs: number;
  listPriceArs?: number | null;
  discountPercentage?: number | null;
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
  quantity = 1,
  className,
  priceClassName,
  listPriceClassName,
  showBadge = true,
}: ProductPriceProps) {
  const hasDiscount = Boolean(listPriceArs && listPriceArs > priceArs);

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 gap-y-1", className)}>
      {hasDiscount ? (
        <s className={cn("text-[0.8em] font-semibold text-brand-ink/40", listPriceClassName)}>
          <span className="sr-only">Antes </span>
          {formatArs((listPriceArs as number) * quantity)}
        </s>
      ) : null}
      <span className={priceClassName}>
        {hasDiscount ? <span className="sr-only">Ahora </span> : null}
        {formatArs(priceArs * quantity)}
      </span>
      {hasDiscount && showBadge && discountPercentage ? (
        <span className="self-center rounded-full bg-brand-pink px-2 py-0.5 text-[11px] font-extrabold leading-4 text-white">
          -{discountPercentage}%
        </span>
      ) : null}
    </span>
  );
}
