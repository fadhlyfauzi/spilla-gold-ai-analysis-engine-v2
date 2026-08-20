export class MacroCollectors {
  public fetchTradingEconomicsData() {
    return {
      usManufacturingPmi: 48.9, // Below 50 contraction -> Dovish Fed -> Gold Bullish
      usServicesPmi: 54.9,
      chinaPmi: 50.8,
      globalGrowthOutlook: 'SLOWER_SOFT_LANDING',
    };
  }

  public fetchBlsData() {
    return {
      cpiInflationYoY: 2.6,
      coreCpiYoY: 2.8,
      ppiYoY: 1.8,
      nfpJobsAdded: 185000,
      unemploymentRate: 4.1,
    };
  }

  public fetchBeaData() {
    return {
      gdpAnnualizedGrowth: 2.8,
      corePcePriceIndexYoY: 2.5,
      consumerSpendingGrowth: 2.1,
    };
  }

  public fetchTreasuryData() {
    return {
      treasury10YYield: 4.28,
      treasury2YYield: 4.12,
      realInterestRate: 1.82,
    };
  }
}

export const macroCollectors = new MacroCollectors();
