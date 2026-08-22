/**
 * Price Utility Functions for SPILLA GOLD Analysis Engine
 * Normalizes MT5 Cent Account prices (XAUUSD.cent) to standard market prices.
 */

/**
 * Normalizes price from MT5 Cent Account (e.g. XAUUSD.cent) to standard USD price.
 * Divides by 100 ONLY if the symbol is a genuine cent symbol (e.g. XAUUSD.CENT, .cent, .c) and price > 10000.
 * Standard symbols (BTCUSD, XAUUSD, EURUSD, GBPUSD, USDJPY) NEVER inherit cent conversion.
 */
export function normalizeCentPrice(price: number | undefined | null, symbol: string = 'XAUUSD'): number {
  if (price === undefined || price === null || isNaN(price)) return 0;
  const sym = (symbol || 'XAUUSD').trim().toLowerCase();
  
  // Non-cent majors must NEVER be converted
  const isMajorStandard =
    sym.includes('btc') ||
    sym.includes('eur') ||
    sym.includes('gbp') ||
    sym.includes('jpy') ||
    sym === 'xauusd' ||
    sym === 'gold';

  if (isMajorStandard) {
    return Number(price);
  }

  const isCentSymbol = sym.includes('.cent') || sym.endsWith('.c') || sym.includes('cent');
  
  if (isCentSymbol && price > 10000) {
    return Number((price / 100).toFixed(2));
  }
  return Number(price);
}

/**
 * Formats symbol label cleanly for user display
 * e.g. "XAUUSD.cent" -> "XAUUSD (Cent Account)"
 */
export function formatSymbolLabel(symbol: string = 'XAUUSD'): string {
  if (!symbol) return 'XAUUSD';
  if (symbol.toLowerCase().includes('.cent') || symbol.toLowerCase().endsWith('.c')) {
    const base = symbol.replace(/\.cent$/i, '').replace(/\.c$/i, '').toUpperCase();
    return `${base} (Cent Account)`;
  }
  return symbol.toUpperCase();
}

/**
 * Formats price with comma separator and appropriate decimal places
 */
export function formatPriceDisplay(price: number | undefined | null, symbol: string = 'XAUUSD'): string {
  const normalized = normalizeCentPrice(price, symbol);
  const sym = (symbol || 'XAUUSD').toUpperCase();
  let digits = 2;
  if (sym.includes('EUR') || sym.includes('GBP')) digits = 5;
  else if (sym.includes('JPY')) digits = 3;
  else if (sym.includes('BTC')) digits = 2;

  return normalized.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
