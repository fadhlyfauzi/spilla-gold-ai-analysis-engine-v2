import React, { useState, useEffect } from 'react';
import { MarketNews } from '../types';
import { Newspaper, ExternalLink, Flame, Tag } from 'lucide-react';

export const NewsView: React.FC = () => {
  const [newsList, setNewsList] = useState<MarketNews[]>([]);

  useEffect(() => {
    // Initial mock list
    const mockNews: MarketNews[] = [
      {
        id: '1',
        source: 'Reuters Financial',
        title: 'Fed Policymakers Signal Readiness for September Interest Rate Reduction',
        summary: 'Multiple Federal Reserve officials highlighted easing core inflation metrics and moderate labor market rebalancing as key rationale for upcoming monetary policy adjustment.',
        timestamp: '12 mins ago',
        impact: 'HIGH',
        sentiment: 'BULLISH',
        category: 'CENTRAL_BANK',
      },
      {
        id: '2',
        source: 'Kitco Metals Data',
        title: 'Sovereign Central Banks Add Over 120 Tonnes of Physical Gold in Q2',
        summary: 'World Gold Council report verifies robust demand from emerging market monetary authorities diversifying reserve assets away from fiat currency reserves.',
        timestamp: '45 mins ago',
        impact: 'HIGH',
        sentiment: 'BULLISH',
        category: 'GOLD_DEMAND',
      },
      {
        id: '3',
        source: 'Bloomberg Markets',
        title: 'US Dollar Index Slides to 2-Month Low Below 104.30 Technical Level',
        summary: 'Broad greenback weakness fueled by narrowing sovereign yield differentials provided tailwinds pushing spot XAUUSD above $2,865.',
        timestamp: '2 hours ago',
        impact: 'MEDIUM',
        sentiment: 'BULLISH',
        category: 'MARKETS',
      },
      {
        id: '4',
        source: 'Reuters Global',
        title: 'Escalating Geopolitical Friction in Middle East Boosts Safe-Haven Hedges',
        summary: 'Maritime shipping disruptions and heightened regional uncertainty drive institutional allocations into physical bullion and gold futures.',
        timestamp: '3 hours ago',
        impact: 'HIGH',
        sentiment: 'BULLISH',
        category: 'GEOPOLITICAL',
      },
    ];
    setNewsList(mockNews);
  }, []);

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center space-x-2 text-amber-400 font-mono text-xs font-bold mb-1">
          <Newspaper className="w-4 h-4" />
          <span>REAL-TIME FINANCIAL NEWS FEED</span>
        </div>
        <h2 className="text-xl font-bold text-slate-100 font-mono">
          Reuters, Kitco & Bloomberg Market Wire
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Automated news collector tagged with AI sentiment (Bullish / Bearish / Neutral) for Gold impact assessment.
        </p>
      </div>

      {/* News Stream Cards */}
      <div className="space-y-4">
        {newsList.map((news) => (
          <div
            key={news.id}
            className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 font-mono text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-amber-400">{news.source}</span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">{news.timestamp}</span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] uppercase font-bold border border-slate-700">
                  {news.category}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    news.sentiment === 'BULLISH'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : news.sentiment === 'BEARISH'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {news.sentiment}
                </span>
              </div>
            </div>

            <h3 className="text-base font-bold text-slate-100 mb-2 leading-snug">
              {news.title}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">{news.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
