import React from 'react';
import { TechnicalScore } from '../types';
import { Gauge, Activity, ShieldCheck, Layers, Cpu } from 'lucide-react';
import { normalizeCentPrice } from '../utils/priceUtils';

interface TechnicalViewProps {
  technicalData: TechnicalScore | null;
}

export const TechnicalView: React.FC<TechnicalViewProps> = ({ technicalData }) => {
  if (!technicalData) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono animate-pulse">
        Loading Technical Analysis Engine...
      </div>
    );
  }

  const {
    score,
    status,
    rsi,
    macd,
    ema20,
    ema50,
    ema200,
    sma50,
    sma200,
    atr14,
    adx14,
    pivotPoints,
    timeframeAnalysis,
    reasoning,
  } = technicalData;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs font-bold mb-1">
            <Gauge className="w-4 h-4" />
            <span>QUANTITATIVE TECHNICAL ENGINE</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 font-mono">
            Technical Indicator & Multi-Timeframe Confluence
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Mathematical trend analysis combining momentum oscillators, moving average ribbons, ATR volatility, and classic/Fibonacci pivot levels.
          </p>
        </div>

        <div className="flex items-center space-x-6 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Technical Score</span>
            <span className="text-3xl font-extrabold text-emerald-400">{score}/100</span>
          </div>
          <div className="border-l border-slate-800 pl-6">
            <span className="text-[10px] text-slate-500 block uppercase">Overall Signal</span>
            <span className="text-sm font-bold text-emerald-400 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 inline-block mt-0.5">
              {status}
            </span>
          </div>
        </div>
      </div>

      {/* Technical Oscillators Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        {/* RSI(14) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block mb-1">RSI (14-PERIOD)</span>
          <div className="text-2xl font-bold text-slate-100 mb-1">{rsi.value}</div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              rsi.signal === 'BULLISH'
                ? 'bg-emerald-500/10 text-emerald-400'
                : rsi.signal === 'BEARISH'
                ? 'bg-rose-500/10 text-rose-400'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {rsi.signal}
          </span>
        </div>

        {/* MACD */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block mb-1">MACD HISTOGRAM</span>
          <div className="text-2xl font-bold text-slate-100 mb-1">+{macd.histogram}</div>
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
              macd.signal === 'BULLISH'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'bg-rose-500/10 text-rose-400'
            }`}
          >
            {macd.signal}
          </span>
        </div>

        {/* ADX Trend Strength */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block mb-1">ADX (14) TREND STRENGTH</span>
          <div className="text-2xl font-bold text-slate-100 mb-1">{adx14}</div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">
            STRONG TREND (&gt;25)
          </span>
        </div>

        {/* ATR Volatility */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <span className="text-xs text-slate-400 block mb-1">ATR (14) VOLATILITY</span>
          <div className="text-2xl font-bold text-slate-100 mb-1">${atr14.toFixed(2)}</div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-400">
            MODERATE VOLATILITY
          </span>
        </div>
      </div>

      {/* Moving Averages & Pivot Points Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
        {/* Moving Averages Ribbon */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-bold text-slate-200 uppercase mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Exponential & Simple Moving Averages</span>
          </h3>

          <div className="space-y-2">
            <div className="flex justify-between items-center p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400">EMA 20 (Short Term):</span>
              <span className="text-slate-100 font-bold">${normalizeCentPrice(ema20).toFixed(2)}</span>
              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                BULLISH
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400">EMA 50 (Medium Term):</span>
              <span className="text-slate-100 font-bold">${normalizeCentPrice(ema50).toFixed(2)}</span>
              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                BULLISH
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400">EMA 200 (Long Term Baseline):</span>
              <span className="text-slate-100 font-bold">${normalizeCentPrice(ema200).toFixed(2)}</span>
              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                BULLISH
              </span>
            </div>

            <div className="flex justify-between items-center p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400">SMA 50:</span>
              <span className="text-slate-100 font-bold">${normalizeCentPrice(sma50).toFixed(2)}</span>
              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                BULLISH
              </span>
            </div>
          </div>
        </div>

        {/* Pivot Points Classic / Fibonacci */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h3 className="text-xs font-bold text-slate-200 uppercase mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Classic Support & Resistance Pivot Levels</span>
          </h3>

          <div className="space-y-2">
            <div className="flex justify-between items-center p-2 bg-rose-500/5 text-rose-400 rounded border border-rose-500/20">
              <span>Resistance 3 (R3):</span>
              <span className="font-bold">${normalizeCentPrice(pivotPoints.r3).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-rose-500/5 text-rose-400 rounded border border-rose-500/20">
              <span>Resistance 2 (R2):</span>
              <span className="font-bold">${normalizeCentPrice(pivotPoints.r2).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-rose-500/5 text-rose-400 rounded border border-rose-500/20">
              <span>Resistance 1 (R1):</span>
              <span className="font-bold">${normalizeCentPrice(pivotPoints.r1).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20 font-bold">
              <span>Classic Daily Pivot (P):</span>
              <span>${normalizeCentPrice(pivotPoints.pivot).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-emerald-500/5 text-emerald-400 rounded border border-emerald-500/20">
              <span>Support 1 (S1):</span>
              <span className="font-bold">${normalizeCentPrice(pivotPoints.s1).toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center p-2 bg-emerald-500/5 text-emerald-400 rounded border border-emerald-500/20">
              <span>Support 2 (S2):</span>
              <span className="font-bold">${normalizeCentPrice(pivotPoints.s2).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
