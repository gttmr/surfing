import { Icon } from "@/components/ui/Icon";
import { formatWon } from "@/lib/format";
import type { OrderMenuVariant } from "@/lib/participant-order-ui";

export function OrderVariantRow({
  variant,
  quantity,
  disabled,
  onChange,
}: {
  readonly variant: OrderMenuVariant;
  readonly quantity: number;
  readonly disabled: boolean;
  readonly onChange: (quantity: number) => void;
}) {
  return (
    <article className={`rounded-2xl border px-3 py-3 ${quantity > 0 ? "brand-list-item-active" : "brand-list-item"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-bold leading-5 text-brand-text">{variant.label}</p>
          <p className="brand-text-subtle mt-0.5 text-xs">{formatWon(variant.price)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            aria-label={`${variant.label} 수량 줄이기`}
            className="brand-button-secondary flex h-11 w-11 items-center justify-center rounded-full disabled:cursor-not-allowed"
            disabled={disabled || quantity === 0}
            onClick={() => onChange(quantity - 1)}
            type="button"
          >
            <Icon className="text-[20px]" name="remove" />
          </button>
          <output
            aria-label={`${variant.label} 수량`}
            className="min-w-8 text-center text-sm font-extrabold tabular-nums text-brand-text"
          >
            {quantity}
          </output>
          <button
            aria-label={`${variant.label} 수량 늘리기`}
            className="brand-button-primary flex h-11 w-11 items-center justify-center rounded-full disabled:cursor-not-allowed"
            disabled={disabled}
            onClick={() => onChange(quantity + 1)}
            type="button"
          >
            <Icon className="text-[20px]" name="add" />
          </button>
        </div>
      </div>
    </article>
  );
}
