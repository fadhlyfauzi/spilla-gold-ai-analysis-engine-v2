import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  IChartApi,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  CandlestickData,
  HistogramData,
  LineData,
  UTCTimestamp,
} from 'lightweight-charts';
import { Candle, SupportResistance, Mt5PayloadIndicators } from '../types';

interface Mt5ChartProps {
  candles: Candle[];
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  pivotPoints?: SupportResistance;
  currentPrice?: number;
  symbol?: string;
  mt5Indicators?: Mt5PayloadIndicators;
  tradePlanLevels?: {
    plannedEntry?: number;
    stopLoss?: number;
    takeProfit1?: number;
    takeProfit2?: number;
    planId?: string;
  };
}

export const Mt5Chart: React.FC<Mt5ChartProps> = ({
  candles,
  timeframe,
  onTimeframeChange,
  pivotPoints,
  currentPrice,
  symbol = 'XAUUSD.cent',
  mt5Indicators,
  tradePlanLevels,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const [chartType, setChartType] = useState<'candlestick' | 'line'>('candlestick');
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [showEma20, setShowEma20] = useState<boolean>(true);
  const [showEma50, setShowEma50] = useState<boolean>(true);
  const [showEma200, setShowEma200] = useState<boolean>(false);
  const [showPivots, setShowPivots] = useState<boolean>(true);

  const timeframes = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN'];

  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;

    // Clean up previous chart instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const container = chartContainerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;

    const chart = createChart(container, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0B0E14' },
        textColor: '#8E9BAE',
        fontSize: 11,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace, sans-serif",
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: '#D4AF37',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1F2430',
        },
        horzLine: {
          color: '#D4AF37',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1F2430',
        },
      },
      rightPriceScale: {
        borderColor: '#1F2430',
        scaleMargins: {
          top: 0.1,
          bottom: showVolume ? 0.25 : 0.1,
        },
      },
      timeScale: {
        borderColor: '#1F2430',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    chartRef.current = chart;

    // Format candles for lightweight-charts
    const formattedCandles: CandlestickData[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    let mainSeries: any;

    if (chartType === 'candlestick') {
      mainSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#089981',
        downColor: '#f23645',
        borderVisible: false,
        wickUpColor: '#089981',
        wickDownColor: '#f23645',
      });
      mainSeries.setData(formattedCandles);
    } else {
      mainSeries = chart.addSeries(LineSeries, {
        color: '#D4AF37',
        lineWidth: 2,
      });
      const lineData: LineData[] = candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.close,
      }));
      mainSeries.setData(lineData);
    }

    // Volume Series
    if (showVolume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });

      chart.priceScale('volume').applyOptions({
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      });

      const volumeData: HistogramData[] = candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(8, 153, 129, 0.35)' : 'rgba(242, 54, 69, 0.35)',
      }));
      volumeSeries.setData(volumeData);
    }

    // Helper: calculate EMA array
    const calculateEMA = (period: number): LineData[] => {
      const k = 2 / (period + 1);
      const emaData: LineData[] = [];
      let ema = candles[0].close;

      candles.forEach((c, index) => {
        if (index === 0) {
          emaData.push({ time: c.time as UTCTimestamp, value: Number(ema.toFixed(2)) });
        } else {
          ema = c.close * k + ema * (1 - k);
          emaData.push({ time: c.time as UTCTimestamp, value: Number(ema.toFixed(2)) });
        }
      });
      return emaData;
    };

    // EMA 20
    if (showEma20) {
      const ema20Series = chart.addSeries(LineSeries, {
        color: '#f59e0b',
        lineWidth: 1,
        title: 'EMA 20',
      });
      ema20Series.setData(calculateEMA(20));

      const ema20Val = mt5Indicators?.ema_20;
      if (ema20Val && mainSeries.createPriceLine) {
        mainSeries.createPriceLine({
          price: ema20Val,
          color: '#f59e0b',
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: true,
          title: `EMA 20 ($${ema20Val.toFixed(2)})`,
        });
      }
    }

    // EMA 50
    if (showEma50) {
      const ema50Series = chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 1,
        title: 'EMA 50',
      });
      ema50Series.setData(calculateEMA(50));

      const ema50Val = mt5Indicators?.ema_50;
      if (ema50Val && mainSeries.createPriceLine) {
        mainSeries.createPriceLine({
          price: ema50Val,
          color: '#3b82f6',
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: true,
          title: `EMA 50 ($${ema50Val.toFixed(2)})`,
        });
      }
    }

    // EMA 200
    if (showEma200) {
      const ema200Series = chart.addSeries(LineSeries, {
        color: '#a855f7',
        lineWidth: 1,
        title: 'EMA 200',
      });
      ema200Series.setData(calculateEMA(200));
    }

    // Combine Pivot Points from mt5Indicators or pivotPoints prop
    const activePivots = {
      r3: mt5Indicators?.r3 ?? pivotPoints?.r3,
      r2: mt5Indicators?.r2 ?? pivotPoints?.r2,
      r1: mt5Indicators?.r1 ?? pivotPoints?.r1,
      pivot: mt5Indicators?.pivot ?? pivotPoints?.pivot,
      s1: mt5Indicators?.s1 ?? pivotPoints?.s1,
      s2: mt5Indicators?.s2 ?? pivotPoints?.s2,
      s3: mt5Indicators?.s3 ?? pivotPoints?.s3,
    };

    // Add Pivot Lines automatically
    if (showPivots && activePivots.pivot !== undefined && mainSeries.createPriceLine) {
      const pLines = [
        { value: activePivots.r3, label: 'R3', color: '#ef4444' },
        { value: activePivots.r2, label: 'R2', color: '#f87171' },
        { value: activePivots.r1, label: 'R1', color: '#fca5a5' },
        { value: activePivots.pivot, label: 'PIVOT', color: '#D4AF37' },
        { value: activePivots.s1, label: 'S1', color: '#86efac' },
        { value: activePivots.s2, label: 'S2', color: '#4ade80' },
        { value: activePivots.s3, label: 'S3', color: '#22c55e' },
      ];

      pLines.forEach((p) => {
        if (p.value !== undefined && p.value > 0) {
          mainSeries.createPriceLine({
            price: p.value,
            color: p.color,
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: `${p.label} ($${p.value.toFixed(2)})`,
          });
        }
      });
    }

    // Trade Plan Execution Levels (Authoritative plannedEntry, SL, TP)
    if (tradePlanLevels && mainSeries.createPriceLine) {
      const planIdTag = tradePlanLevels.planId ? ` (${tradePlanLevels.planId.slice(0, 10)})` : '';
      
      if (tradePlanLevels.plannedEntry && tradePlanLevels.plannedEntry > 0) {
        mainSeries.createPriceLine({
          price: tradePlanLevels.plannedEntry,
          color: '#E5B842',
          lineWidth: 2,
          lineStyle: 0, // Solid
          axisLabelVisible: true,
          title: `SPILLA_ENTRY${planIdTag} ($${tradePlanLevels.plannedEntry.toFixed(2)})`,
        });
      }

      if (tradePlanLevels.stopLoss && tradePlanLevels.stopLoss > 0) {
        mainSeries.createPriceLine({
          price: tradePlanLevels.stopLoss,
          color: '#ef4444',
          lineWidth: 2,
          lineStyle: 0, // Solid
          axisLabelVisible: true,
          title: `SPILLA_SL ($${tradePlanLevels.stopLoss.toFixed(2)})`,
        });
      }

      if (tradePlanLevels.takeProfit1 && tradePlanLevels.takeProfit1 > 0) {
        mainSeries.createPriceLine({
          price: tradePlanLevels.takeProfit1,
          color: '#10b981',
          lineWidth: 2,
          lineStyle: 0, // Solid
          axisLabelVisible: true,
          title: `SPILLA_TP1 ($${tradePlanLevels.takeProfit1.toFixed(2)})`,
        });
      }

      if (tradePlanLevels.takeProfit2 && tradePlanLevels.takeProfit2 > 0) {
        mainSeries.createPriceLine({
          price: tradePlanLevels.takeProfit2,
          color: '#059669',
          lineWidth: 1,
          lineStyle: 2, // Dashed
          axisLabelVisible: true,
          title: `SPILLA_TP2 ($${tradePlanLevels.takeProfit2.toFixed(2)})`,
        });
      }
    }

    chart.timeScale().fitContent();

    // Handle ResizeObserver
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [
    candles,
    chartType,
    showVolume,
    showEma20,
    showEma50,
    showEma200,
    showPivots,
    pivotPoints,
    mt5Indicators,
    tradePlanLevels,
  ]);

  return (
    <div className="flex flex-col h-full bg-[#0B0E14] border border-gray-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Control Toolbar */}
      <div className="bg-[#121620] border-b border-gray-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
        {/* Symbol & Timeframe Selector */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 pr-3 border-r border-gray-800">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] animate-pulse" />
            <span className="font-extrabold text-white text-sm tracking-wider">{symbol}</span>
            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">
              MT5 TERMINAL
            </span>
          </div>

          <div className="flex items-center bg-[#0B0E14] border border-gray-800 rounded-lg p-0.5">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className={`px-2 py-1 text-[11px] font-bold rounded cursor-pointer transition-colors ${
                  timeframe === tf
                    ? 'bg-[#D4AF37] text-black shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {/* Indicators & Settings Toggles */}
        <div className="flex items-center space-x-2 flex-wrap">
          <button
            onClick={() => setChartType(chartType === 'candlestick' ? 'line' : 'candlestick')}
            className={`px-2.5 py-1 rounded border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-all ${
              chartType === 'candlestick'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-gray-800/60 text-gray-300 border-gray-700'
            }`}
          >
            <span>{chartType === 'candlestick' ? 'Candles' : 'Line'}</span>
          </button>

          <button
            onClick={() => setShowEma20(!showEma20)}
            className={`px-2 py-1 rounded border text-[10px] font-bold cursor-pointer transition-all ${
              showEma20
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-gray-800/40 text-gray-500 border-gray-800'
            }`}
          >
            EMA20
          </button>

          <button
            onClick={() => setShowEma50(!showEma50)}
            className={`px-2 py-1 rounded border text-[10px] font-bold cursor-pointer transition-all ${
              showEma50
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                : 'bg-gray-800/40 text-gray-500 border-gray-800'
            }`}
          >
            EMA50
          </button>

          <button
            onClick={() => setShowEma200(!showEma200)}
            className={`px-2 py-1 rounded border text-[10px] font-bold cursor-pointer transition-all ${
              showEma200
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                : 'bg-gray-800/40 text-gray-500 border-gray-800'
            }`}
          >
            EMA200
          </button>

          <button
            onClick={() => setShowPivots(!showPivots)}
            className={`px-2 py-1 rounded border text-[10px] font-bold cursor-pointer transition-all ${
              showPivots
                ? 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/40'
                : 'bg-gray-800/40 text-gray-500 border-gray-800'
            }`}
          >
            Pivots
          </button>

          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2 py-1 rounded border text-[10px] font-bold cursor-pointer transition-all ${
              showVolume
                ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                : 'bg-gray-800/40 text-gray-500 border-gray-800'
            }`}
          >
            Vol
          </button>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative flex-1 min-h-[440px] w-full bg-[#0B0E14]">
        <div ref={chartContainerRef} className="absolute inset-0 w-full h-full" />

        {/* Legend Overlay */}
        <div className="absolute top-3 left-4 pointer-events-none flex flex-wrap items-center gap-3 font-mono text-[11px] text-gray-400 bg-[#0B0E14]/90 p-2 rounded-md border border-gray-800 backdrop-blur-sm z-10">
          <span className="text-white font-bold">{symbol}</span>
          <span>TF: <span className="text-[#D4AF37] font-bold">{timeframe}</span></span>
          {currentPrice && (
            <span>PRICE: <span className="text-emerald-400 font-bold">${currentPrice.toFixed(2)}</span></span>
          )}
          {showEma20 && <span className="text-amber-400">EMA(20): ${mt5Indicators?.ema_20 ? mt5Indicators.ema_20.toFixed(2) : '-'}</span>}
          {showEma50 && <span className="text-blue-400">EMA(50): ${mt5Indicators?.ema_50 ? mt5Indicators.ema_50.toFixed(2) : '-'}</span>}
        </div>
      </div>
    </div>
  );
};

export const TradingViewChart = Mt5Chart;

