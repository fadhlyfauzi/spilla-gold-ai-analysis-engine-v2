import React, { useState, useEffect } from 'react';
import { AnalysisHistoryRecord } from '../types';
import { History, Search, Filter, CheckCircle, XCircle } from 'lucide-react';

export const HistoryView: React.FC = () => {
  const [records, setRecords] = useState<AnalysisHistoryRecord[]>([]);
  const [signalFilter, setSignalFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'WAIT'>('ALL');

  useEffect(() => {
    fetch('/api/history')
      .then((res) => res.json())
      .then((data) => setRecords(data || []))
      .catch((err) => console.error('Error fetching history:', err));
  }, []);

  const filtered = records.filter((rec) => {
    if (signalFilter === 'ALL') return true;
    if (signalFilter === 'BUY') return rec.recommendation === 'BUY' || rec.recommendation === 'STRONG_BUY';
    if (signalFilter === 'SELL') return rec.recommendation === 'SELL' || rec.recommendation === 'STRONG_SELL';
    return rec.recommendation === 'WAIT';
  });

  return (
    <div className="space-y-6 font-mono">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 text-xs font-bold mb-1">
            <History className="w-4 h-4" />
            <span>ANALYSIS ENGINE AUDIT LOG</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100">Historical Signal Snapshots & Track Record</h2>
          <p className="text-xs text-slate-400 mt-1">
            Historical audit log tracking all past SPILLA GOLD signals, entry prices, targets, and win-rate metrics.
          </p>
        </div>

        {/* Signal Filter */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-lg border border-slate-800 text-xs">
          <Filter className="w-4 h-4 text-slate-400 ml-1" />
          <span className="text-slate-500 mr-2 text-[10px] uppercase">Filter Signal:</span>
          {(['ALL', 'BUY', 'SELL', 'WAIT'] as const).map((sig) => (
            <button
              key={sig}
              onClick={() => setSignalFilter(sig)}
              className={`px-3 py-1 rounded font-bold cursor-pointer transition-colors ${
                signalFilter === sig
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {sig}
            </button>
          ))}
        </div>
      </div>

      {/* History Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Spot Price</th>
                <th className="py-3 px-4">Signal</th>
                <th className="py-3 px-4">Scores (F/T/S/AI)</th>
                <th className="py-3 px-4">Entry / SL / TP1</th>
                <th className="py-3 px-4">R : R</th>
                <th className="py-3 px-4">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.map((rec) => (
                <tr key={rec.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-400">
                    {new Date(rec.timestamp).toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-100">${rec.price.toFixed(2)}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rec.recommendation.includes('BUY')
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : rec.recommendation.includes('SELL')
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {rec.recommendation}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">
                    <span className="text-sky-400">{rec.fundamentalScore}</span> /{' '}
                    <span className="text-emerald-400">{rec.technicalScore}</span> /{' '}
                    <span className="text-amber-400">{rec.sentimentScore}</span> /{' '}
                    <span className="text-purple-400">{rec.aiConfidence}%</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-300">
                    ${rec.entryPrice} / <span className="text-rose-400">${rec.stopLoss}</span> /{' '}
                    <span className="text-emerald-400">${rec.takeProfit1}</span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-amber-400">1 : {rec.riskRewardRatio}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rec.status.includes('HIT_TP')
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : rec.status === 'HIT_SL'
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {rec.status} {rec.returnPips ? `(+${rec.returnPips} pips)` : ''}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
