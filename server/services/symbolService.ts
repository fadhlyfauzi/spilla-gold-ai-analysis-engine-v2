import { SymbolSpecification } from '../../src/types.js';

export class SymbolService {
  private symbols: Map<string, SymbolSpecification> = new Map();

  constructor() {
    this.seedDefaultSymbols();
  }

  private seedDefaultSymbols() {
    const defaultSpecs: SymbolSpecification[] = [
      {
        symbol: 'XAUUSD',
        name: 'Spot Gold / US Dollar',
        category: 'METALS',
        contractSize: 100, // 100 oz per 1 standard lot
        tickSize: 0.01,
        tickValue: 1.00, // $1 per 0.01 move on 1.00 lot ($10/pip on 0.10 move)
        volumeMin: 0.01,
        volumeMax: 100.0,
        volumeStep: 0.01,
        digits: 2,
        point: 0.01,
        stopsLevel: 30, // 30 points (0.30)
        freezeLevel: 10,
        tradeMode: 'FULL_ACCESS',
        currencyBase: 'XAU',
        currencyProfit: 'USD',
        currencyMargin: 'USD',
        maxSpreadPoints: 45, // 0.45 max allowed spread
        defaultSpreadPoints: 20, // 0.20 standard spread
      },
      {
        symbol: 'XAUUSD.cent',
        name: 'Spot Gold Cent Account',
        category: 'METALS',
        contractSize: 100,
        tickSize: 0.01,
        tickValue: 0.01, // Cent scaling
        volumeMin: 0.01,
        volumeMax: 100.0,
        volumeStep: 0.01,
        digits: 2,
        point: 0.01,
        stopsLevel: 30,
        freezeLevel: 10,
        tradeMode: 'FULL_ACCESS',
        currencyBase: 'XAU',
        currencyProfit: 'USC',
        currencyMargin: 'USC',
        maxSpreadPoints: 45,
        defaultSpreadPoints: 20,
      },
      {
        symbol: 'EURUSD',
        name: 'Euro / US Dollar',
        category: 'FOREX',
        contractSize: 100000, // 100,000 units
        tickSize: 0.00001,
        tickValue: 1.00, // $1 per point on standard lot ($10 per pip)
        volumeMin: 0.01,
        volumeMax: 100.0,
        volumeStep: 0.01,
        digits: 5,
        point: 0.00001,
        stopsLevel: 20,
        freezeLevel: 10,
        tradeMode: 'FULL_ACCESS',
        currencyBase: 'EUR',
        currencyProfit: 'USD',
        currencyMargin: 'EUR',
        maxSpreadPoints: 25, // 2.5 pips max
        defaultSpreadPoints: 10, // 1.0 pip
      },
      {
        symbol: 'GBPUSD',
        name: 'Great British Pound / US Dollar',
        category: 'FOREX',
        contractSize: 100000,
        tickSize: 0.00001,
        tickValue: 1.00,
        volumeMin: 0.01,
        volumeMax: 100.0,
        volumeStep: 0.01,
        digits: 5,
        point: 0.00001,
        stopsLevel: 20,
        freezeLevel: 10,
        tradeMode: 'FULL_ACCESS',
        currencyBase: 'GBP',
        currencyProfit: 'USD',
        currencyMargin: 'GBP',
        maxSpreadPoints: 30,
        defaultSpreadPoints: 14,
      },
      {
        symbol: 'USDJPY',
        name: 'US Dollar / Japanese Yen',
        category: 'FOREX',
        contractSize: 100000,
        tickSize: 0.001,
        tickValue: 0.67, // approx USD equivalent
        volumeMin: 0.01,
        volumeMax: 100.0,
        volumeStep: 0.01,
        digits: 3,
        point: 0.001,
        stopsLevel: 20,
        freezeLevel: 10,
        tradeMode: 'FULL_ACCESS',
        currencyBase: 'USD',
        currencyProfit: 'JPY',
        currencyMargin: 'USD',
        maxSpreadPoints: 25,
        defaultSpreadPoints: 12,
      },
      {
        symbol: 'BTCUSD',
        name: 'Bitcoin / US Dollar',
        category: 'CRYPTO',
        contractSize: 1, // 1 BTC
        tickSize: 0.01,
        tickValue: 0.01,
        volumeMin: 0.01,
        volumeMax: 50.0,
        volumeStep: 0.01,
        digits: 2,
        point: 0.01,
        stopsLevel: 200,
        freezeLevel: 50,
        tradeMode: 'FULL_ACCESS',
        currencyBase: 'BTC',
        currencyProfit: 'USD',
        currencyMargin: 'USD',
        maxSpreadPoints: 5000, // $50 spread max
        defaultSpreadPoints: 1500, // $15 spread
      },
    ];

    defaultSpecs.forEach((spec) => {
      this.symbols.set(spec.symbol, spec);
    });
  }

  /**
   * Resolves any broker symbol variant to canonical symbol and execution spec
   */
  public resolveSymbol(inputSymbol: string): {
    canonicalSymbol: string;
    executionSymbol: string;
    isCentAccount: boolean;
    spec: SymbolSpecification;
  } {
    const raw = (inputSymbol || 'XAUUSD').trim();
    const upper = raw.toUpperCase();

    let canonical = 'XAUUSD';
    let isCent = false;

    if (upper.includes('XAU') || upper.includes('GOLD')) {
      canonical = 'XAUUSD';
      if (upper.includes('CENT') || upper.endsWith('.C')) {
        isCent = true;
      }
    } else if (upper.includes('EURUSD')) {
      canonical = 'EURUSD';
    } else if (upper.includes('GBPUSD')) {
      canonical = 'GBPUSD';
    } else if (upper.includes('USDJPY')) {
      canonical = 'USDJPY';
    } else if (upper.includes('BTC')) {
      canonical = 'BTCUSD';
    }

    const targetKey = isCent ? 'XAUUSD.cent' : canonical;
    const spec = this.symbols.get(targetKey) || this.symbols.get(canonical) || this.symbols.get('XAUUSD')!;

    return {
      canonicalSymbol: canonical,
      executionSymbol: raw,
      isCentAccount: isCent,
      spec,
    };
  }

  public getSymbol(symbol: string): SymbolSpecification {
    const clean = symbol.trim();
    if (this.symbols.has(clean)) {
      return this.symbols.get(clean)!;
    }

    // Try without prefix/suffix
    for (const [key, val] of this.symbols.entries()) {
      if (clean.includes(key) || key.includes(clean)) {
        return val;
      }
    }

    // Default fallback to Gold spec
    return this.symbols.get('XAUUSD')!;
  }

  public getAllSymbols(): SymbolSpecification[] {
    return Array.from(this.symbols.values());
  }

  public updateSymbolSpec(symbol: string, spec: Partial<SymbolSpecification>): SymbolSpecification {
    const existing = this.getSymbol(symbol);
    const updated: SymbolSpecification = {
      ...existing,
      ...spec,
      symbol: existing.symbol,
    };
    this.symbols.set(existing.symbol, updated);
    return updated;
  }
}

export const symbolService = new SymbolService();
