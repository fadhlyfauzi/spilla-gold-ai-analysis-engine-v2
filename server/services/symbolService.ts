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
        minLot: 0.01,
        maxLot: 100.0,
        lotStep: 0.01,
        maxTestLot: 0.01, // Phase 1 Hard Safety Cap
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
        symbol: 'XAUUSD.CENT',
        name: 'Spot Gold Cent Account',
        category: 'METALS',
        contractSize: 100,
        tickSize: 0.01,
        tickValue: 0.01, // Cent scaling
        volumeMin: 0.01,
        volumeMax: 100.0,
        volumeStep: 0.01,
        minLot: 0.01,
        maxLot: 100.0,
        lotStep: 0.01,
        maxTestLot: 0.01,
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
        minLot: 0.01,
        maxLot: 100.0,
        lotStep: 0.01,
        maxTestLot: 0.01,
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
        minLot: 0.01,
        maxLot: 100.0,
        lotStep: 0.01,
        maxTestLot: 0.01,
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
        tickValue: 0.67, // approx USD equivalent per point
        volumeMin: 0.01,
        volumeMax: 100.0,
        volumeStep: 0.01,
        minLot: 0.01,
        maxLot: 100.0,
        lotStep: 0.01,
        maxTestLot: 0.01,
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
        tickValue: 0.01, // $0.01 per 0.01 price move ($1 per $1 move for 1 BTC)
        volumeMin: 0.01,
        volumeMax: 10.0,
        volumeStep: 0.01,
        minLot: 0.01,
        maxLot: 10.0,
        lotStep: 0.01,
        maxTestLot: 0.01,
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
      this.symbols.set(spec.symbol.toUpperCase(), spec);
    });

    // Also register lowercase alias for cent
    const centSpec = this.symbols.get('XAUUSD.CENT')!;
    this.symbols.set('XAUUSD.cent', centSpec);
  }

  /**
   * Resolves any broker symbol variant or string to its canonical symbol and execution spec
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

    if (upper.includes('BTC')) {
      canonical = 'BTCUSD';
    } else if (upper.includes('EURUSD')) {
      canonical = 'EURUSD';
    } else if (upper.includes('GBPUSD')) {
      canonical = 'GBPUSD';
    } else if (upper.includes('USDJPY')) {
      canonical = 'USDJPY';
    } else if (upper.includes('XAU') || upper.includes('GOLD')) {
      if (upper.includes('CENT') || upper.endsWith('.C')) {
        canonical = 'XAUUSD.CENT';
        isCent = true;
      } else {
        canonical = 'XAUUSD';
      }
    }

    const spec = this.getSymbol(canonical);

    return {
      canonicalSymbol: canonical,
      executionSymbol: raw,
      isCentAccount: isCent,
      spec,
    };
  }

  /**
   * Maps a canonical symbol (e.g. BTCUSD, XAUUSD, EURUSD) to the broker-specific symbol.
   * Leverages the broker account's naming convention or suffix (e.g., .edge, .c, m).
   */
  public mapCanonicalToBroker(canonicalSymbol: string, accountSymbolOrBroker?: string): string {
    const cleanCanonical = canonicalSymbol ? canonicalSymbol.trim().toUpperCase() : 'XAUUSD';
    if (!accountSymbolOrBroker || !accountSymbolOrBroker.trim()) {
      return cleanCanonical === 'XAUUSD.CENT' ? 'XAUUSD.cent' : cleanCanonical;
    }

    const accountSym = accountSymbolOrBroker.trim();

    // If accountSym directly matches the canonical base
    const upperAccount = accountSym.toUpperCase();
    if (upperAccount.startsWith(cleanCanonical) || (cleanCanonical === 'BTCUSD' && upperAccount.includes('BTC'))) {
      return accountSym;
    }

    // Detect common broker suffixes from account symbol (e.g., "XAUUSD.edge" -> suffix is ".edge")
    const matchSuffix = accountSym.match(/\.(edge|pro|raw|ecn|c|cent|std|micro)$/i) || accountSym.match(/(m|c)$/i);
    const suffix = matchSuffix ? matchSuffix[0] : '';

    if (cleanCanonical === 'XAUUSD.CENT') {
      if (suffix.toLowerCase() === '.c' || suffix.toLowerCase() === 'c') {
        return `XAUUSD${suffix}`;
      }
      return 'XAUUSD.cent';
    }

    if (suffix) {
      return `${cleanCanonical}${suffix}`;
    }

    return cleanCanonical;
  }

  public getSymbol(symbol: string): SymbolSpecification {
    const clean = (symbol || 'XAUUSD').trim().toUpperCase();
    if (this.symbols.has(clean)) {
      return this.symbols.get(clean)!;
    }

    // Try without prefix/suffix
    for (const [key, val] of this.symbols.entries()) {
      const upperKey = key.toUpperCase();
      if (clean.includes(upperKey) || upperKey.includes(clean)) {
        return val;
      }
    }

    // Fallback based on asset class keywords
    if (clean.includes('BTC')) return this.symbols.get('BTCUSD')!;
    if (clean.includes('EUR')) return this.symbols.get('EURUSD')!;
    if (clean.includes('GBP')) return this.symbols.get('GBPUSD')!;
    if (clean.includes('JPY')) return this.symbols.get('USDJPY')!;
    if (clean.includes('CENT') || clean.endsWith('.C')) return this.symbols.get('XAUUSD.CENT')!;

    // Default fallback to Gold spec
    return this.symbols.get('XAUUSD')!;
  }

  public getAllSymbols(): SymbolSpecification[] {
    // Return unique canonical specifications
    const canonicalKeys = ['XAUUSD', 'XAUUSD.CENT', 'EURUSD', 'GBPUSD', 'USDJPY', 'BTCUSD'];
    return canonicalKeys.map((key) => this.symbols.get(key)!).filter(Boolean);
  }

  public updateSymbolSpec(symbol: string, spec: Partial<SymbolSpecification>): SymbolSpecification {
    const existing = this.getSymbol(symbol);
    const updated: SymbolSpecification = {
      ...existing,
      ...spec,
      symbol: existing.symbol,
    };
    this.symbols.set(existing.symbol, updated);
    this.symbols.set(existing.symbol.toUpperCase(), updated);
    return updated;
  }
}

export const symbolService = new SymbolService();

