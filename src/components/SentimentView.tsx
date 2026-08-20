import React from 'react';
import { SentimentScore } from '../types';
import { SmilePlus, Users, Building2, BarChart2, Info } from 'lucide-react';

interface SentimentViewProps {
  sentimentData: SentimentScore | null;
}

export const SentimentView: React.FC<SentimentViewProps> = ({ sentimentData }) => {
  if (!sentimentData) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono animate-pulse">
        Loading Market Sentiment Engine...
      </div>
    );
  }

  const { score, status, cot, etf, newsSentiment, reasoning } = sentimentData;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 font-mono text-xs font-bold mb-1">
            <SmilePlus className="w-4 h-4" />
            <span>INSTITUTIONAL & RETAIL SENTIMENT ENGINE</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 font-mono">
            CFTC COT Report, ETF Flows & News Sentiment
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            CFTC Gold Futures positioning from commercial hedgers and speculative funds, physical ETF inflows, and financial news AI sentiment aggregation.
          </p>
        </div>

        <div className="flex items-center space-x-6 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Sentiment Score</span>
            <span className="text-3xl font-extrabold text-amber-400">{score}/100</span>
          </div>
          <div className="border-l border-slate-800 pl-6">
            <span className="text-[10px] text-slate-500 block uppercase">Market Bias</span>
            <span className="text-sm font-bold text-emerald-400 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 inline-block mt-0.5">
              {status}
            </span>
          </div>
        </div>
      </div>

      {/* COT & ETF Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
        {/* CFTC COT Report Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-bold text-slate-200 uppercase mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <span>CFTC Commitment of Traders (COT) - Gold Futures</span>
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400">Non-Commercial Speculators Net Longs:</span>
              <span className="text-emerald-400 font-bold">
                +{cot.netPositionSpeculators.toLocaleString()} Contracts
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400">Weekly Change in Speculative Longs:</span>
              <span className="text-emerald-400 font-bold">
                +{cot.changeFromLastWeek.toLocaleString()} Contracts
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400">Commercial Hedgers Short Position:</span>
              <span className="text-rose-400 font-bold">
                -{cot.commercialShorts.toLocaleString()} Contracts
              </span>
            </div>
          </div>
        </div>

        {/* Physical GLD ETF Capital Inflows */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-bold text-slate-200 uppercase mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-sky-400" />
            <span>Global Gold ETF Physical Holdings & Capital Inflows</span>
          </h3>

          <div className="space-y-3">
            <div className="flex justify-between items-center p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400">Total GLD Physical Holdings:</span>
              <span className="text-slate-100 font-bold">{etf.gldHoldingsTonnes} Tonnes</span>
            </div>

            <div className="flex justify-between items-center p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400">Net Physical Inflow:</span>
              <span className="text-emerald-400 font-bold">+{etf.netFlowTonnes} Tonnes</span>
            </div>

            <div className="flex justify-between items-center p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400">USD Value Allocation:</span>
              <span className="text-emerald-400 font-bold">
                +${etf.netFlowUsdMillions} Million
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* News Sentiment Breakdown */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 font-mono text-xs">
        <h3 className="text-xs font-bold text-slate-200 uppercase mb-4 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-emerald-400" />
          <span>Financial News AI Sentiment Distribution</span>
        </h3>

        <div className="grid grid-cols-3 gap-3 mb-4 text-center">
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg">
            <span className="text-slate-400 block text-[10px]">BULLISH ARTICLES</span>
            <span className="text-2xl font-bold text-emerald-400">{newsSentiment.bullishPercent}%</span>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg">
            <span className="text-slate-400 block text-[10px]">NEUTRAL ARTICLES</span>
            <span className="text-2xl font-bold text-amber-400">{newsSentiment.neutralPercent}%</span>
          </div>
          <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg">
            <span className="text-slate-400 block text-[10px]">BEARISH ARTICLES</span>
            <span className="text-2xl font-bold text-rose-400">{newsSentiment.bearishPercent}%</span>
          </div>
        </div>

        <div className="space-y-2 text-slate-300 font-sans text-xs">
          {reasoning.map((r, i) => (
            <div key={i} className="flex items-start space-x-2 bg-slate-950 p-2.5 rounded border border-slate-800">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{r}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
