/**
 * Price Utility Functions for SPILLA GOLD Analysis Engine
 * Normalizes MT5 Cent Account prices (XAUUSD.cent) to standard market prices.
 */

/**
 * Normalizes price from MT5 Cent Account (e.g. XAUUSD.cent) to standard USD price.
 * Divides by 100 if price > 10000 or symbol contains '.cent'.
 * Examples: 289766.00 -> 2897.66, 424650.00 -> 4246.50, 2897.66 -> 2897.66
 */
export function normalizeCentPrice(price: number | undefined | null, symbol: string = 'XAUUSD.cent'): number {
  if (price === undefined || price === null || isNaN(price)) return 0;
  const isCentSymbol = symbol ? symbol.toLowerCase().includes('.cent') : false;
  
  if ((isCentSymbol && price > 10000) || price > 10000) {
    return Number((price / 100).toFixed(2));
  }
  return Number(price.toFixed(2));
}

/**
 * Formats symbol label cleanly for user display
 * e.g. "XAUUSD.cent" -> "XAUUSD (Cent Account)"
 */
export function formatSymbolLabel(symbol: string = 'XAUUSD.cent'): string {
  if (!symbol) return 'XAUUSD (Cent Account)';
  if (symbol.toLowerCase().includes('.cent')) {
    const base = symbol.replace(/\.cent$/i, '').toUpperCase();
    return `${base} (Cent Account)`;
  }
  return symbol.toUpperCase();
}

/**
 * Formats price with comma separator and 2 decimal places (e.g., 2,897.66)
 */
export function formatPriceDisplay(price: number | undefined | null, symbol: string = 'XAUUSD.cent'): string {
  const normalized = normalizeCentPrice(price, symbol);
  return normalized.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
