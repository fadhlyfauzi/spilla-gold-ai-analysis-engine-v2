import { FundamentalScore, FundamentalIndicator, SentimentType } from '../../src/types.js';
import { collectorManager } from '../collectors/index.js';
import { db } from '../db/database.js';

export class FundamentalEngine {
  public calculateScore(): FundamentalScore {
    const data = collectorManager.getAllCollectorData();
    const settings = db.getSettings();
    const weights = settings.fundamentalWeights;

    const indicators: FundamentalIndicator[] = [
      {
        id: 'FED_PROBABILITY',
        name: 'Fed Rate Cut Probability (CME)',
        category: 'MONETARY_POLICY',
        actual: `${data.fedWatch.probabilities.cut25bps}%`,
        forecast: '70.0%',
        previous: '65.0%',
        impact: 'HIGH',
        weight: weights.FED_PROBABILITY || 9,
        bias: 'BULLISH',
        description: `High 74.2% market probability of 25bps Fed interest rate cut weakens USD yields and drives non-yielding Gold demand.`,
      },
      {
        id: 'INTEREST_RATE',
        name: 'Federal Funds Rate',
        category: 'MONETARY_POLICY',
        actual: data.fedWatch.currentRate,
        forecast: '4.75%',
        previous: '5.00%',
        impact: 'HIGH',
        weight: weights.INTEREST_RATE || 10,
        bias: 'BULLISH',
        description: 'Easing monetary stance from the Federal Reserve lowers opportunity cost for holding Gold bullion.',
      },
      {
        id: 'INFLATION_CPI',
        name: 'US CPI Inflation Rate',
        category: 'INFLATION',
        actual: `${data.blsData.cpiInflationYoY}%`,
        forecast: '2.6%',
        previous: '2.9%',
        impact: 'HIGH',
        weight: weights.INFLATION_CPI || 9,
        bias: 'BULLISH',
        description: 'Persistent sticky inflation keeps real inflation hedge demand strong for Gold.',
      },
      {
        id: 'TREASURY_YIELD_10Y',
        name: '10-Year Real TIPS Yield',
        category: 'YIELDS',
        actual: `${data.fredData.tipsRealYield10Y}%`,
        forecast: '1.95%',
        previous: '2.10%',
        impact: 'HIGH',
        weight: weights.TREASURY_YIELD_10Y || 8,
        bias: 'BULLISH',
        description: 'Falling real interest rates historically exhibit strong +0.85 positive price correlation with spot Gold.',
      },
      {
        id: 'DOLLAR_INDEX',
        name: 'US Dollar Index (DXY)',
        category: 'CURRENCY',
        actual: `${data.dxyDetails.price}`,
        forecast: '104.50',
        previous: '104.80',
        impact: 'HIGH',
        weight: weights.DOLLAR_INDEX || 8,
        bias: 'BULLISH',
        description: 'Weakening DXY at 104.25 makes dollar-denominated gold cheaper for international central banks & purchasers.',
      },
      {
        id: 'NFP_JOBS',
        name: 'Non-Farm Payrolls (NFP)',
        category: 'LABOR_MARKET',
        actual: `${data.blsData.nfpJobsAdded}`,
        forecast: '160,000',
        previous: '142,000',
        impact: 'HIGH',
        weight: weights.NFP_JOBS || 7,
        bias: 'NEUTRAL',
        description: 'Moderate labor market softening keeps Fed on track for steady interest rate reductions.',
      },
      {
        id: 'GDP_GROWTH',
        name: 'US GDP Growth Annualized',
        category: 'GROWTH',
        actual: `${data.beaData.gdpAnnualizedGrowth}%`,
        forecast: '2.6%',
        previous: '3.0%',
        impact: 'HIGH',
        weight: weights.GDP_GROWTH || 7,
        bias: 'NEUTRAL',
        description: 'Soft-landing economic scenario supports gold physical jewelry demand while allowing monetary easing.',
      },
      {
        id: 'GOLD_ETF_FLOW',
        name: 'GLD ETF Net Inflows',
        category: 'INSTITUTIONAL_DEMAND',
        actual: `+${data.etfFlows.netFlowTonnes} Tonnes`,
        forecast: '+5.0 Tonnes',
        previous: '-1.2 Tonnes',
        impact: 'MEDIUM',
        weight: weights.GOLD_ETF_FLOW || 7,
        bias: 'BULLISH',
        description: 'Sustained institutional ETF capital inflows (+$758M) indicate growing Western fund allocation.',
      },
      {
        id: 'MONEY_SUPPLY_M2',
        name: 'US M2 Money Supply YoY',
        category: 'LIQUIDITY',
        actual: `+${data.fredData.m2GrowthYoY}%`,
        forecast: '+1.8%',
        previous: '+1.5%',
        impact: 'MEDIUM',
        weight: weights.MONEY_SUPPLY_M2 || 6,
        bias: 'BULLISH',
        description: 'Accelerating money supply expansion boosts sovereign currency debasement hedges.',
      },
      {
        id: 'MANUFACTURING_PMI',
        name: 'US ISM Manufacturing PMI',
        category: 'GROWTH',
        actual: `${data.macroData.usManufacturingPmi}`,
        forecast: '49.5',
        previous: '48.5',
        impact: 'MEDIUM',
        weight: weights.MANUFACTURING_PMI || 5,
        bias: 'BULLISH',
        description: 'Contractionary PMI (<50) reinforces industrial slowdown risks and safe-haven allocation.',
      },
    ];

    let totalWeight = 0;
    let weightedScoreSum = 0;

    indicators.forEach((ind) => {
      let scoreVal = 50;
      if (ind.bias === 'BULLISH') scoreVal = 85;
      if (ind.bias === 'BEARISH') scoreVal = 20;

      weightedScoreSum += scoreVal * ind.weight;
      totalWeight += ind.weight;
    });

    const finalScore = Math.round(weightedScoreSum / (totalWeight || 1));
    let status: SentimentType = 'NEUTRAL';
    if (finalScore >= 65) status = 'BULLISH';
    if (finalScore <= 35) status = 'BEARISH';

    const reasoning = [
      `CME FedWatch indicates a high ${data.fedWatch.probabilities.cut25bps}% probability of Fed monetary policy easing.`,
      `Falling US 10-Year Real TIPS Yields (1.82%) and weakening Dollar Index (DXY ${data.dxyDetails.price}) support spot gold prices.`,
      `Robust institutional GLD ETF inflows (+${data.etfFlows.netFlowTonnes} tonnes) and net central bank accumulation (+${data.centralBanks.netCentralBankPurchasesTonnesYtd}t) provide strong fundamental price floors.`,
    ];

    return {
      score: finalScore,
      status,
      indicators,
      reasoning,
    };
  }
}

export const fundamentalEngine = new FundamentalEngine();
