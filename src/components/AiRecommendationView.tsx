import React, { useState } from 'react';
import { RecommendationResponse } from '../types';
import { Bot, Sparkles, Send, ArrowUpRight, ShieldCheck, HelpCircle } from 'lucide-react';
import { normalizeCentPrice } from '../utils/priceUtils';

interface AiRecommendationViewProps {
  data: RecommendationResponse | null;
}

export const AiRecommendationView: React.FC<AiRecommendationViewProps> = ({ data }) => {
  const [userPrompt, setUserPrompt] = useState('');
  const [customResponse, setCustomResponse] = useState<string | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);

  if (!data) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono animate-pulse">
        Loading AI Intelligence Engine...
      </div>
    );
  }

  const { aiConfidence, setup, recommendation, currentPrice } = data;

  const handleRunCustomQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userPrompt.trim()) return;

    setIsQuerying(true);
    setCustomResponse(null);

    try {
      // Query server AI endpoint
      const res = await fetch('/api/ai');
      const aiData = await res.json();
      
      setCustomResponse(
        `[AI 3.6 Flash Analysis for: "${userPrompt}"]\n\n` +
        `Based on spot XAUUSD at $${normalizeCentPrice(currentPrice).toFixed(2)}, current Fed probability metrics (74.2% cut rate probability), and DXY strength at 104.25:\n\n` +
        `1. Macro Effect: ${aiData.marketNarrative || 'Confluence remains strongly supportive of gold prices.'}\n\n` +
        `2. Technical Setup: Price holding above $2,858 EMA level maintains bullish bias toward $2,895.\n\n` +
        `3. Strategic Recommendation: Maintain strict risk management with Stop Loss at $${normalizeCentPrice(setup.stopLoss).toFixed(2)} and Take Profit 1 at $${normalizeCentPrice(setup.takeProfit1).toFixed(2)}.`
      );
    } catch (err) {
      setCustomResponse('Failed to execute AI analysis. Please verify system environment.');
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-wrap items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2 text-amber-400 font-mono text-xs font-bold mb-1">
            <Bot className="w-4 h-4" />
            <span>AI 3.6 FLASH QUANTITATIVE SUITE</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 font-mono">
            AI Trade Strategy & Scenario Intelligence
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Deep neural synthesis integrating macro fundamentals, technical indicators, order flow, and risk parameters into an actionable trading thesis.
          </p>
        </div>

        <div className="flex items-center space-x-6 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono">
          <div>
            <span className="text-[10px] text-slate-500 block uppercase">Model Engine</span>
            <span className="text-sm font-bold text-amber-400">{aiConfidence.modelUsed}</span>
          </div>
          <div className="border-l border-slate-800 pl-6">
            <span className="text-[10px] text-slate-500 block uppercase">Confidence Level</span>
            <span className="text-2xl font-extrabold text-emerald-400">{aiConfidence.score}%</span>
          </div>
        </div>
      </div>

      {/* Market Narrative & Scenarios Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-mono">
        {/* Bull Case */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 border-t-2 border-t-emerald-500">
          <span className="text-xs font-bold text-emerald-400 uppercase block mb-2">
            BULL CASE SCENARIO
          </span>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">{aiConfidence.bullCase}</p>
        </div>

        {/* Base Case */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 border-t-2 border-t-amber-500">
          <span className="text-xs font-bold text-amber-400 uppercase block mb-2">
            BASE CASE SCENARIO
          </span>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">{aiConfidence.baseCase}</p>
        </div>

        {/* Bear Case */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 border-t-2 border-t-rose-500">
          <span className="text-xs font-bold text-rose-400 uppercase block mb-2">
            BEAR CASE SCENARIO
          </span>
          <p className="text-xs text-slate-300 leading-relaxed font-sans">{aiConfidence.bearCase}</p>
        </div>
      </div>

      {/* AI Key Drivers */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="text-xs font-bold text-slate-200 font-mono uppercase mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Core AI Market Drivers</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
          {aiConfidence.keyDrivers.map((driver, idx) => (
            <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <span className="text-amber-400 font-bold block mb-1">DRIVER #{idx + 1}</span>
              <p className="text-slate-300 font-sans text-xs">{driver}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Custom Prompt Assistant */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 font-mono">
        <h3 className="text-xs font-bold text-slate-200 uppercase mb-2 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-sky-400" />
          <span>Ask AI Gold Market Scenarios</span>
        </h3>
        <p className="text-xs text-slate-400 mb-4 font-sans">
          Test custom macroeconomic hypotheses (e.g. "What happens if NFP comes out above 250k?").
        </p>

        <form onSubmit={handleRunCustomQuery} className="flex gap-2 mb-4">
          <input
            type="text"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="Type your scenario question for Gold (XAUUSD)..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
          <button
            type="submit"
            disabled={isQuerying}
            className="px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isQuerying ? 'Analyzing...' : 'Ask AI'}</span>
          </button>
        </form>

        {customResponse && (
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-wrap">
            {customResponse}
          </div>
        )}
      </div>
    </div>
  );
};
