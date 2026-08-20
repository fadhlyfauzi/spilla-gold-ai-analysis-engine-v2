import React from 'react';
import { FundamentalScore } from '../types';
import { Globe, ArrowUpRight, ArrowDownRight, Scale, Info } from 'lucide-react';

interface FundamentalViewProps {
  fundamentalData: FundamentalScore | null;
}

export const FundamentalView: React.FC<FundamentalViewProps> = ({ fundamentalData }) => {
  if (!fundamentalData) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono animate-pulse">
        Loading Fundamental Analysis Engine...
      </div>
    );
  }

  const { score, status, indicators, reasoning } = fundamentalData;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2 text-sky-400 font-mono text-xs font-bold mb-1">
            <Globe className="w-4 h-4" />
            <span>GLOBAL MACRO & FUNDAMENTAL ENGINE</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 font-mono">
            Macroeconomic Indicator Scoring Breakdown
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Sovereign interest rate differentials, inflation expectations, real bond yields, dollar strength, and institutional gold demand.
          </p>
        </div>

        <div className="flex items-center space-x-6 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Overall Score</span>
            <span className="text-3xl font-extrabold text-sky-400">{score}/100</span>
          </div>
          <div className="border-l border-slate-800 pl-6">
            <span className="text-[10px] text-slate-500 block uppercase">Macro Bias</span>
            <span className="text-sm font-bold text-emerald-400 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 inline-block mt-0.5">
              {status}
            </span>
          </div>
        </div>
      </div>

      {/* Primary Fundamental Indicators Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-200 font-mono uppercase tracking-wider">
            15 Key Fundamental Indicators & Impact Weights
          </h3>
          <span className="text-[10px] text-slate-400 font-mono">
            Dynamic Weights Active
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Indicator</th>
                <th className="py-3 px-4">Actual</th>
                <th className="py-3 px-4">Forecast</th>
                <th className="py-3 px-4">Previous</th>
                <th className="py-3 px-4">Impact</th>
                <th className="py-3 px-4">Weight</th>
                <th className="py-3 px-4">Gold Bias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {indicators.map((ind) => (
                <tr key={ind.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-slate-100">
                    <div>{ind.name}</div>
                    <div className="text-[10px] text-slate-500 font-normal">{ind.description}</div>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-amber-400">{ind.actual}</td>
                  <td className="py-3.5 px-4 text-slate-400">{ind.forecast}</td>
                  <td className="py-3.5 px-4 text-slate-500">{ind.previous}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ind.impact === 'HIGH'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {ind.impact}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-200">{ind.weight}/10</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        ind.bias === 'BULLISH'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : ind.bias === 'BEARISH'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {ind.bias}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fundamental Reasoning Box */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-xs font-bold text-slate-200 font-mono uppercase mb-3 flex items-center gap-2">
          <Info className="w-4 h-4 text-sky-400" />
          <span>Fundamental Engine Reasoning Summary</span>
        </h3>
        <div className="space-y-2 text-xs text-slate-300 font-sans">
          {reasoning.map((r, i) => (
            <div key={i} className="flex items-start space-x-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-sky-400 font-bold font-mono">#{i + 1}</span>
              <p className="leading-relaxed">{r}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
