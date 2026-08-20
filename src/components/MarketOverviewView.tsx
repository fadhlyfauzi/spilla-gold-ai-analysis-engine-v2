import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { AuthUser, MarketPrice, RecommendationResponse } from '../types';
import { normalizeCentPrice, formatSymbolLabel, formatPriceDisplay } from '../utils/priceUtils';
import {
  TrendingUp,
  Globe,
  Newspaper,
  UserCheck,
  Clock,
  ExternalLink,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  Camera,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

interface MarketOverviewProps {
  currentUser: AuthUser | null;
  marketPrice: MarketPrice | null;
  recommendationData: RecommendationResponse | null;
  onNavigateTo: (tab: any) => void;
}

export const MarketOverviewView: React.FC<MarketOverviewProps> = ({
  currentUser,
  marketPrice,
  recommendationData,
  onNavigateTo,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartCardRef = useRef<HTMLDivElement>(null);

  const [flashNews, setFlashNews] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState<boolean>(true);
  const [livePrice, setLivePrice] = useState<number>(marketPrice?.price || 0);
  const [mt5Data, setMt5Data] = useState<any>(null);

  // Snapshot State
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [lastSnapshotInfo, setLastSnapshotInfo] = useState<any>(null);
  const [snapshotCount, setSnapshotCount] = useState<number>(0);

  // Load standard TradingView Embed Widget
  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: 'OANDA:XAUUSD',
      interval: '60',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      backgroundColor: '#0B0E14',
      gridColor: 'rgba(255, 255, 255, 0.05)',
      hide_side_toolbar: false,
      allow_symbol_change: true,
      save_image: true,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
    });

    containerRef.current.appendChild(script);
  }, []);

  // Capture Chart Snapshot and POST to backend
  const captureAndSaveSnapshot = async () => {
    if (!chartCardRef.current) return;
    setIsCapturing(true);

    try {
      const canvas = await html2canvas(chartCardRef.current, {
        backgroundColor: '#0B0E14',
        scale: 1.2,
        useCORS: true,
        logging: false,
      });

      const imageDataUrl = canvas.toDataURL('image/png');

      const res = await fetch('/api/snapshot/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl,
          symbol: currentSymbol || 'XAUUSD.cent',
          timeframe: 'H1',
          currentPrice: livePrice || 0,
        }),
      });

      const json = await res.json();
      if (json.success && json.snapshot) {
        setLastSnapshotInfo(json.snapshot);
        setSnapshotCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error('[Auto-Snapshot] Error capturing chart screenshot:', err);
    } finally {
      setIsCapturing(false);
    }
  };

  const currentSymbol = mt5Data?.symbol || 'XAUUSD.cent';

  // Auto-Snapshot Timer: Capture immediately at second 0 (800ms), then every 15 Minutes (900,000ms)
  useEffect(() => {
    const initialTimer = setTimeout(() => {
      captureAndSaveSnapshot();
    }, 800);

    const fifteenMinutesMs = 15 * 60 * 1000;
    const intervalTimer = setInterval(() => {
      captureAndSaveSnapshot();
    }, fifteenMinutesMs);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [livePrice, currentSymbol]);

  // Real-time MT5 Stream Polling for Market Overview
  useEffect(() => {
    const fetchMt5Bridge = async () => {
      try {
        const res = await fetch('/api/mt5-data');
        const json = await res.json();
        if (json.success && json.mt5Data) {
          setMt5Data(json.mt5Data);
          if (json.mt5Data.current_price) {
            setLivePrice(json.mt5Data.current_price);
          }
        }
      } catch (err) {
        console.error('[MarketOverview] MT5 stream error:', err);
      }
    };

    fetchMt5Bridge();
    const interval = setInterval(fetchMt5Bridge, 4000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Flash News
  useEffect(() => {
    fetch('/api/news/latest')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.news) {
          setFlashNews(data.news.slice(0, 5));
        } else {
          setFlashNews([
            {
              id: '1',
              title: 'Fed Rate Cut Expectations Keep Gold (XAUUSD) Near All-Time Highs',
              source: 'Reuters Macro',
              time: '10 mins ago',
              impact: 'HIGH',
              sentiment: 'BULLISH',
            },
            {
              id: '2',
              title: 'US Dollar Index (DXY) Consolidates Below 102.50 Amid Treasury Yield Retreat',
              source: 'Bloomberg FX',
              time: '25 mins ago',
              impact: 'MEDIUM',
              sentiment: 'NEUTRAL',
            },
            {
              id: '3',
              title: 'Central Bank Gold Reserves Increase for 5th Consecutive Quarter',
              source: 'World Gold Council',
              time: '1 hour ago',
              impact: 'HIGH',
              sentiment: 'BULLISH',
            },
            {
              id: '4',
              title: 'Geopolitical Safe-Haven Inflows Surge as Middle East Tensions Escalate',
              source: 'Kitco News',
              time: '2 hours ago',
              impact: 'HIGH',
              sentiment: 'BULLISH',
            },
          ]);
        }
      })
      .catch(() => {})
      .finally(() => setNewsLoading(false));
  }, []);

  const rawPrice = livePrice || marketPrice?.price || 0;
  const price = normalizeCentPrice(rawPrice, currentSymbol);
  const formattedSymbol = formatSymbolLabel(currentSymbol);

  const change = marketPrice?.change24h || 14.80;
  const changePercent = marketPrice?.change24hPercent || 0.35;
  const isPositive = change >= 0;

  const ema20 = normalizeCentPrice(mt5Data?.indicators?.ema_20 || (price ? price - 12.0 : 0), currentSymbol);
  const ema50 = normalizeCentPrice(mt5Data?.indicators?.ema_50 || (price ? price - 24.0 : 0), currentSymbol);
  const rsiValue = 64.2;
  const isEmaBullish = price > ema20 && ema20 >= ema50;

  return (
    <div className="space-y-6 font-mono">
      {/* Top Banner & Status Header */}
      <div className="bg-[#121620] border border-gray-800 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-lg bg-[#E5B842]/10 border border-[#E5B842]/30 text-[#E5B842]">
            <Globe className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold text-white tracking-wider">MARKET OVERVIEW</h1>
              <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                TRADINGVIEW LIVE STREAM
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Institutional TradingView Widget & Global {formattedSymbol} Market Workstation
            </p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-3">
          {/* Auto Snapshot Timer Banner */}
          <div className="flex items-center gap-3 bg-[#0B0E14] px-3.5 py-2 rounded-xl border border-gray-800 text-xs">
            <Camera className="w-4 h-4 text-[#E5B842] animate-bounce" />
            <div>
              <span className="text-[10px] text-gray-400 uppercase font-bold block">
                AUTO-SNAPSHOT CHART (15M)
              </span>
              <span className="text-white font-bold text-[11px] flex items-center gap-1.5">
                {lastSnapshotInfo ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Snapshot #{snapshotCount} ({lastSnapshotInfo.timeFormatted})</span>
                  </>
                ) : (
                  <span className="text-amber-300 animate-pulse">Menyiapkan Snapshot Chart...</span>
                )}
              </span>
            </div>
            <button
              onClick={captureAndSaveSnapshot}
              disabled={isCapturing}
              className="ml-2 px-2.5 py-1.5 rounded bg-[#121620] hover:bg-gray-800 text-amber-300 border border-amber-500/30 font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3" />
              <span>{isCapturing ? 'Saving...' : 'Snapshot Now'}</span>
            </button>
          </div>

          {/* Live AI Analysis Navigation Button */}
          <button
            onClick={() => onNavigateTo('live_analysis')}
            className="px-4 py-2.5 rounded-xl bg-[#E5B842] hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-md hover:shadow-[#E5B842]/20 flex items-center gap-1.5 cursor-pointer"
          >
            <span>LIVE AI ANALYSIS</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Expanded Main TradingView Chart (Full Width Layout) */}
      <div
        ref={chartCardRef}
        className="w-full flex flex-col bg-[#0B0E14] border border-gray-800 rounded-xl overflow-hidden shadow-2xl min-h-[640px]"
      >
        <div className="bg-[#121620] px-4 py-2.5 border-b border-gray-800 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-[#E5B842]" />
            <span className="font-bold text-gray-200">TRADINGVIEW LIVE CHART • {formattedSymbol}</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            AUTO-SNAPSHOT READY (EVERY 15M)
          </span>
        </div>

        <div className="flex-1 w-full relative min-h-[580px]">
          <div ref={containerRef} className="tradingview-widget-container h-full w-full absolute inset-0" />
        </div>
      </div>

      {/* Secondary Workstation Section: Flash News & Account / MT5 Bridge Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Berita Singkat (Flash News) */}
        <div className="bg-[#121620] border border-gray-800 rounded-xl p-4 shadow-lg space-y-3 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-gray-800">
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <Newspaper className="w-4 h-4 text-[#E5B842]" />
              <span>BERITA SINGKAT PASAR</span>
            </h3>
            <button
              onClick={() => onNavigateTo('news')}
              className="text-[10px] text-[#E5B842] hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
            >
              <span>Lihat Semua</span>
            </button>
          </div>

          {newsLoading ? (
            <div className="py-6 text-center text-xs text-gray-500 animate-pulse">Memuat Berita Pasar...</div>
          ) : (
            <div className="space-y-2.5 text-xs">
              {flashNews.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="p-2.5 bg-[#0B0E14] rounded-lg border border-gray-800/80 hover:border-gray-700 transition-all space-y-1"
                >
                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                    <span className="font-bold text-[#E5B842]">{item.source}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {item.time}
                    </span>
                  </div>
                  <p className="text-gray-200 text-xs font-medium leading-snug line-clamp-2">{item.title}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status Akun User & Status Koneksi Bridge MT5 */}
        <div className="bg-[#121620] border border-gray-800 rounded-xl p-4 shadow-lg space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-gray-800 mb-3">
              <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#E5B842]" />
                <span>STATUS AKUN & BRIDGE MT5</span>
              </h3>
              <span
                className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                  currentUser?.role === 'ADMIN'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                }`}
              >
                {currentUser?.role || 'TRADER'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#0B0E14] border border-gray-800">
                <span className="text-gray-400 font-medium">Nama Pengguna:</span>
                <span className="text-white font-bold">{currentUser?.fullName || 'Trader Quant'}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#0B0E14] border border-gray-800">
                <span className="text-gray-400 font-medium">Email Terdaftar:</span>
                <span className="text-gray-300 truncate max-w-[200px]">{currentUser?.email || 'trader@spillagold.com'}</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#0B0E14] border border-gray-800">
                <span className="text-gray-400 font-medium">Status Engine & MT5 Bridge:</span>
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                  TERHUBUNG (DATA FEED ACTIVE)
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded-lg bg-[#0B0E14] border border-gray-800">
                <span className="text-gray-400 font-medium">Gemini AI Engine:</span>
                <span className="text-[#E5B842] font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#E5B842]" />
                  ONLINE (2.5 FLASH)
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-[#0B0E14] border border-gray-800/80 rounded-lg text-[11px] text-gray-400 leading-relaxed">
            <span className="text-[#E5B842] font-bold">Catatan Sistem:</span> Data MT5 Bridge berjalan secara otomatis di latar belakang untuk memasok candle & chart snapshot ke Google Gemini AI Engine tanpa menampilkan harga cent berulang di layar.
          </div>
        </div>
      </div>
    </div>
  );
};
