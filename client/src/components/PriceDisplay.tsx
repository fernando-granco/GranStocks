

interface PriceDisplayProps {
    nativePrice: number;
    nativeCcy: string;
    usdEqPrice?: number;
    baseCcyLabel?: string;
    isUsdNative?: boolean;
    className?: string; // Optional class for the container
    primaryClassName?: string; // Optional class for the primary price line
    secondaryClassName?: string; // Optional class for the secondary price line
}

export function PriceDisplay({
    nativePrice,
    nativeCcy,
    usdEqPrice,
    baseCcyLabel = "USD",
    isUsdNative,
    className = "",
    primaryClassName = "text-xl font-bold text-white",
    secondaryClassName = "text-xs text-neutral-500 mt-0.5"
}: PriceDisplayProps) {
    const formattedNative = nativePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Auto-detect USD native if not explicitly provided
    const isUsd = isUsdNative !== undefined ? isUsdNative : nativeCcy === 'USD';

    if (isUsd) {
        return (
            <div className={className}>
                <div className={primaryClassName}>{formattedNative} USD</div>
            </div>
        );
    }

    return (
        <div className={className}>
            <div className={primaryClassName}>{formattedNative} {nativeCcy}</div>
            {usdEqPrice !== undefined && usdEqPrice > 0 ? (
                <div className={secondaryClassName}>~{usdEqPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {baseCcyLabel}</div>
            ) : (
                <div className={secondaryClassName}>~— {baseCcyLabel}</div>
            )}
        </div>
    );
}

export default PriceDisplay;
