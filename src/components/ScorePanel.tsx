import React from 'react';
import { RecommendationResponse } from '../types';
import {
  Globe2,
  Gauge,
  BarChart2,
  ShieldAlert,
  Bot,
  Star,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

interface ScorePanelProps {
  data: RecommendationResponse | null;
  onNavigateTo: (tab: string) => void;
}

export const ScorePanel: React.FC<ScorePanelProps> = ({ data, onNavigateTo }) => {
  if (!data) return null;

  const {
    fundamentalScore,
    technicalScore,
    sentimentScore,
    riskScore,
    aiConfidence,
  } = data;

  const tradeQualityScore = Math.min(
    98,
    Math.round(
      fundamentalScore.score * 0.25 +
        technicalScore.score * 0.35 +
        sentimentScore.score * 0.25 +
        (100 - riskScore.score) * 0.15
    )
  );

  const scores = [
    {
      id: 'fundamental',
      title: 'FUNDAMENTAL SCORE',
      score: fundamentalScore.score,
      status: fundamentalScore.status,
      icon: Globe2,
      color: 'sky',
      barColor: 'bg-sky-400',
      reason: 'Fed Rate Probabilities, CPI Inflation & TIPS Real Yields',
      trend: '+2.4%',
      isPos: true,
      nav: 'fundamental',
    },
    {
      id: 'technical',
      title: 'TECHNICAL SCORE',
      score: technicalScore.score,
      status: technicalScore.status,
      icon: Gauge,
      color: 'emerald',
      barColor: 'bg-emerald-400',
      reason: 'RSI(14), MACD Golden Cross & Multi-TF Confluence',
      trend: '+4.1%',
      isPos: true,
      nav: 'technical',
    },
    {
      id: 'sentiment',
      title: 'MARKET SENTIMENT',
      score: sentimentScore.score,
      status: sentimentScore.status,
      icon: BarChart2,
      color: 'amber',
      barColor: 'bg-[#D4AF37]',
      reason: 'CFTC Speculator Net Longs & GLD ETF Inflows',
      trend: '+1.8%',
      isPos: true,
      nav: 'sentiment',
    },
    {
      id: 'risk',
      title: 'RISK SCORE',
      score: riskScore.score,
      status: riskScore.level,
      icon: ShieldAlert,
      color: 'rose',
      barColor: 'bg-rose-400',
      reason: 'ATR Volatility, Bid/Ask Spread & Macro Event Proximity',
      trend: '-1.2%',
      isPos: false,
      nav: 'engine_settings',
    },
    {
      id: 'confidence',
      title: 'AI CONFIDENCE',
      score: aiConfidence.score,
      status: aiConfidence.level,
      icon: Bot,
      color: 'purple',
      barColor: 'bg-purple-400',
      reason: 'AI 3.6 Cross-Model Confluence & Narrative Fit',
      trend: '+3.5%',
      isPos: true,
      nav: 'ai_recommendation',
    },
    {
      id: 'trade_quality',
      title: 'TRADE QUALITY SCORE',
      score: tradeQualityScore,
      status: 'VERY HIGH',
      icon: Star,
      color: 'gold',
      barColor: 'bg-amber-400',
      reason: 'Overall Trade Execution Quality & R:R Probability',
      trend: '★★★★★',
      isPos: true,
      nav: 'ai_recommendation',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 font-mono">
      {scores.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.id}
            onClick={() => onNavigateTo(s.nav)}
            className="bg-[#121620] hover:bg-[#181E2C] border border-gray-800 hover:border-gray-700 rounded-xl p-4 cursor-pointer transition-all flex flex-col justify-between group shadow-lg"
          >
            <div>
              {/* Header: Title & Status Badge */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-1.5 text-gray-300 text-[10px] font-bold tracking-wider">
                  <Icon className="w-3.5 h-3.5 text-[#D4AF37]" />
                  <span>{s.title}</span>
                </div>
                <ArrowUpRight className="w-3 h-3 text-gray-600 group-hover:text-[#D4AF37] transition-colors" />
              </div>

              {/* Score Value & Circular/Progress Gauge */}
              <div className="flex items-baseline justify-between my-2">
                <div className="text-2xl font-black text-white tracking-tight">
                  {s.score}
                  <span className="text-xs text-gray-500 font-normal">/100</span>
                </div>

                <div className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-800 text-[#D4AF37] border border-gray-700">
                  {s.status}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-1.5 rounded-full bg-[#0B0E14] mb-2 overflow-hidden border border-gray-800">
                <div
                  className={`h-full ${s.barColor} rounded-full transition-all duration-500`}
                  style={{ width: `${s.score}%` }}
                />
              </div>
            </div>

            {/* Sub-text reason & trend */}
            <div className="mt-2 pt-2 border-t border-gray-800/80 flex items-center justify-between text-[10px] text-gray-400">
              <span className="line-clamp-1 pr-2">{s.reason}</span>
              <span
                className={`font-bold shrink-0 ${
                  s.isPos ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {s.trend}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
