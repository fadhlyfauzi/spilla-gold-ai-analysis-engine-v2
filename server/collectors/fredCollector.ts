export class FredCollector {
  public fetchYieldsAndMacro() {
    return {
      treasury10Y: 4.28,
      treasury2Y: 4.12,
      yieldCurveInversion: -0.16, // Steepening out of inversion
      tipsRealYield10Y: 1.82, // Inverse driver for Gold
      moneySupplyM2Billions: 21250, // $21.25T (+0.4% MoM)
      m2GrowthYoY: 2.1,
      timestamp: new Date().toISOString(),
    };
  }
}

export const fredCollector = new FredCollector();
