import React, { useState, useEffect } from 'react';
import { RecommendationResponse, Candle, Mt5PayloadIndicators } from '../types';
import { Mt5Chart } from './Mt5Chart';
import { AiPanel } from './AiPanel';
import { ScorePanel } from './ScorePanel';
import { Target, CheckCircle2, RefreshCw } from 'lucide-react';

interface DashboardViewProps {
  data: RecommendationResponse | null;
  onNavigateTo: (view: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ data, onNavigateTo }) => {
  const [timeframe, setTimeframe] = useState<string>('H1');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isLoadingChart, setIsLoadingChart] = useState<boolean>(false);
  const [mt5Indicators, setMt5Indicators] = useState<Mt5PayloadIndicators | undefined>(undefined);
  const [mt5Symbol, setMt5Symbol] = useState<string>('XAUUSD.cent');

  // Fetch MT5 payload data for real-time indicators & symbol
  useEffect(() => {
    let isMounted = true;
    fetch('/api/ea/mt5-data')
      .then((res) => res.json())
      .then((resData) => {
        if (isMounted && resData.mt5Data) {
          setMt5Symbol(resData.mt5Data.symbol || 'XAUUSD.cent');
          if (resData.mt5Data.indicators) {
            setMt5Indicators(resData.mt5Data.indicators);
          }
        }
      })
      .catch((err) => console.error('Error fetching MT5 payload:', err));

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch candles whenever timeframe changes
  useEffect(() => {
    let isMounted = true;
    setIsLoadingChart(true);

    fetch(`/api/market/candles?timeframe=${timeframe}`)
      .then((res) => res.json())
      .then((resData) => {
        if (isMounted && resData.candles) {
          setCandles(resData.candles);
        }
      })
      .catch((err) => console.error('Error fetching candles:', err))
      .finally(() => {
        if (isMounted) setIsLoadingChart(false);
      });

    return () => {
      isMounted = false;
    };
  }, [timeframe]);

  if (!data) {
    return (
      <div className="p-12 text-center text-gray-400 font-mono flex flex-col items-center justify-center space-y-3 min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-[#D4AF37] animate-spin" />
        <span className="text-sm font-bold">Initializing SPILLA GOLD Analysis Engine & AI Model...</span>
      </div>
    );
  }

  const { setup, technicalScore } = data;

  return (
    <div className="space-y-5 font-mono">
      {/* 1. Top Score Gauge Panel */}
      <ScorePanel data={data} onNavigateTo={onNavigateTo} />

      {/* 2. Main Analysis Terminal (~70% Chart | ~30% AI Panel) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Main Candlestick Chart (~70% space, lg:col-span-8) */}
        <div className="lg:col-span-8 flex flex-col min-h-[580px]">
          <Mt5Chart
            candles={candles}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            pivotPoints={technicalScore?.pivotPoints}
            currentPrice={data.currentPrice}
            symbol={mt5Symbol}
            mt5Indicators={mt5Indicators}
            tradePlanLevels={{
              plannedEntry: setup.entryPrice,
              stopLoss: setup.stopLoss,
              takeProfit1: setup.takeProfit1,
              takeProfit2: setup.takeProfit2,
            }}
          />
        </div>

        {/* AI Analysis Panel (~30% space, lg:col-span-4) */}
        <div className="lg:col-span-4 flex flex-col">
          <AiPanel data={data} onNavigateTo={onNavigateTo} />
        </div>
      </div>


      {/* 3. Strategy Execution & Detailed Targets */}
      <div className="bg-[#121620] border border-gray-800 rounded-xl p-5 shadow-xl">
        <h3 className="text-sm font-bold text-gray-200 mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-[#D4AF37]" />
          <span>TRADE STRATEGY REASONING & DETAILED EXECUTION PLAN</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Primary Engine Confluence
            </h4>
            <div className="space-y-2">
              {setup.reasoning.map((reason, idx) => (
                <div
                  key={idx}
                  className="flex items-start space-x-2.5 text-xs text-gray-300 bg-[#0B0E14] p-3 rounded-lg border border-gray-800"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Detailed Target Price Levels
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-2.5 bg-[#0B0E14] rounded-lg border border-gray-800">
                <span className="text-gray-400">Take Profit 1 (Conservative):</span>
                <span className="text-emerald-400 font-bold">${setup.takeProfit1.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-[#0B0E14] rounded-lg border border-gray-800">
                <span className="text-gray-400">Take Profit 2 (Balanced Target):</span>
                <span className="text-emerald-400 font-bold">${setup.takeProfit2.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-[#0B0E14] rounded-lg border border-gray-800">
                <span className="text-gray-400">Take Profit 3 (Runner Target):</span>
                <span className="text-emerald-400 font-bold">${setup.takeProfit3.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-[#0B0E14] rounded-lg border border-gray-800">
                <span className="text-gray-400">Suggested Position Size ($10k account):</span>
                <span className="text-[#D4AF37] font-bold">{setup.suggestedLotSize} Lots</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
