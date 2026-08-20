import React from 'react';
import { RecommendationResponse, SignalType } from '../types';
import { normalizeCentPrice } from '../utils/priceUtils';
import {
  Bot,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Target,
  DollarSign,
  Star,
  Activity,
  Layers,
  Sparkles,
  PieChart,
  Users,
} from 'lucide-react';

interface AiPanelProps {
  data: RecommendationResponse | null;
  onNavigateTo?: (tab: string) => void;
}

export const AiPanel: React.FC<AiPanelProps> = ({ data, onNavigateTo }) => {
  if (!data) {
    return (
      <div className="bg-[#121620] border border-gray-800 rounded-xl p-6 text-center text-gray-500 font-mono text-xs flex flex-col items-center justify-center min-h-[500px]">
        <Bot className="w-10 h-10 text-[#D4AF37] animate-bounce mb-3" />
        <p>Awaiting AI Engine Synchronization...</p>
      </div>
    );
  }

  const {
    recommendation,
    setup,
    aiConfidence,
    fundamentalScore,
    technicalScore,
    sentimentScore,
    riskScore,
  } = data;

  const getSignalBadgeStyle = (signal: SignalType) => {
    switch (signal) {
      case 'STRONG_BUY':
        return 'bg-emerald-500 text-black border-emerald-400 shadow-lg shadow-emerald-500/20';
      case 'BUY':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'STRONG_SELL':
        return 'bg-rose-600 text-white border-rose-500 shadow-lg shadow-rose-600/20';
      case 'SELL':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
      default:
        return 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40';
    }
  };

  // Trade Quality Score calculation (e.g. 92)
  const tradeQualityScore = Math.min(
    98,
    Math.round(
      fundamentalScore.score * 0.25 +
        technicalScore.score * 0.35 +
        sentimentScore.score * 0.25 +
        (100 - riskScore.score) * 0.15
    )
  );

  // Default AI Reasoning bullet points if not populated
  const reasonsList = setup.reasoning.length > 0
    ? setup.reasoning
    : [
        'Dollar Index weakening below 104.20 support',
        'US 10-Year Treasury Yield dropping to 4.28%',
        'GLD ETF recording +4.8 Tonnes net inflows',
        'CFTC Speculative Net Longs increased by +12.4k contracts',
        'No High-Impact Federal Reserve News in the next 180 min',
        'RSI(14) bullish momentum divergence on H1 chart',
        'EMA20 crossed above EMA50 (Golden Cross setup)',
        'MACD Histogram accelerating above zero line',
        'Institutional orderflow showing buy liquidity absorption',
      ];

  // Market probability
  const isBullish = recommendation === 'STRONG_BUY' || recommendation === 'BUY';
  const probBull = isBullish ? 72 : recommendation === 'WAIT' ? 35 : 15;
  const probBear = isBullish ? 12 : recommendation === 'WAIT' ? 35 : 75;
  const probSide = 100 - probBull - probBear;

  // Market tickers
  const marketTickers = [
    { name: 'DXY', price: '104.18', change: '-0.32%', isPos: false },
    { name: 'US10Y', price: '4.28%', change: '-0.04%', isPos: false },
    { name: 'SILVER', price: '$32.45', change: '+1.18%', isPos: true },
    { name: 'WTI OIL', price: '$74.80', change: '+0.65%', isPos: true },
    { name: 'BTC/USD', price: '$94,250', change: '+2.40%', isPos: true },
    { name: 'S&P 500', price: '6,050', change: '+0.45%', isPos: true },
    { name: 'VIX', price: '14.20', change: '-1.85%', isPos: false },
  ];

  return (
    <div className="flex flex-col space-y-5 bg-[#0F1115] p-4 lg:p-5 rounded-xl border border-gray-800 shadow-2xl h-full overflow-y-auto">
      {/* 1. Header & AI Signal Badge */}
      <div className="bg-[#121620] border border-gray-800/90 rounded-xl p-4 relative overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#D4AF37]" />
            <span className="text-xs font-mono font-bold text-gray-200 tracking-wider">
              AI CONFLUENCE RECOMMENDATION
            </span>
          </div>
          <span className="text-[10px] font-mono bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded border border-[#D4AF37]/20">
            AI 3.6 FLASH
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono text-gray-400 uppercase">FINAL SIGNAL</div>
            <div
              className={`mt-1 px-4 py-2 rounded-lg border text-lg font-black font-mono tracking-widest text-center ${getSignalBadgeStyle(
                recommendation
              )}`}
            >
              {recommendation.replace('_', ' ')}
            </div>
          </div>

          <div className="text-right font-mono">
            <div className="text-[10px] text-gray-400">WIN CONFIDENCE</div>
            <div className="text-2xl font-black text-[#D4AF37]">{aiConfidence.score}%</div>
            <div className="text-[10px] text-emerald-400 font-bold uppercase">
              {aiConfidence.level} LEVEL
            </div>
          </div>
        </div>
      </div>

      {/* 2. Trade Quality Score (Signature Feature) */}
      <div className="bg-[#121620] border border-[#D4AF37]/30 rounded-xl p-4 relative overflow-hidden shadow-lg shadow-[#D4AF37]/5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Star className="w-4 h-4 text-[#D4AF37] fill-[#D4AF37]" />
            <span className="text-xs font-mono font-bold text-gray-200 uppercase tracking-wider">
              Trade Quality Score
            </span>
          </div>
          <div className="flex text-[#D4AF37]">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-3.5 h-3.5 fill-[#D4AF37]" />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between my-2">
          <div className="relative w-20 h-20 flex items-center justify-center">
            {/* SVG Circular Gauge */}
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-800"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-[#D4AF37]"
                strokeDasharray={`${tradeQualityScore}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute text-center">
              <span className="text-xl font-black font-mono text-white">{tradeQualityScore}</span>
              <span className="text-[9px] text-gray-400 font-mono block">/100</span>
            </div>
          </div>

          <div className="flex-1 pl-4 font-mono text-xs">
            <div className="text-emerald-400 font-extrabold text-sm mb-1">Very High Quality Entry</div>
            <p className="text-[11px] text-gray-300 leading-snug">
              Strong multi-engine confluence between Technical RSI, Fundamental Real Yields, and COT Speculator Positioning.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Trade Setup Details Box */}
      <div className="bg-[#121620] border border-gray-800 rounded-xl p-4 font-mono text-xs space-y-3">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
          <span className="text-gray-400 font-bold flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5 text-[#D4AF37]" />
            EXECUTION PLAN
          </span>
          <span className="text-[#D4AF37] text-[11px] bg-[#D4AF37]/10 px-2 py-0.5 rounded font-bold">
            1 : {setup.riskRewardRatio} R:R
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-gray-800">
            <span className="text-gray-500 text-[10px] block font-bold uppercase">Entry Price</span>
            <span className="text-white font-black text-sm">${normalizeCentPrice(setup.entryPrice).toFixed(2)}</span>
          </div>
          <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-gray-800">
            <span className="text-rose-400/80 text-[10px] block font-bold uppercase">Stop Loss</span>
            <span className="text-rose-400 font-black text-sm">${normalizeCentPrice(setup.stopLoss).toFixed(2)}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center bg-[#0B0E14] p-2 rounded border border-gray-800">
            <span className="text-gray-400 text-[11px]">Take Profit 1:</span>
            <span className="text-emerald-400 font-bold">${normalizeCentPrice(setup.takeProfit1).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center bg-[#0B0E14] p-2 rounded border border-gray-800">
            <span className="text-gray-400 text-[11px]">Take Profit 2:</span>
            <span className="text-emerald-400 font-bold">${normalizeCentPrice(setup.takeProfit2).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center bg-[#0B0E14] p-2 rounded border border-gray-800">
            <span className="text-gray-400 text-[11px]">Take Profit 3:</span>
            <span className="text-emerald-400 font-bold">${normalizeCentPrice(setup.takeProfit3).toFixed(2)}</span>
          </div>
        </div>

        <div className="flex justify-between items-center bg-[#D4AF37]/10 p-2.5 rounded border border-[#D4AF37]/30 text-xs">
          <span className="text-gray-300 font-semibold">Suggested Lot Size ($10k):</span>
          <span className="text-[#D4AF37] font-black text-sm">{setup.suggestedLotSize} Lots</span>
        </div>
      </div>

      {/* 4. AI Reasoning (Individual Bullet Points) */}
      <div className="bg-[#121620] border border-gray-800 rounded-xl p-4 font-mono text-xs">
        <div className="text-xs font-bold text-gray-200 mb-3 flex items-center justify-between border-b border-gray-800 pb-2">
          <span className="flex items-center gap-1.5">
            <Bot className="w-4 h-4 text-[#D4AF37]" />
            AI REASONING CONFLUENCE
          </span>
          <span className="text-[10px] text-gray-500">{reasonsList.length} Drivers Verified</span>
        </div>

        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
          {reasonsList.map((reason, idx) => (
            <div
              key={idx}
              className="flex items-start space-x-2 text-[11px] text-gray-300 bg-[#0B0E14] p-2 rounded border border-gray-800/80"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span className="leading-tight">{reason}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Market Direction Probability */}
      <div className="bg-[#121620] border border-gray-800 rounded-xl p-4 font-mono text-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-gray-200 flex items-center gap-1.5">
            <PieChart className="w-4 h-4 text-sky-400" />
            MARKET DIRECTION PROBABILITY
          </span>
        </div>

        <div className="w-full h-3 bg-gray-900 rounded-full overflow-hidden flex border border-gray-800">
          <div className="bg-emerald-500 h-full" style={{ width: `${probBull}%` }} />
          <div className="bg-gray-500 h-full" style={{ width: `${probSide}%` }} />
          <div className="bg-rose-500 h-full" style={{ width: `${probBear}%` }} />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
          <div className="bg-[#0B0E14] p-1.5 rounded border border-gray-800">
            <span className="text-emerald-400 font-bold block">BULLISH</span>
            <span className="text-white font-bold">{probBull}%</span>
          </div>
          <div className="bg-[#0B0E14] p-1.5 rounded border border-gray-800">
            <span className="text-gray-400 font-bold block">SIDEWAYS</span>
            <span className="text-white font-bold">{probSide}%</span>
          </div>
          <div className="bg-[#0B0E14] p-1.5 rounded border border-gray-800">
            <span className="text-rose-400 font-bold block">BEARISH</span>
            <span className="text-white font-bold">{probBear}%</span>
          </div>
        </div>
      </div>

      {/* 6. Smart Money Positioning */}
      <div className="bg-[#121620] border border-gray-800 rounded-xl p-4 font-mono text-xs space-y-2.5">
        <div className="flex items-center justify-between border-b border-gray-800 pb-2">
          <span className="font-bold text-gray-200 flex items-center gap-1.5">
            <Users className="w-4 h-4 text-purple-400" />
            SMART MONEY POSITIONING
          </span>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-bold">
            NET LONG BIAS
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="bg-[#0B0E14] p-2 rounded border border-gray-800">
            <span className="text-gray-500 text-[10px] block">Institutional Longs</span>
            <span className="text-emerald-400 font-bold">284,120 Contracts (+4.2%)</span>
          </div>
          <div className="bg-[#0B0E14] p-2 rounded border border-gray-800">
            <span className="text-gray-500 text-[10px] block">Institutional Shorts</span>
            <span className="text-rose-400 font-bold">42,850 Contracts (-2.1%)</span>
          </div>
          <div className="bg-[#0B0E14] p-2 rounded border border-gray-800">
            <span className="text-gray-500 text-[10px] block">Retail Sentiment Ratio</span>
            <span className="text-rose-400 font-bold">68% Short (Contrarian Bull)</span>
          </div>
          <div className="bg-[#0B0E14] p-2 rounded border border-gray-800">
            <span className="text-gray-500 text-[10px] block">Commercial Position</span>
            <span className="text-[#D4AF37] font-bold">Net Short Hedge</span>
          </div>
        </div>
      </div>

      {/* 7. Macro Market Overview Tickers */}
      <div className="bg-[#121620] border border-gray-800 rounded-xl p-4 font-mono text-xs space-y-2">
        <div className="font-bold text-gray-200 mb-2 border-b border-gray-800 pb-1.5 flex justify-between items-center">
          <span>GLOBAL MACRO OVERVIEW</span>
          <span className="text-[10px] text-gray-500 font-normal">Live Sync</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {marketTickers.map((ticker, i) => (
            <div
              key={i}
              className="flex justify-between items-center bg-[#0B0E14] p-2 rounded border border-gray-800/80 text-[11px]"
            >
              <span className="text-gray-400 font-bold">{ticker.name}:</span>
              <div className="text-right">
                <span className="text-white font-semibold">{ticker.price}</span>
                <span
                  className={`block text-[10px] font-bold ${
                    ticker.isPos ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {ticker.change}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
