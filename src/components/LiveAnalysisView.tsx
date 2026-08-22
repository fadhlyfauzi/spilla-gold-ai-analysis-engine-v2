import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import {
  RecommendationResponse,
  ActiveSignal,
  AnalysisHistoryRecord,
  CopilotTradePlanSnapshot,
  SymbolSpecification,
  PositionSizingMode,
  CopilotExecutionResponse,
  TradingStyle,
  TradeExecutionOrder,
  CanonicalExecutionParameters,
} from '../types';
import { normalizeCentPrice, formatSymbolLabel } from '../utils/priceUtils';
import {
  Bot,
  RefreshCw,
  ShieldCheck,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Cpu,
  Activity,
  Camera,
  ImageIcon,
  History,
  Sparkles,
  CheckCircle2,
  Clock,
  Layers,
  Zap,
  Scan,
  TrendingUp,
  AlertTriangle,
  XCircle,
  Check,
  Info,
  DollarSign,
  Calculator,
  ShieldAlert,
  Lock,
  Unlock,
  SlidersHorizontal,
  ChevronDown,
  Upload,
  Edit3,
  Shield,
  Coins,
  PlusCircle,
} from 'lucide-react';
import { CreditWalletModal } from './CreditWalletModal';
import { InsufficientCreditModal } from './InsufficientCreditModal';
import { Mt5AccountStatusWidget, TradingAccountData } from './Mt5AccountStatusWidget';

interface LiveAnalysisViewProps {
  recommendationData?: RecommendationResponse | null;
  authToken?: string | null;
  onCreditBalanceChanged?: (newBalance: number) => void;
}

export interface SignalHistoryLogItem {
  id: string;
  timestamp: string;
  timeFormatted: string;
  signal: 'BUY' | 'SELL' | 'WAIT';
  entry_price: number;
  take_profit_1: number;
  take_profit_2: number;
  stop_loss: number;
  ai_confidence: number;
  visual_pattern: string;
  summary_short: string;
}

export const createExecutionParametersFromSnapshot = (
  snap: CopilotTradePlanSnapshot,
  currentSym: string,
  style: TradingStyle,
  tf: string,
  specDigits: number,
  fallbackEq: number,
  fallbackRiskPct: number,
  fallbackLot: number
): CanonicalExecutionParameters => {
  const plan: any = snap.trade_plan || {};
  const sizing: any = snap.position_sizing || {};
  const sigId =
    snap.signal_id ||
    (snap.trade_plan_id && snap.trade_plan_id.startsWith('SG-')
      ? snap.trade_plan_id
      : `SG-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`);
  const snapId = snap.snapshot_id || snap.trade_plan_id || 'SNAP-LATEST';

  const side: 'BUY' | 'SELL' =
    snap.direction_bias === 'SELL' ||
    snap.potential_direction === 'SELL' ||
    snap.directional_bias === 'BEARISH' ||
    snap.primary_bias === 'BEARISH' ||
    snap.macro_direction_h1 === 'BEARISH' ||
    plan.action === 'SELL' ||
    snap.action === 'SELL'
      ? 'SELL'
      : 'BUY';

  const rawEntry = Number(
    plan.entry_price || snap.capturePrice || snap.market_price_at_creation || snap.anchor_price || 0
  );
  const entry = Number((rawEntry > 0 ? rawEntry : (currentSym.toUpperCase().includes('BTC') ? 77284.50 : 4470.00)).toFixed(specDigits));

  const isCrypto = currentSym.toUpperCase().includes('BTC');
  const isForex = specDigits === 5 || specDigits === 3;
  const defaultRiskDist = isCrypto ? 650.0 : isForex ? (specDigits === 3 ? 0.45 : 0.0035) : 17.02;
  const rawRiskDist = Number(snap.risk_distance);
  const riskDist = (rawRiskDist > 0 && rawRiskDist < entry * 0.5) ? rawRiskDist : defaultRiskDist;

  let rawSl = plan.stop_loss ? Number(plan.stop_loss) : 0;
  if (!rawSl || isNaN(rawSl) || rawSl <= 0) {
    rawSl = side === 'SELL' ? entry + riskDist : entry - riskDist;
  }
  const sl = Number(Math.max(0.0001, rawSl).toFixed(specDigits));

  let rawTp1 = plan.take_profit_1 ? Number(plan.take_profit_1) : 0;
  if (!rawTp1 || isNaN(rawTp1) || rawTp1 <= 0) {
    rawTp1 = side === 'SELL' ? entry - riskDist * 1.57 : entry + riskDist * 1.57;
  }
  const tp1 = Number(Math.max(0.0001, rawTp1).toFixed(specDigits));

  let rawTp2: number | null = plan.take_profit_2 ? Number(plan.take_profit_2) : null;
  if (!rawTp2 || isNaN(rawTp2) || rawTp2 <= 0) {
    rawTp2 = side === 'SELL' ? entry - riskDist * 2.8 : entry + riskDist * 2.8;
  }
  const tp2 = Number(Math.max(0.0001, rawTp2).toFixed(specDigits));

  const calculatedLot = Number((sizing.calculated_lot ?? sizing.normalized_lot ?? fallbackLot ?? 0.01).toFixed(4));
  const safetyCapLot = Number((sizing.safety_cap_lot ?? 0.01).toFixed(2));
  const finalLot = Number((sizing.final_execution_lot ?? Math.min(sizing.normalized_lot ?? 0.01, safetyCapLot)).toFixed(2));
  const lot = finalLot;
  const riskPct = Number((sizing.risk_percent ?? fallbackRiskPct ?? 1.0).toFixed(2));
  const estLoss = Number((sizing.estimated_loss_at_sl ?? (fallbackEq * (riskPct / 100))).toFixed(2));
  const conf = Number(snap.confidence ?? 85);
  const rr = Number(plan.risk_reward_ratio ?? 1.57);

  const zoneBuffer = isCrypto ? 150 : isForex ? (specDigits === 3 ? 0.15 : 0.0010) : 1.5;
  const zone =
    snap.potential_entry_zone ||
    snap.planned_entry_zone ||
    (entry > 0 ? `${(entry - zoneBuffer).toFixed(specDigits)} – ${(entry + zoneBuffer).toFixed(specDigits)}` : '—');

  const mode = snap.entry_mode || 'MARKET';

  return {
    signalId: sigId,
    snapshotId: snapId,
    symbol: currentSym,
    canonicalSymbol: currentSym,
    brokerSymbol: currentSym,
    side,
    lot,
    calculatedLot,
    safetyCapLot,
    finalExecutionLot: lot,
    entryPrice: entry,
    stopLoss: sl,
    takeProfit1: tp1,
    takeProfit2: tp2,
    riskPercent: riskPct,
    estimatedLoss: estLoss,
    confidence: conf,
    tradingStyle: (style || 'INTRADAY') as 'SCALPING' | 'INTRADAY',
    timeframe: tf,
    potentialEntryZone: zone,
    entryMode: mode,
    stopLossReason: snap.stop_loss_reason,
    takeProfit1Reason: snap.take_profit_1_reason,
    takeProfit2Reason: snap.take_profit_2_reason,
    riskRewardRatio: rr,
    createdAt: new Date().toISOString(),
  };
};

export const LiveAnalysisView: React.FC<LiveAnalysisViewProps> = ({
  recommendationData,
  authToken,
  onCreditBalanceChanged,
}) => {
  // Canonical Execution Parameters (Single Source of Truth)
  const [executionParameters, setExecutionParameters] = useState<CanonicalExecutionParameters | null>(null);
  // SPILLA AI Credit State
  const [userCreditBalance, setUserCreditBalance] = useState<number>(25000);
  const [isCreditWalletOpen, setIsCreditWalletOpen] = useState<boolean>(false);
  const [isInsufficientCreditOpen, setIsInsufficientCreditOpen] = useState<boolean>(false);
  const effectiveAuthToken = authToken || (typeof window !== 'undefined' ? localStorage.getItem('spilla_token') || '' : '');

  const fetchCreditBalance = async () => {
    if (!effectiveAuthToken) return;
    try {
      const res = await fetch('/api/credit/wallet', {
        headers: { Authorization: `Bearer ${effectiveAuthToken}` },
      });
      const data = await res.json();
      if (data.success && data.wallet) {
        setUserCreditBalance(data.wallet.creditBalance);
        if (onCreditBalanceChanged) {
          onCreditBalanceChanged(data.wallet.creditBalance);
        }
      }
    } catch (err) {
      console.error('[LiveAnalysisView] Error fetching credit wallet:', err);
    }
  };

  useEffect(() => {
    fetchCreditBalance();
  }, [effectiveAuthToken]);

  // Copilot State
  const [symbols, setSymbols] = useState<SymbolSpecification[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('XAUUSD');
  const [tradingStyle, setTradingStyle] = useState<TradingStyle>('INTRADAY');
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>('H4');
  const [accountEquity, setAccountEquity] = useState<number>(10000);
  const [riskMode, setRiskMode] = useState<PositionSizingMode>('RISK_PERCENT');
  const [riskPercent, setRiskPercent] = useState<number>(1.0);
  const [fixedLot, setFixedLot] = useState<number>(0.1);
  const [fixedRiskAmount, setFixedRiskAmount] = useState<number>(100);

  const SCALPING_TIMEFRAMES = ['M1', 'M5', 'M15'] as const;
  const INTRADAY_TIMEFRAMES = ['H4', 'D1'] as const;
  const availableTimeframes = tradingStyle === 'SCALPING' ? SCALPING_TIMEFRAMES : INTRADAY_TIMEFRAMES;

  const handleTradingStyleChange = (newStyle: TradingStyle) => {
    setTradingStyle(newStyle);
    if (newStyle === 'SCALPING') {
      if (!['M1', 'M5', 'M15'].includes(selectedTimeframe)) {
        setSelectedTimeframe('M5');
      }
    } else {
      if (!['H4', 'D1'].includes(selectedTimeframe)) {
        setSelectedTimeframe('H4');
      }
    }
  };

  // Active Snapshot & Telemetry
  const [snapshot, setSnapshot] = useState<CopilotTradePlanSnapshot | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [mt5Payload, setMt5Payload] = useState<any>(null);
  const [backendLiveMarket, setBackendLiveMarket] = useState<any>(null);
  const [isMt5Connected, setIsMt5Connected] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<string>('');

  const [selectedIndicators] = useState<string[]>([
    'EMA',
    'RSI',
    'MACD',
    'ATR',
    'ADX',
    'BOLLINGER',
    'VOLUME',
    'VWAP',
    'SUPPORT_RESISTANCE',
    'SWING',
    'FIBONACCI',
    'PIVOT',
  ]);

  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);

  // Execution Modal & Status
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [executingAction, setExecutingAction] = useState<'BUY' | 'SELL'>('BUY');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionResult, setExecutionResult] = useState<CopilotExecutionResponse | null>(null);
  const [modalExecutionError, setModalExecutionError] = useState<string | null>(null);
  const [connectedAccount, setConnectedAccount] = useState<TradingAccountData | null>(null);

  // Phase 1 MT5 Execution Bridge State
  const [dispatchedBanner, setDispatchedBanner] = useState<{
    signalId: string;
    status: string;
    direction: 'BUY' | 'SELL';
    lot: number;
    entry: number;
    sl: number;
    tp1: number;
    timestamp: string;
  } | null>(null);
  const [dispatchedSignalIds, setDispatchedSignalIds] = useState<string[]>([]);
  const [executionQueue, setExecutionQueue] = useState<TradeExecutionOrder[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(false);

  // Single Source of Truth Active Signal & DB History State
  const [activeSignalState, setActiveSignalState] = useState<ActiveSignal | null>(null);
  const [dbSignalHistory, setDbSignalHistory] = useState<AnalysisHistoryRecord[]>([]);
  const [latestSnapshot, setLatestSnapshot] = useState<any>(null);
  const [signalHistory, setSignalHistory] = useState<SignalHistoryLogItem[]>([]);
  const [capturedPrice, setCapturedPrice] = useState<number | null>(null);
  const [activeTradePlan, setActiveTradePlan] = useState<any | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [manualChartPrice, setManualChartPrice] = useState<string>('');
  const [pastedScreenshot, setPastedScreenshot] = useState<string | null>(null);
  const [capturedChartBase64, setCapturedChartBase64] = useState<string | null>(null);

  // Refs for TradingView chart container and chart card wrapper for html2canvas
  const tvContainerRef = useRef<HTMLDivElement>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const captureVersionRef = useRef<number>(0);
  const isAnalyzingRef = useRef<boolean>(false);

  // Listen for Clipboard Paste (Ctrl+V) anywhere on the window to capture real chart screenshots
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const base64 = ev.target?.result as string;
              if (base64) {
                setCapturedChartBase64(base64);
                setPastedScreenshot(base64);
                executeAnalysisNow(base64);
              }
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [currentPrice, manualChartPrice, selectedSymbol, selectedTimeframe]);

  // 1. Fetch available symbols and initial active plan
  useEffect(() => {
    fetch('/api/copilot/symbols')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.symbols)) {
          setSymbols(data.symbols);
        }
      })
      .catch((err) => console.error('Failed to load symbols:', err));

    fetch('/api/copilot/active-plan')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.snapshot) {
          setSnapshot(data.snapshot);
          if (data.snapshot.tradingStyle) setTradingStyle(data.snapshot.tradingStyle);
          if (data.snapshot.capturePrice) setCapturedPrice(data.snapshot.capturePrice);
          if (data.snapshot.trade_plan) setActiveTradePlan(data.snapshot.trade_plan);
          if (data.snapshot.symbol) setSelectedSymbol(data.snapshot.symbol);
          if (data.snapshot.timeframe) setSelectedTimeframe(data.snapshot.timeframe);
        }
      })
      .catch((err) => console.error('Failed to load active plan:', err));

    fetchExecutionQueue();
    loadHistoryData();
  }, []);

  const loadHistoryData = async () => {
    try {
      const res = await fetch('/api/copilot/history');
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        setDbSignalHistory(data.history);
      }
    } catch (err) {
      console.error('Failed to load history data:', err);
    }
  };

  const isDev = import.meta.env.DEV || process.env.NODE_ENV !== 'production';
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const fetchExecutionQueue = async () => {
    setIsLoadingQueue(true);
    try {
      const res = await fetch('/api/trade/orders');
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setExecutionQueue(data.orders);

        // Keep dispatched banner in sync with live queue state
        setDispatchedBanner((prev) => {
          if (!prev) return null;
          const matching = data.orders.find((o: TradeExecutionOrder) => o.signalId === prev.signalId);
          if (!matching) return prev;
          return {
            ...prev,
            status: matching.status === 'PENDING' ? 'PENDING MT5 EXECUTION' : matching.status,
          };
        });
      }
    } catch (err) {
      console.error('Failed to fetch MT5 execution queue:', err);
    } finally {
      setIsLoadingQueue(false);
    }
  };

  // Dev-Only Handlers for MT5 Bridge Testing
  const handleClaimNextOrder = async (claimedBy?: string) => {
    setIsSimulating(true);
    try {
      const worker = claimedBy || connectedAccount?.workerId || 'MT5_1019008';
      const acc = connectedAccount?.accountNumber || '1019008';
      const res = await fetch('/api/trade/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claimedBy: worker, workerId: worker, accountNumber: acc }),
      });
      const data = await res.json();
      if (data.success && data.order) {
        console.log('[DEV] Order claimed:', data.order);
      } else {
        console.log('[DEV] Claim response:', data.message);
      }
      await fetchExecutionQueue();
    } catch (err) {
      console.error('[DEV] Claim error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSimulateResult = async (
    signalId: string,
    status: 'EXECUTED' | 'REJECTED' | 'FAILED',
    options?: { fillPrice?: number; executedLot?: number; errorCode?: string; errorMessage?: string }
  ) => {
    setIsSimulating(true);
    try {
      const targetOrder = executionQueue.find((o) => o.signalId === signalId);
      const ticketNum = Math.floor(10000000 + Math.random() * 90000000);
      const payload = {
        signalId,
        status,
        mt5Ticket: status === 'EXECUTED' ? ticketNum : undefined,
        fillPrice: options?.fillPrice ?? (targetOrder ? targetOrder.entryPrice : 4470.0),
        executedLot: options?.executedLot ?? (targetOrder ? targetOrder.lot : 0.10),
        errorCode: options?.errorCode ?? (status === 'REJECTED' ? 'REQUOTE_10004' : 'EXECUTION_TIMEOUT'),
        errorMessage: options?.errorMessage ?? (status === 'REJECTED' ? 'Price requote off-quote by broker' : 'MT5 bridge execution timeout'),
      };

      const res = await fetch('/api/trade/result', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        console.log('[DEV] Result recorded:', data.order);
        await fetchExecutionQueue();
        await loadHistoryData();
      } else {
        console.warn('[DEV] Result failed:', data.message);
      }
    } catch (err) {
      console.error('[DEV] Simulate result error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSimulateLatest = async (status: 'EXECUTED' | 'REJECTED') => {
    // Find the latest claimed order, or pending order
    const targetOrder =
      executionQueue.find((o) => o.status === 'CLAIMED' || o.status === 'PROCESSING') ||
      executionQueue.find((o) => o.status === 'PENDING');
    if (!targetOrder) {
      alert('No active order in queue to simulate. Dispatch an order first.');
      return;
    }
    await handleSimulateResult(targetOrder.signalId, status);
  };

  // 2. Embed TradingView Live Chart Widget
  useEffect(() => {
    if (!tvContainerRef.current) return;
    tvContainerRef.current.innerHTML = '';

    const tvSymbol =
      selectedSymbol === 'XAUUSD' || selectedSymbol === 'XAUUSD.cent'
        ? 'OANDA:XAUUSD'
        : selectedSymbol === 'EURUSD'
        ? 'FX:EURUSD'
        : selectedSymbol === 'GBPUSD'
        ? 'FX:GBPUSD'
        : selectedSymbol === 'USDJPY'
        ? 'FX:USDJPY'
        : selectedSymbol === 'BTCUSD'
        ? 'BINANCE:BTCUSDT'
        : `OANDA:${selectedSymbol}`;

    const tvInterval =
      selectedTimeframe === 'M1'
        ? '1'
        : selectedTimeframe === 'M5'
        ? '5'
        : selectedTimeframe === 'M10'
        ? '10'
        : selectedTimeframe === 'M15'
        ? '15'
        : selectedTimeframe === 'M30'
        ? '30'
        : selectedTimeframe === 'H1'
        ? '60'
        : selectedTimeframe === 'H4'
        ? '240'
        : 'D';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: tvInterval,
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

    tvContainerRef.current.appendChild(script);
  }, [selectedSymbol, selectedTimeframe]);

  // 3. Poll live MT5 stream, Active AI Signal, and Database Signal History & Active Plan
  useEffect(() => {
    const fetchRealtimeSync = async () => {
      // Do not poll or override if an instant capture is in-flight
      if (isAnalyzingRef.current) return;
      try {
        const [mt5Res, signalRes, historyRes, activePlanRes] = await Promise.all([
          fetch('/api/ea/mt5-data').catch(() => null),
          fetch('/api/ai/current-signal').catch(() => null),
          fetch('/api/ai/signal-history').catch(() => null),
          fetch('/api/copilot/active-plan').catch(() => null),
        ]);

        if (isAnalyzingRef.current) return;

        if (mt5Res && mt5Res.ok) {
          try {
            const data = await mt5Res.json();
            if (data.success && data.mt5Data) {
              setMt5Payload(data.mt5Data);
              if (data.mt5Data.current_price && data.mt5Data.current_price > 0) {
                setCurrentPrice(data.mt5Data.current_price);
                setIsMt5Connected(true);
              }
            }
          } catch (e) {
            console.warn('[LiveAnalysisView] MT5 JSON parse warn:', e);
          }
        }

        if (activePlanRes && activePlanRes.ok) {
          try {
            const planData = await activePlanRes.json();
            console.log("[REALTIME SYNC RESPONSE]", planData);
            if (planData.success) {
              if (planData.snapshot) {
                const incomingVer = planData.snapshot.captureVersion || 0;
                if (incomingVer >= captureVersionRef.current) {
                  setSnapshot(planData.snapshot);
                  if (planData.snapshot.capturePrice && planData.snapshot.capturePrice > 0) {
                    setCapturedPrice(planData.snapshot.capturePrice);
                  }
                  if (planData.snapshot.trade_plan && planData.snapshot.trade_plan.entry_price > 0) {
                    setActiveTradePlan(planData.snapshot.trade_plan);
                  }
                }
              }
              if (planData.liveMarket) {
                setBackendLiveMarket(planData.liveMarket);
                if (!currentPrice && planData.liveMarket.midPrice && planData.liveMarket.midPrice > 0) {
                  setCurrentPrice(planData.liveMarket.midPrice);
                }
              }
            }
            console.log("[REALTIME SYNC MAPPED STATE]", {
              liveMarketMid: planData.liveMarket?.midPrice || currentPrice,
              capturedPrice,
              activeTradePlan,
            });
          } catch (e) {
            console.warn('[LiveAnalysisView] ActivePlan JSON parse warn:', e);
          }
        }

        if (signalRes && signalRes.ok) {
          try {
            const sigData = await signalRes.json();
            if (sigData.success && sigData.activeSignal) {
              setActiveSignalState(sigData.activeSignal);
            }
          } catch (e) {}
        }

        if (historyRes && historyRes.ok) {
          try {
            const histData = await historyRes.json();
            if (histData.success && Array.isArray(histData.history)) {
              setDbSignalHistory(histData.history);
            }
          } catch (e) {}
        }
      } catch (err) {
        console.error('[LiveAnalysisView] Error polling realtime sync:', err);
      }
    };

    fetchRealtimeSync();
    const interval = setInterval(fetchRealtimeSync, 3000);
    return () => clearInterval(interval);
  }, []);

  // 4. Copilot AI Analysis & Automated Capture Trigger (ANALYSIS NOW button)
  const executeAnalysisNow = async (overrideBase64?: string) => {
    // 1. Mandatory SPILLA AI Credit Pre-Check: 1 Analysis = 100 Credit = Rp100
    if (userCreditBalance < 100) {
      setIsInsufficientCreditOpen(true);
      return;
    }

    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    setExecutionResult(null);
    setCaptureError(null);

    try {
      // 1. Fetch the newest canonical market price from market feed (or user manual input if modified)
      let marketLastPrice: number = 0;
      let marketBid: number = 0;
      let marketAsk: number = 0;

      const manualNum = manualChartPrice !== '' ? Number(manualChartPrice) : 0;
      if (manualNum > 0) {
        marketLastPrice = manualNum;
        marketBid = manualNum - 0.20;
        marketAsk = manualNum + 0.20;
      } else {
        try {
          const canonicalRes = await fetch('/api/market/canonical');
          if (canonicalRes.ok) {
            const canonicalData = await canonicalRes.json();
            if (canonicalData?.price && Number(canonicalData.price) > 0) {
              marketLastPrice = Number(canonicalData.price);
              marketBid = Number(canonicalData.bid || (marketLastPrice - 0.20));
              marketAsk = Number(canonicalData.ask || (marketLastPrice + 0.20));
            }
          }
        } catch (err) {
          console.warn('[LiveAnalysisView] Canonical market fetch fallback:', err);
        }

        if (!marketLastPrice || marketLastPrice <= 0) {
          if (backendLiveMarket?.midPrice && backendLiveMarket.midPrice > 0) {
            marketLastPrice = backendLiveMarket.midPrice;
            marketBid = backendLiveMarket.bid || (marketLastPrice - 0.20);
            marketAsk = backendLiveMarket.ask || (marketLastPrice + 0.20);
          } else if (currentPrice > 0) {
            marketLastPrice = currentPrice;
            marketBid = currentPrice - 0.20;
            marketAsk = currentPrice + 0.20;
          } else {
            marketLastPrice = 4470.00;
            marketBid = 4469.80;
            marketAsk = 4470.20;
          }
        }
      }

      // 2. Normalize price correctly
      const normalizedPrice = normalizeCentPrice(marketLastPrice, selectedSymbol);
      const currentCapturePrice = Number(normalizedPrice.toFixed(currentSymbolSpec.digits || 2));

      // PRE-AI VALIDATION: Check for stale prices like 4348.50, 4346.25 or negative/zero
      if (!currentCapturePrice || isNaN(currentCapturePrice) || currentCapturePrice <= 0) {
        throw new Error('STALE PRICE DETECTED — ANALYSIS CANCELLED: Invalid market price.');
      }

      if (Math.abs(currentCapturePrice - 4348.50) < 1.0 || Math.abs(currentCapturePrice - 4346.25) < 1.0) {
        throw new Error('STALE PRICE DETECTED — ANALYSIS CANCELLED: Stale price detected.');
      }

      const captureVersion = ++captureVersionRef.current;
      const captureId = `CAP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const captureTimestamp = new Date().toISOString();

      // 3. Immediately use the LOCAL VARIABLE as the source of truth for the snapshot
      const formattedGarisHarga = currentCapturePrice.toFixed(currentSymbolSpec.digits || 2);
      setManualChartPrice(formattedGarisHarga);
      setCurrentPrice(currentCapturePrice);
      setCapturedPrice(currentCapturePrice);

      // Freeze chart image snapshot
      let capturedBase64: string | null = overrideBase64 || capturedChartBase64 || pastedScreenshot || null;
      if (!capturedBase64 && chartWrapperRef.current) {
        try {
          const canvas = await html2canvas(chartWrapperRef.current, {
            backgroundColor: '#0B0E14',
            scale: 1.0,
            useCORS: true,
            logging: false,
          });
          capturedBase64 = canvas.toDataURL('image/png');
          setCapturedChartBase64(capturedBase64);
        } catch (captureErr) {
          console.warn('[LiveAnalysisView] html2canvas capture fallback:', captureErr);
        }
      }

      // MANDATORY AI PAYLOAD DEBUG LOG
      console.log({
        uiPriceLine: currentCapturePrice,
        snapshotPrice: currentCapturePrice,
        geminiPayloadPrice: currentCapturePrice,
        snapshotId: captureId,
      });

      // 4. Send analysis transaction with local currentCapturePrice as immutable SSOT
      const copilotRes = await fetch('/api/copilot/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(effectiveAuthToken ? { Authorization: `Bearer ${effectiveAuthToken}` } : {}),
        },
        body: JSON.stringify({
          symbol: selectedSymbol,
          tradingStyle,
          timeframe: selectedTimeframe,
          equity: accountEquity,
          mode: riskMode,
          riskPercent,
          fixedLot,
          fixedRiskAmount,
          chartImageBase64: capturedBase64,
          capturePrice: currentCapturePrice,
          chartRunningPrice: currentCapturePrice,
          captureId,
          captureVersion,
          bid: Number(marketBid.toFixed(currentSymbolSpec.digits || 2)),
          ask: Number(marketAsk.toFixed(currentSymbolSpec.digits || 2)),
          mid: currentCapturePrice,
          timestamp: captureTimestamp,
          indicators: selectedIndicators,
        }),
      });

      const copilotData = await copilotRes.json();

      if (!copilotRes.ok || !copilotData.success) {
        if (copilotData.error === 'INSUFFICIENT_CREDIT') {
          setIsInsufficientCreditOpen(true);
        }
        throw new Error(copilotData.message || copilotData.error || 'STALE PRICE DETECTED — ANALYSIS CANCELLED');
      }

      // Update credit balance upon successful analysis
      if (copilotData.credit) {
        setUserCreditBalance(copilotData.credit.remainingBalance);
        if (onCreditBalanceChanged) onCreditBalanceChanged(copilotData.credit.remainingBalance);
      } else {
        fetchCreditBalance();
      }

      // 5. PRE-RENDER VALIDATION
      const resultCurrentPrice = Number(
        copilotData.snapshot?.capturePrice ??
        copilotData.capturePrice ??
        copilotData.currentPrice ??
        currentCapturePrice
      );
      const resultAnchor = Number(
        copilotData.snapshot?.anchor_price ??
        copilotData.anchorPrice ??
        copilotData.anchor ??
        currentCapturePrice
      );

      const epsilon = 0.01;
      if (
        Math.abs(resultCurrentPrice - currentCapturePrice) > epsilon ||
        Math.abs(resultAnchor - currentCapturePrice) > epsilon
      ) {
        setSnapshot(null);
        throw new Error('SNAPSHOT PRICE MISMATCH — ANALYSIS REJECTED');
      }

      if (Math.abs(resultCurrentPrice - 4348.50) < 1.0 || Math.abs(resultCurrentPrice - 4346.25) < 1.0) {
        setSnapshot(null);
        throw new Error('SNAPSHOT PRICE MISMATCH — ANALYSIS REJECTED');
      }

      setCaptureError(null);
      setCapturedPrice(currentCapturePrice);
      setCurrentPrice(currentCapturePrice);
      setManualChartPrice(formattedGarisHarga);

      if (copilotData.tradePlan) {
        setActiveTradePlan(copilotData.tradePlan);
      } else if (copilotData.snapshot?.trade_plan) {
        setActiveTradePlan(copilotData.snapshot.trade_plan);
      }

      if (copilotData.snapshot) {
        if ((copilotData.snapshot.captureVersion || captureVersion) >= captureVersionRef.current) {
          const canonicalSnapshot = {
            ...copilotData.snapshot,
            capturePrice: currentCapturePrice,
            market_price_at_creation: currentCapturePrice,
            anchor_price: currentCapturePrice,
            liveAnchorPrice: currentCapturePrice,
          };
          setSnapshot(canonicalSnapshot);
          if (canonicalSnapshot.trade_plan) {
            setActiveTradePlan(canonicalSnapshot.trade_plan);
          }
          const canonicalParams = createExecutionParametersFromSnapshot(
            canonicalSnapshot,
            selectedSymbol,
            tradingStyle,
            selectedTimeframe,
            currentSymbolSpec.digits || 2,
            accountEquity,
            riskPercent,
            fixedLot
          );
          setExecutionParameters(canonicalParams);
        }
      }

      const now = new Date();
      setLastAnalysisTime(
        now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    } catch (err: any) {
      console.error('[LiveAnalysisView] Copilot Analysis error:', err);
      setSnapshot(null);
      setExecutionParameters(null);
      setCaptureError(err?.message || 'STALE PRICE DETECTED — ANALYSIS CANCELLED');
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  const executeInstantCaptureAndAnalysis = executeAnalysisNow;

  // 5. Position Sizing Re-calculation on input change
  const handleRecalculateSizing = async (
    newMode?: PositionSizingMode,
    newRiskPct?: number,
    newFixedLot?: number,
    newFixedRisk?: number,
    newEquity?: number
  ) => {
    const mode = newMode || riskMode;
    const rPct = newRiskPct ?? riskPercent;
    const fLot = newFixedLot ?? fixedLot;
    const fRisk = newFixedRisk ?? fixedRiskAmount;
    const eq = newEquity ?? accountEquity;

    try {
      const res = await fetch('/api/copilot/validate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedSymbol,
          equity: eq,
          mode,
          riskPercent: rPct,
          fixedLot: fLot,
          fixedRiskAmount: fRisk,
          entryPrice: snapshot?.trade_plan.entry_price,
          stopLoss: snapshot?.trade_plan.stop_loss,
        }),
      });

      const data = await res.json();
      if (data.success && data.positionSizing && snapshot) {
        setSnapshot({
          ...snapshot,
          position_sizing: data.positionSizing,
        });
        setExecutionParameters((prev) => {
          if (!prev) return null;
          const finalLot = Number((data.positionSizing.final_execution_lot ?? data.positionSizing.normalized_lot ?? prev.lot).toFixed(2));
          return {
            ...prev,
            lot: finalLot,
            calculatedLot: data.positionSizing.calculated_lot ?? prev.calculatedLot,
            safetyCapLot: data.positionSizing.safety_cap_lot ?? prev.safetyCapLot,
            finalExecutionLot: finalLot,
            riskPercent: Number((data.positionSizing.risk_percent ?? prev.riskPercent).toFixed(2)),
            estimatedLoss: Number((data.positionSizing.estimated_loss_at_sl ?? prev.estimatedLoss).toFixed(2)),
          };
        });
      }
    } catch (err) {
      console.error('Failed to recalculate position sizing:', err);
    }
  };

  const activeSignalId = React.useMemo(() => {
    if (executionParameters?.signalId) return executionParameters.signalId;
    if (!snapshot) return 'SG-001';
    if (snapshot.signal_id) return snapshot.signal_id;
    if (snapshot.trade_plan_id) {
      return snapshot.trade_plan_id.startsWith('SG-')
        ? snapshot.trade_plan_id
        : `SG-${snapshot.trade_plan_id.replace(/^PLAN-|^SNAP-/, '')}`;
    }
    if (snapshot.snapshot_id) {
      return `SG-${snapshot.snapshot_id.slice(-8)}`;
    }
    return `SG-${Date.now().toString().slice(-6)}`;
  }, [snapshot, executionParameters]);

  const isCurrentSignalDispatched = dispatchedSignalIds.includes(activeSignalId) || (dispatchedBanner?.signalId === activeSignalId);

  const handleOpenExecution = (actionToExecute: 'BUY' | 'SELL') => {
    let params = executionParameters;
    if (!params && snapshot) {
      params = createExecutionParametersFromSnapshot(
        snapshot,
        selectedSymbol,
        tradingStyle,
        selectedTimeframe,
        currentSymbolSpec.digits || 2,
        accountEquity,
        riskPercent,
        fixedLot
      );
    }
    if (params) {
      if (params.side !== actionToExecute) {
        const entry = params.entryPrice;
        const isTargetSell = actionToExecute === 'SELL';
        const riskDistance = Math.abs(params.stopLoss - entry) || 17.02;
        const digits = currentSymbolSpec.digits || 2;
        const newSL = Number((isTargetSell ? entry + riskDistance : entry - riskDistance).toFixed(digits));
        const newTP1 = Number((isTargetSell ? entry - riskDistance * 1.57 : entry + riskDistance * 1.57).toFixed(digits));
        const newTP2 = Number((isTargetSell ? entry - riskDistance * 2.8 : entry + riskDistance * 2.8).toFixed(digits));

        params = {
          ...params,
          signalId: `SG-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
          side: actionToExecute,
          stopLoss: newSL,
          takeProfit1: newTP1,
          takeProfit2: newTP2,
        };
      }
      setExecutionParameters(params);
    }
    setExecutingAction(actionToExecute);
    setExecutionResult(null);
    setModalExecutionError(null);
    setShowConfirmModal(true);
  };

  // 6. User Confirmed Order Execution Dispatch (Phase 1 MT5 Execution Bridge - SSOT Grounded)
  const handleExecuteOrder = async () => {
    const currentParams = executionParameters || (snapshot ? createExecutionParametersFromSnapshot(
      snapshot,
      selectedSymbol,
      tradingStyle,
      selectedTimeframe,
      currentSymbolSpec.digits || 2,
      accountEquity,
      riskPercent,
      fixedLot
    ) : null);

    if (!currentParams || isExecuting) return;

    // Pre-flight MT5 Account Verification
    if (connectedAccount) {
      if (!connectedAccount.workerOnline) {
        setModalExecutionError('MT5 WORKER OFFLINE — EA SPILLA Executor pada MT5 tidak terdeteksi aktif dalam 30 detik terakhir.');
        return;
      }
      if (!connectedAccount.executionEnabled) {
        setModalExecutionError('EKSEKUSI MT5 NON-AKTIF — Aktifkan sakelar MT5 Execution pada panel status akun sebelum mengirim order.');
        return;
      }
    }

    // Validation: ensure parameters exist and are not duplicated
    if (!currentParams.signalId || currentParams.entryPrice <= 0) {
      setModalExecutionError('INVALID EXECUTION PARAMETERS — PLEASE RE-RUN ANALYSIS');
      return;
    }

    if (dispatchedSignalIds.includes(currentParams.signalId)) {
      setModalExecutionError('DUPLICATE SIGNAL — ORDER ALREADY DISPATCHED');
      return;
    }

    setIsExecuting(true);
    setModalExecutionError(null);

    try {
      const digits = currentSymbolSpec.digits || 2;
      // Single Source of Truth Payload: passed directly from executionParameters with dynamic tradingAccountId
      const orderPayload: Partial<TradeExecutionOrder> = {
        signalId: currentParams.signalId,
        snapshotId: currentParams.snapshotId,
        tradingAccountId: connectedAccount?.id,
        symbol: currentParams.symbol,
        canonicalSymbol: currentParams.canonicalSymbol || currentParams.symbol,
        side: currentParams.side,
        orderType: 'MARKET',
        lot: Number(currentParams.lot.toFixed(2)),
        capturePrice: Number(currentParams.entryPrice.toFixed(digits)),
        entryPrice: Number(currentParams.entryPrice.toFixed(digits)),
        stopLoss: Number(currentParams.stopLoss.toFixed(digits)),
        takeProfit1: Number(currentParams.takeProfit1.toFixed(digits)),
        takeProfit2: currentParams.takeProfit2 !== null ? Number(currentParams.takeProfit2.toFixed(digits)) : null,
        riskPercent: Number(currentParams.riskPercent.toFixed(2)),
        estimatedLoss: Number(currentParams.estimatedLoss.toFixed(2)),
        confidence: Number(currentParams.confidence),
        tradingStyle: currentParams.tradingStyle,
        timeframe: currentParams.timeframe,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };

      const res = await fetch('/api/trade/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(effectiveAuthToken ? { Authorization: `Bearer ${effectiveAuthToken}` } : {}),
        },
        body: JSON.stringify(orderPayload),
      });

      const data = await res.json();

      if (!data.success) {
        setModalExecutionError(data.message || data.error || 'ORDER DISPATCH REJECTED');
        return;
      }

      // Success: Close modal and show "ORDER DISPATCHED ✓" banner with identical values
      setShowConfirmModal(false);
      setDispatchedSignalIds((prev) => [...new Set([...prev, currentParams.signalId])]);
      setDispatchedBanner({
        signalId: currentParams.signalId,
        status: 'PENDING MT5 EXECUTION',
        direction: currentParams.side,
        lot: currentParams.lot,
        entry: currentParams.entryPrice,
        sl: currentParams.stopLoss,
        tp1: currentParams.takeProfit1,
        timestamp: new Date().toLocaleTimeString(),
      });

      // Refresh MT5 execution queue
      fetchExecutionQueue();
      loadHistoryData();
    } catch (err: any) {
      console.error('[MT5 Bridge Dispatch Error]:', err);
      setModalExecutionError(err?.message || 'Network error during order dispatch');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleLockPlan = async () => {
    try {
      const res = await fetch('/api/copilot/lock-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: liveMarketMid > 0 ? liveMarketMid : undefined }),
      });
      const data = await res.json();
      if (data.success && data.snapshot) {
        setSnapshot(data.snapshot);
      }
    } catch (err) {
      console.error('Failed to lock plan:', err);
    }
  };

  const handleUnlockPlan = async () => {
    try {
      const res = await fetch('/api/copilot/unlock-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.success && data.snapshot) {
        setSnapshot(data.snapshot);
      }
    } catch (err) {
      console.error('Failed to unlock plan:', err);
    }
  };

  // Plan Mode & Dynamic Derivations
  const isPlanLocked = snapshot?.plan_mode === 'LOCKED' || snapshot?.status === 'LOCKED' || snapshot?.status === 'EXECUTED';
  const planMode: 'DYNAMIC' | 'LOCKED' = isPlanLocked ? 'LOCKED' : 'DYNAMIC';

  const marketCondition = snapshot?.market_condition || 'BULLISH';
  const action = (snapshot?.action || 'BUY') as 'BUY' | 'SELL' | 'WAIT' | 'NO TRADE' | 'NONE';
  
  // 1. DIRECTION BIAS: Strictly 'BUY' | 'SELL' ONLY (Answers: Which direction has the stronger technical bias?)
  const rawDirectionBias = snapshot?.direction_bias || snapshot?.potential_direction || snapshot?.action;
  const directionBias: 'BUY' | 'SELL' =
    rawDirectionBias === 'SELL' ||
    snapshot?.directional_bias === 'BEARISH' ||
    snapshot?.primary_bias === 'BEARISH' ||
    snapshot?.macro_direction_h1 === 'BEARISH'
      ? 'SELL'
      : 'BUY';

  // 2. EXECUTION STATUS: Strictly 'READY' | 'WAIT FOR CONFIRMATION' | 'NO TRADE'
  const rawExecStatus = snapshot?.execution_status;
  const executionStatus: 'READY' | 'WAIT FOR CONFIRMATION' | 'NO TRADE' =
    rawExecStatus === 'READY'
      ? 'READY'
      : rawExecStatus === 'NO TRADE' || action === 'NO TRADE' || action === 'NONE'
      ? 'NO TRADE'
      : 'WAIT FOR CONFIRMATION';

  const isReadyState = executionStatus === 'READY';
  const isWaitState = executionStatus === 'WAIT FOR CONFIRMATION';
  const isNoTradeState = executionStatus === 'NO TRADE';

  const entryMode = snapshot?.entry_mode || (isWaitState ? 'PULLBACK' : isNoTradeState ? 'NONE' : 'MARKET');
  const potentialDirection: 'BUY' | 'SELL' | 'NONE' = isNoTradeState ? 'NONE' : directionBias;
  const triggerRequired = snapshot?.trigger_required || snapshot?.next_condition || snapshot?.next_action || '';

  const isEligible = snapshot?.eligibility?.eligible ?? true;
  const isActionExecutable = isReadyState;
  const isApproved = isEligible && isActionExecutable;
  const confidence = snapshot?.confidence ?? 85;

  const liveMarketMid = currentPrice > 0 ? currentPrice : (backendLiveMarket?.midPrice || 0);

  // Authoritative Planned Entry Resolution Order (strictly adhering to user doctrine):
  // 1. activeTradePlan.entry_price
  // 2. snapshot.trade_plan.entry_price
  // 3. capturedPrice
  // 4. snapshot.capturePrice / snapshot.plannedEntry
  // 5. currentPrice / backendLiveMarket.midPrice
  // 6. null (WAITING FOR LIVE MARKET DATA)
  const plannedEntry: number | null =
    (activeTradePlan?.entry_price && activeTradePlan.entry_price > 0 ? activeTradePlan.entry_price : null) ??
    (snapshot?.trade_plan?.entry_price && snapshot.trade_plan.entry_price > 0 ? snapshot.trade_plan.entry_price : null) ??
    (capturedPrice && capturedPrice > 0 ? capturedPrice : null) ??
    (snapshot?.capturePrice && snapshot.capturePrice > 0 ? snapshot.capturePrice : null) ??
    (snapshot?.plannedEntry && snapshot.plannedEntry > 0 ? snapshot.plannedEntry : null) ??
    (liveMarketMid > 0 ? liveMarketMid : null);

  // STEP 2 — FORENSIC LOG: PLANNED ENTRY RUNTIME TRACE
  console.log("[PLANNED ENTRY RUNTIME TRACE]", {
    activeTradePlan,
    activeTradePlanEntry: activeTradePlan?.entry_price,
    snapshot,
    snapshotEntry: snapshot?.trade_plan?.entry_price,
    capturedPrice,
    snapshotCapturePrice: snapshot?.capturePrice,
    liveMarketMid,
    liveMarketState: backendLiveMarket,
    resolvedPlannedEntry: plannedEntry,
    directionBias,
    entryMode,
    executionStatus,
    potentialDirection,
    triggerRequired,
  });

  const entryPrice = plannedEntry && plannedEntry > 0 ? Number(plannedEntry) : 0;

  const isSell = directionBias === 'SELL';
  const riskDist = snapshot?.risk_distance || 17.02;
  const stopLoss =
    activeTradePlan?.stop_loss ??
    snapshot?.trade_plan?.stop_loss ??
    (entryPrice > 0 ? (isSell ? entryPrice + riskDist : entryPrice - riskDist) : 0);
  const tp1 =
    activeTradePlan?.take_profit_1 ??
    snapshot?.trade_plan?.take_profit_1 ??
    (entryPrice > 0 ? (isSell ? entryPrice - riskDist * 1.57 : entryPrice + riskDist * 1.57) : 0);
  const tp2 =
    activeTradePlan?.take_profit_2 ??
    snapshot?.trade_plan?.take_profit_2 ??
    (entryPrice > 0 ? (isSell ? entryPrice - riskDist * 2.8 : entryPrice + riskDist * 2.8) : 0);

  const rrRatio = snapshot?.trade_plan?.risk_reward_ratio || 1.57;
  const checks = snapshot?.eligibility?.checks;

  // Real-time Drift between Live Running MT5 Price and Captured Trade Plan Entry
  const calculatedDrift = entryPrice > 0 && liveMarketMid > 0 ? Number(Math.abs(liveMarketMid - entryPrice).toFixed(2)) : (snapshot?.price_drift || 0);

  const isDriftExpired = isPlanLocked && calculatedDrift > 12.0;
  const effectivePlanStatus = isPlanLocked
    ? (snapshot?.status === 'EXECUTED' ? 'EXECUTED' : (isDriftExpired ? 'TRADE_PLAN_EXPIRED' : 'LOCKED'))
    : (snapshot?.status || 'DYNAMIC');

  const currentSymbolSpec = symbols.find((s) => s.symbol === selectedSymbol) || {
    symbol: selectedSymbol,
    digits: 2,
    point: 0.01,
    contractSize: 100,
    category: 'METALS',
  };

  const potentialEntryZone =
    snapshot?.potential_entry_zone ||
    snapshot?.planned_entry_zone ||
    (entryPrice > 0 ? `${(entryPrice - 1.5).toFixed(currentSymbolSpec.digits || 2)} – ${(entryPrice + 1.5).toFixed(currentSymbolSpec.digits || 2)}` : '—');

  return (
    <div className="space-y-6 font-mono">
      {/* MT5 Account Connection & Telemetry Status Widget */}
      <Mt5AccountStatusWidget
        authToken={effectiveAuthToken}
        onAccountUpdated={(acc) => setConnectedAccount(acc)}
      />

      {/* Top Banner & Copilot Controller Bar */}
      <div className="bg-[#121620] border border-gray-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-lg bg-[#E5B842]/10 border border-[#E5B842]/30 text-[#E5B842]">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold text-white tracking-wider">AI TRADING COPILOT</h1>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-[#E5B842]/20 text-[#E5B842] border border-[#E5B842]/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#E5B842]" />
                  HARDENED ENGINE
                </span>
              </div>
              <p className="text-xs text-gray-400">
                AI proposes • Risk Engine validates • Position Sizing calculates • User confirms • Broker executes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 font-mono">
              ACTIVE MODE: <span className="text-[#E5B842] font-bold">{tradingStyle}</span>
            </span>
          </div>
        </div>

        {/* Controller Bar Flow: SYMBOL → TRADING STYLE → TIMEFRAME → GARIS HARGA */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-gray-800/80">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. SYMBOL */}
            <div className="flex items-center gap-1.5 bg-[#0B0E14] px-3 py-1.5 rounded-lg border border-gray-800 text-xs shrink-0">
              <span className="text-gray-400 font-bold text-[11px]">SYMBOL:</span>
              <select
                value={selectedSymbol}
                onChange={(e) => {
                  setSelectedSymbol(e.target.value);
                }}
                className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer"
              >
                {symbols.length > 0 ? (
                  symbols.map((s) => (
                    <option key={s.symbol} value={s.symbol} className="bg-[#121620] text-white">
                      {s.symbol} ({s.category})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="XAUUSD" className="bg-[#121620] text-white">
                      XAUUSD (Metals)
                    </option>
                    <option value="XAUUSD.CENT" className="bg-[#121620] text-white">
                      XAUUSD.CENT (Cent Metals)
                    </option>
                    <option value="EURUSD" className="bg-[#121620] text-white">
                      EURUSD (Forex)
                    </option>
                    <option value="GBPUSD" className="bg-[#121620] text-white">
                      GBPUSD (Forex)
                    </option>
                    <option value="USDJPY" className="bg-[#121620] text-white">
                      USDJPY (Forex)
                    </option>
                    <option value="BTCUSD" className="bg-[#121620] text-white">
                      BTCUSD (Crypto)
                    </option>
                  </>
                )}
              </select>
            </div>

            {/* 2. TRADING STYLE */}
            <div className="flex items-center gap-1 bg-[#0B0E14] p-1 rounded-lg border border-gray-800 text-xs shrink-0">
              <span className="text-gray-400 font-bold text-[11px] px-1">TRADING STYLE:</span>
              {(['SCALPING', 'INTRADAY'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => handleTradingStyleChange(style)}
                  className={`px-2.5 py-1 rounded text-xs font-extrabold transition-all cursor-pointer ${
                    tradingStyle === style
                      ? 'bg-[#E5B842] text-black shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>

            {/* 3. TIMEFRAME */}
            <div className="flex items-center gap-1 bg-[#0B0E14] p-1 rounded-lg border border-gray-800 text-xs shrink-0">
              <span className="text-gray-400 font-bold text-[11px] px-1">TF:</span>
              {availableTimeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => setSelectedTimeframe(tf)}
                  className={`px-2.5 py-1 rounded text-xs font-extrabold transition-all cursor-pointer ${
                    selectedTimeframe === tf
                      ? 'bg-[#E5B842] text-black shadow-md'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* 4. GARIS HARGA TERAKHIR (EDITABLE CANONICAL PRICE) */}
            <div className="flex items-center gap-1.5 bg-[#0B0E14] px-3 py-1.5 rounded-lg border border-[#E5B842]/50 text-xs shadow-inner group shrink-0">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-gray-400 font-bold text-[10px] uppercase shrink-0">GARIS HARGA:</span>
              <span className="text-[#E5B842] font-bold font-mono">$</span>
              <input
                type="number"
                step="any"
                value={manualChartPrice !== '' ? manualChartPrice : (capturedPrice > 0 ? capturedPrice : currentPrice > 0 ? currentPrice : '')}
                onChange={(e) => {
                  const val = e.target.value;
                  setManualChartPrice(val);
                  const num = Number(val);
                  if (num > 0) {
                    setCurrentPrice(num);
                    setCapturedPrice(num);
                    fetch('/api/copilot/set-price', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ price: num, symbol: selectedSymbol }),
                    }).catch(() => {});
                  }
                }}
                placeholder="0.00"
                className="w-24 bg-transparent text-white font-mono font-extrabold text-xs focus:outline-none border-b border-gray-700 focus:border-[#E5B842] transition-colors"
                title="Ketik untuk mengubah garis harga chart secara langsung"
              />
              <Edit3 className="w-3 h-3 text-gray-500 group-hover:text-[#E5B842] shrink-0 transition-colors" />
            </div>

          </div>
        </div>

        {/* Capture Result Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] text-gray-400 border-t border-gray-800/50">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-gray-400 font-bold">CAPTURED:</span>
            <span className="text-white font-extrabold">
              {selectedSymbol} • {tradingStyle} • {selectedTimeframe}
            </span>
            <span className="text-[#E5B842] font-mono px-2 py-0.5 bg-[#E5B842]/10 border border-[#E5B842]/20 rounded text-[10px] font-bold">
              {snapshot?.snapshot_id || snapshot?.captureId || 'SNAP-READY'}
            </span>
          </div>
          <div className="text-[10px] text-gray-400 flex items-center gap-3">
            <span className="text-gray-500">STYLE:</span>
            <span className="text-[#E5B842] font-extrabold">{tradingStyle}</span>
            <span className="text-gray-600">•</span>
            <span className="text-gray-500">TF:</span>
            <span className="text-white font-extrabold">{selectedTimeframe}</span>
          </div>
        </div>
      </div>

      {/* Main Workspace: 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: Live Chart & Multi-Timeframe Confluence */}
        <div className="lg:col-span-7 xl:col-span-7 flex flex-col space-y-4">
          <div
            ref={chartWrapperRef}
            className="flex-1 flex flex-col bg-[#0B0E14] border border-gray-800 rounded-xl overflow-hidden shadow-2xl min-h-[500px] relative"
          >
            {/* Live Chart Header */}
            <div className="bg-[#121620] px-4 py-3 border-b border-gray-800 flex items-center justify-between text-xs flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-[#E5B842]" />
                <span className="font-extrabold text-white tracking-wide">
                  TRADINGVIEW LIVE FEED • {selectedSymbol} ({selectedTimeframe})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">LIVE FEED</span>
              </div>
            </div>

            {/* TradingView Widget Container */}
            <div className="flex-1 w-full relative min-h-[460px]">
              <div ref={tvContainerRef} className="tradingview-widget-container h-full w-full absolute inset-0" />

              {/* Analyzing overlay */}
              {isAnalyzing && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-[3px] z-20 flex flex-col items-center justify-center space-y-3 border-2 border-[#E5B842]/50 animate-pulse">
                  <Scan className="w-12 h-12 text-[#E5B842] animate-bounce" />
                  <div className="bg-[#0B0E14]/90 px-6 py-4 rounded-xl border border-[#E5B842]/50 text-center shadow-2xl space-y-1.5 max-w-md">
                    <p className="text-sm font-extrabold text-[#E5B842] tracking-wider animate-pulse flex items-center justify-center gap-2">
                      <Cpu className="w-4 h-4 text-[#E5B842] animate-spin" />
                      MEMINDAI GARIS TERAKHIR & STRUKTUR CHART...
                    </p>
                    <p className="text-xs text-gray-300">
                      Membaca posisi garis harga terakhir, candlestick, EMA ribbon, VWAP, dan level S/R pada chart {selectedSymbol}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Live Chart Bottom Footer: ANALYSIS NOW BUTTON & SYNC INFO */}
            <div className="bg-[#121620] px-4 py-3 border-t border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <Activity className="w-4 h-4 text-[#E5B842]" />
                <span>
                  Status Analisis:{' '}
                  <span className="text-white font-mono font-bold">
                    {lastAnalysisTime ? `Terakhir: ${lastAnalysisTime}` : 'Siap Dianalisis'}
                  </span>
                </span>
              </div>

              {/* Single Primary Action: ANALYSIS NOW */}
              <button
                onClick={() => executeAnalysisNow()}
                disabled={isAnalyzing}
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[#E5B842] hover:bg-[#d4a737] active:scale-95 text-black font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-[#E5B842]/20 disabled:opacity-50 flex-shrink-0"
                title="Run AI Analysis & Generate Execution Recommendation"
              >
                <Activity className={`w-4 h-4 text-black ${isAnalyzing ? 'animate-spin' : ''}`} />
                <span className="tracking-wider">{isAnalyzing ? 'ANALYZING...' : 'ANALYSIS NOW'}</span>
              </button>
            </div>
          </div>

          {/* Multi-Timeframe Confluence Matrix (Selected Timeframe Only) */}
          {(() => {
            const sc = snapshot?.structured_capture;
            const mtfData = (snapshot?.multi_timeframe as any)?.[selectedTimeframe] || {
              bias: sc?.[selectedTimeframe]?.trend || sc?.timeframeAnalysis?.[selectedTimeframe] || 'BULLISH',
              trend: sc?.[selectedTimeframe]?.trend === 'BULLISH' ? 'Bullish Continuation' : 'Bearish Pullback',
              structure: 'Ascending Channel Structure',
              keyLevel: `$${(entryPrice > 0 ? entryPrice : currentPrice > 0 ? currentPrice : 0).toFixed(currentSymbolSpec.digits || 2)}`,
            };
            const tfSc = sc?.[selectedTimeframe];
            const isBull = mtfData.bias === 'BULLISH';
            const isBear = mtfData.bias === 'BEARISH';
            const tfStructure = tfSc?.structure || mtfData.trend || (isBull ? 'Bullish Continuation' : 'Bearish Pullback');
            const emaAlignment = sc?.ema?.alignment ? sc.ema.alignment.replace(/_/g, ' ') : (isBull ? 'Bullish Stacked' : 'Bearish Stacked');
            const momentum = sc?.rsi14?.condition ? `${sc.rsi14.condition} (RSI ${sc.rsi14.value})` : (isBull ? 'Bullish Momentum' : 'Bearish Momentum');
            const trendStrength = sc?.adx14?.trendStrength ? sc.adx14.trendStrength.replace(/_/g, ' ') : 'Strong';
            const supportVal = tfSc?.support?.[0] || sc?.pivotPoints?.s1 || (currentPrice > 0 ? (currentPrice - 8).toFixed(2) : '—');
            const resistanceVal = tfSc?.resistance?.[0] || sc?.pivotPoints?.r1 || (currentPrice > 0 ? (currentPrice + 8).toFixed(2) : '—');
            const swingHighVal = tfSc?.swingHigh || sc?.swingStructure?.latestSwingHigh || (currentPrice > 0 ? (currentPrice + 12).toFixed(2) : '—');
            const swingLowVal = tfSc?.swingLow || sc?.swingStructure?.latestSwingLow || (currentPrice > 0 ? (currentPrice - 12).toFixed(2) : '—');

            return (
              <div className="bg-[#121620] border border-gray-800 rounded-xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                  <div className="flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-[#E5B842]" />
                    <span className="text-xs font-extrabold text-white tracking-wide">
                      MULTI-TIMEFRAME CONFLUENCE MATRIX
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#E5B842]/10 border border-[#E5B842]/30 text-[#E5B842] text-[10px] font-black">
                      {selectedTimeframe}
                    </span>
                  </div>
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded font-extrabold ${
                      isBull
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : isBear
                        ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {mtfData.bias}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-gray-800">
                    <span className="text-[10px] text-gray-500 font-bold block uppercase mb-0.5">Direction</span>
                    <span className={`font-extrabold ${isBull ? 'text-emerald-400' : isBear ? 'text-rose-400' : 'text-amber-300'}`}>
                      {mtfData.bias}
                    </span>
                  </div>

                  <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-gray-800">
                    <span className="text-[10px] text-gray-500 font-bold block uppercase mb-0.5">Structure</span>
                    <span className="text-white font-extrabold truncate block" title={tfStructure}>
                      {tfStructure}
                    </span>
                  </div>

                  <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-gray-800">
                    <span className="text-[10px] text-gray-500 font-bold block uppercase mb-0.5">EMA Alignment</span>
                    <span className="text-gray-200 font-semibold truncate block">
                      {emaAlignment}
                    </span>
                  </div>

                  <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-gray-800">
                    <span className="text-[10px] text-gray-500 font-bold block uppercase mb-0.5">Trend Strength (ADX)</span>
                    <span className="text-[#E5B842] font-extrabold">
                      {trendStrength}
                    </span>
                  </div>

                  <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-gray-800">
                    <span className="text-[10px] text-gray-500 font-bold block uppercase mb-0.5">Momentum</span>
                    <span className="text-gray-300 font-semibold truncate block" title={momentum}>
                      {momentum}
                    </span>
                  </div>

                  <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-gray-800">
                    <span className="text-[10px] text-gray-500 font-bold block uppercase mb-0.5">Support</span>
                    <span className="text-emerald-400 font-mono font-extrabold">
                      ${supportVal}
                    </span>
                  </div>

                  <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-gray-800">
                    <span className="text-[10px] text-gray-500 font-bold block uppercase mb-0.5">Resistance</span>
                    <span className="text-rose-400 font-mono font-extrabold">
                      ${resistanceVal}
                    </span>
                  </div>

                  <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-gray-800">
                    <span className="text-[10px] text-gray-500 font-bold block uppercase mb-0.5">Swing High / Low</span>
                    <span className="text-gray-300 font-mono text-[11px] truncate block">
                      ${swingHighVal} / ${swingLowVal}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Right Column: AI Analysis, Deterministic NO_TRADE Validation, Position Sizing, and Action */}
        <div className="lg:col-span-5 xl:col-span-5 flex flex-col space-y-4">
          {/* 1. STATE: ANALYZING MARKET (UNIFIED INSTANT GEMINI SCANNER) */}
          {isAnalyzing && (
            <div className="bg-[#121620] border border-gray-800 rounded-xl p-8 shadow-2xl flex flex-col items-center justify-center text-center min-h-[480px] space-y-6">
              <div className="relative flex items-center justify-center">
                <div className="w-20 h-20 rounded-2xl bg-[#0B0E14] border border-[#E5B842]/30 flex items-center justify-center shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#E5B842]/15 to-transparent animate-pulse" />
                  <Bot className="w-10 h-10 text-[#E5B842] relative z-10" />
                </div>
              </div>
              <div className="space-y-2 max-w-sm">
                <h2 className="text-sm font-black text-white tracking-widest uppercase flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#E5B842] animate-spin" />
                  MEMPROSES ANALISIS & SELURUH INDIKATOR...
                </h2>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Gemini Vision membaca garis harga terakhir chart <strong className="text-[#E5B842]">{selectedSymbol}</strong>, sinkronisasi 12 indikator teknikal & menyusun rencana eksekusi sekaligus.
                </p>
              </div>

              {/* Unified Pulsing Shimmer Bar */}
              <div className="w-full max-w-xs space-y-2">
                <div className="w-full bg-[#0B0E14] h-2 rounded-full overflow-hidden border border-gray-800 relative">
                  <div className="h-full bg-gradient-to-r from-[#E5B842] via-amber-200 to-[#E5B842] rounded-full w-full animate-pulse" />
                </div>
                <span className="text-[10px] text-gray-500 font-mono block text-center uppercase tracking-wider">
                  INSTANT SINGLE-PASS CONFLUENCE SYNTHESIS
                </span>
              </div>
            </div>
          )}

          {/* 2. STATE: NO ANALYSIS YET */}
          {!snapshot && !isAnalyzing && (
            <div className="bg-[#121620] border border-gray-800 rounded-xl p-8 shadow-2xl flex flex-col items-center justify-center text-center min-h-[480px] space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-[#0B0E14] border border-gray-800 flex items-center justify-center text-[#E5B842] shadow-inner">
                <Camera className="w-8 h-8" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h2 className="text-sm font-extrabold text-white tracking-wider">NO ANALYSIS YET</h2>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Press <strong className="text-[#E5B842]">ANALYSIS NOW</strong> to generate market analysis.
                </p>
              </div>
              <button
                onClick={() => executeAnalysisNow()}
                disabled={isAnalyzing}
                className="px-6 py-3 rounded-xl bg-[#E5B842] hover:bg-[#d4a737] active:scale-95 text-black font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-[#E5B842]/20"
              >
                <Activity className="w-4 h-4 text-black" />
                <span>ANALYSIS NOW</span>
              </button>
            </div>
          )}

          {/* Error Banner: PRICE GROUNDING ERROR / CAPTURE ERROR */}
          {captureError && !isAnalyzing && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-5 shadow-2xl space-y-3">
              <div className="flex items-center space-x-2 text-rose-400">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  PRICE GROUNDING ERROR — RECAPTURE REQUIRED
                </h3>
              </div>
              <p className="text-xs text-rose-200/90 leading-relaxed font-mono">
                {captureError}
              </p>
              <button
                onClick={() => executeAnalysisNow()}
                className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Run Analysis Now</span>
              </button>
            </div>
          )}

          {/* 3. STATE: RESULT (AI EXECUTION RECOMMENDATION PANEL) */}
          {snapshot && !isAnalyzing && !captureError && (
            <div className="bg-[#121620] border border-gray-800 rounded-xl p-5 shadow-2xl space-y-4">
              {/* Panel Header */}
              <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                <div className="flex items-center space-x-2">
                  <Bot className="w-5 h-5 text-[#E5B842]" />
                  <h2 className="text-xs font-extrabold text-white tracking-wider uppercase">
                    AI EXECUTION RECOMMENDATION
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded font-black bg-[#E5B842]/20 text-[#E5B842] border border-[#E5B842]/40 uppercase">
                    {snapshot?.tradingStyle || tradingStyle} • {selectedTimeframe}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-mono">
                    SNAP: {snapshot?.snapshot_id?.slice(0, 16) || 'SNAP-LATEST'}
                  </span>
                </div>
              </div>

              {/* Top Hero Banner: DIRECTION BIAS, AI CONFIDENCE, and DIRECT QUICK EXECUTION */}
              <div className="p-3 sm:p-4 bg-gradient-to-br from-[#0e121a] to-[#07090e] border border-[#E5B842]/50 rounded-2xl shadow-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  {/* 1. DIRECTION BIAS CARD */}
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      directionBias === 'BUY'
                        ? 'bg-emerald-950/25 border-emerald-500/40 shadow-sm shadow-emerald-950/40'
                        : 'bg-rose-950/25 border-rose-500/40 shadow-sm shadow-rose-950/40'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-black shrink-0 ${
                          directionBias === 'BUY'
                            ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/30'
                            : 'bg-rose-500 text-black shadow-md shadow-rose-500/30'
                        }`}
                      >
                        {directionBias === 'BUY' ? (
                          <ArrowUpRight className="w-6 h-6 stroke-[3]" />
                        ) : (
                          <ArrowDownRight className="w-6 h-6 stroke-[3]" />
                        )}
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-[#E5B842]" />
                          DIRECTION BIAS
                        </div>
                        <div className="text-xl sm:text-2xl font-black tracking-tight leading-none mt-0.5">
                          <span className={directionBias === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                            {directionBias}
                          </span>
                        </div>
                        <div className="text-[9px] text-gray-400 font-medium mt-0.5">Stronger technical bias</div>
                      </div>
                    </div>
                  </div>

                  {/* 2. AI CONFIDENCE CARD */}
                  <div className="p-3 rounded-xl bg-[#121620]/90 border border-gray-800 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-11 h-11 rounded-xl bg-[#E5B842]/15 border border-[#E5B842]/30 flex items-center justify-center shrink-0">
                        <Bot className="w-6 h-6 text-[#E5B842]" />
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                          AI CONFIDENCE
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-[#E5B842] font-mono tracking-tight leading-none mt-0.5">
                          {confidence}%
                        </div>
                        <div className="text-[9px] text-gray-400 font-medium mt-0.5">Confluence conviction</div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2.5 py-1 rounded-lg font-black tracking-wider uppercase shadow-inner ${
                        confidence >= 80
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : confidence >= 60
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {confidence >= 80 ? 'HIGH' : confidence >= 60 ? 'MEDIUM' : 'LOW'}
                    </span>
                  </div>

                  {/* 3. INSTANT DISPATCH / QUICK EXECUTE */}
                  <div className="p-3 rounded-xl bg-[#121620]/90 border border-gray-800 flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
                        <Zap className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1 truncate">
                          INSTANT DISPATCH
                        </div>
                        <div className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5 mt-0.5 truncate">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                          DIRECT EXECUTION
                        </div>
                        <div className="text-[9px] text-emerald-400/90 font-medium truncate">Ready to dispatch</div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleOpenExecution(directionBias)}
                      disabled={isCurrentSignalDispatched}
                      className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-md flex items-center gap-1.5 shrink-0 ${
                        isCurrentSignalDispatched
                          ? 'bg-[#0B0E14] text-emerald-400 border border-emerald-500/40 cursor-not-allowed opacity-90'
                          : directionBias === 'BUY'
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/30 ring-1 ring-emerald-300/50 cursor-pointer active:scale-95'
                          : 'bg-rose-500 hover:bg-rose-400 text-black shadow-rose-500/30 ring-1 ring-rose-300/50 cursor-pointer active:scale-95'
                      }`}
                    >
                      {isCurrentSignalDispatched ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                          <span>DISPATCHED</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4 text-black fill-black" />
                          <span>EXECUTE</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* ORDER DISPATCHED BANNER (PHASE 1 MT5 BRIDGE NOTIFICATION) */}
                {dispatchedBanner && (
                  <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/50 rounded-xl space-y-2.5 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-emerald-400 font-black text-xs sm:text-sm tracking-wide">
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
                        <span>ORDER DISPATCHED ✓</span>
                      </div>
                      <span className="text-[10px] px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 uppercase tracking-wider">
                        {dispatchedBanner.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-[#0B0E14] p-2 rounded-lg border border-gray-800">
                        <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider">Signal ID:</span>
                        <span className="font-mono text-[#E5B842] font-black text-xs">{dispatchedBanner.signalId}</span>
                      </div>
                      <div className="bg-[#0B0E14] p-2 rounded-lg border border-gray-800">
                        <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider">Direction:</span>
                        <span className={`font-black text-xs ${dispatchedBanner.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {dispatchedBanner.direction}
                        </span>
                      </div>
                      <div className="bg-[#0B0E14] p-2 rounded-lg border border-gray-800">
                        <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider">Lot:</span>
                        <span className="font-mono text-blue-400 font-black text-xs">{dispatchedBanner.lot.toFixed(2)}</span>
                      </div>
                      <div className="bg-[#0B0E14] p-2 rounded-lg border border-gray-800">
                        <span className="text-[9px] text-gray-400 block font-bold uppercase tracking-wider">Status:</span>
                        <span className="text-amber-300 font-black text-[11px] truncate">PENDING MT5</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Core Execution Semantics Grid */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase font-extrabold px-1">
                  <span className="flex items-center gap-1 text-[#E5B842]">
                    <Target className="w-3 h-3 text-[#E5B842]" />
                    EXECUTION PARAMETERS BREAKDOWN
                  </span>
                  <span className="text-gray-500">SSOT Grounded</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {/* 1. DIRECTION BIAS (Strictly BUY or SELL ONLY) */}
                  <div className="p-2.5 bg-[#0B0E14] rounded-lg border border-[#E5B842]/30 shadow-inner">
                    <span className="text-[9px] text-[#E5B842] uppercase font-bold block mb-1">
                      1. DIRECTION BIAS
                    </span>
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-xs font-black px-2 py-0.5 rounded flex items-center gap-1 ${
                          directionBias === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {directionBias === 'BUY' ? (
                          <>
                            <ArrowUpRight className="w-3 h-3" />
                            BUY
                          </>
                        ) : (
                          <>
                            <ArrowDownRight className="w-3 h-3" />
                            SELL
                          </>
                        )}
                      </span>
                    </div>
                    <span className="text-[9px] text-gray-500 block mt-0.5">{confidence}% AI Confidence</span>
                  </div>

                  {/* 2. LAST CAPTURE PRICE (GARIS HARGA / SSOT) */}
                  <div className="p-2.5 bg-[#0B0E14] rounded-lg border border-gray-800">
                    <span className="text-[9px] text-gray-400 uppercase font-bold block mb-1">
                      2. HARGA TERAKHIR
                    </span>
                    <span className="text-xs font-extrabold text-emerald-400 font-mono block">
                      ${(snapshot?.capturePrice || capturedPrice || currentPrice || 4484.625).toFixed(currentSymbolSpec.digits || 2)}
                    </span>
                    <span className="text-[9px] text-gray-500 block mt-0.5">Garis harga chart</span>
                  </div>

                  {/* 3. PLANNED ENTRY ZONE */}
                  <div className="p-2.5 bg-[#0B0E14] rounded-lg border border-emerald-500/30">
                    <span className="text-[9px] uppercase font-bold block mb-1 text-emerald-400">
                      3. PLANNED ZONE
                    </span>
                    <span className="text-xs font-extrabold text-white block truncate">
                      ${potentialEntryZone}
                    </span>
                    <span className="text-[9px] text-gray-400 block mt-0.5 truncate">
                      Target Area
                    </span>
                  </div>

                  {/* 4. ENTRY MODE */}
                  <div className="p-2.5 bg-[#0B0E14] rounded-lg border border-gray-800">
                    <span className="text-[9px] text-gray-400 uppercase font-bold block mb-1">
                      4. ENTRY MODE
                    </span>
                    <span
                      className={`text-[10px] font-black px-1.5 py-0.5 rounded inline-block uppercase ${
                        entryMode === 'PULLBACK'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : entryMode === 'MARKET'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : entryMode === 'BREAKOUT'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : entryMode === 'RETEST'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-gray-800 text-gray-400 border border-gray-700'
                      }`}
                    >
                      {entryMode}
                    </span>
                    <span className="text-[9px] text-gray-500 block mt-0.5 truncate">
                      {entryMode === 'PULLBACK'
                        ? 'Dip/rally entry'
                        : entryMode === 'MARKET'
                        ? 'Direct entry'
                        : entryMode === 'BREAKOUT'
                        ? 'Break of level'
                        : 'Technical zone'}
                    </span>
                  </div>
                </div>
              </div>

              {/* TECHNICAL CONFIRMATION NOTE (Informational guidance) */}
              {triggerRequired && (
                <div className="p-3.5 bg-[#0B0E14] rounded-xl border border-gray-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-gray-300 uppercase flex items-center gap-1.5 tracking-wider">
                      <Target className="w-4 h-4 text-[#E5B842]" />
                      TECHNICAL CONFIRMATION TARGET
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                      MOMENTUM CONFLUENCE
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#121620] rounded-lg border border-gray-800 text-xs">
                    <p className="text-gray-300 font-medium leading-relaxed">
                      {triggerRequired}
                    </p>
                  </div>
                </div>
              )}

              {/* RATIONALE (WHY) & TIMEFRAME STRUCTURE */}
              {(snapshot?.why || snapshot?.reason || snapshot?.macro_direction_h1 || snapshot?.micro_direction_m15) && (
                <div className="p-3 bg-[#0B0E14] rounded-lg border border-gray-800 space-y-2.5 text-xs">
                  {/* Macro vs Micro Multi-Timeframe Alignment */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-gray-800/80 text-[10px]">
                    <span className="text-gray-400 font-bold uppercase flex items-center gap-1">
                      <Layers className="w-3 h-3 text-[#E5B842]" />
                      TIMEFRAME STRUCTURE:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 font-mono">
                        H1 Macro: <strong className="text-white">{snapshot?.h1_macro || snapshot?.macro_direction_h1 || snapshot?.macro_direction || 'BULLISH'}</strong>
                      </span>
                      <span className="text-gray-600">•</span>
                      <span className="text-gray-400 font-mono">
                        M15 Micro: <strong className="text-white">{snapshot?.m15_micro || snapshot?.micro_direction_m15 || 'TRANSITION'}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Why / Rationale */}
                  {(snapshot?.why || snapshot?.reason) && (
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-[#E5B842] font-extrabold uppercase block">
                        INSTITUTIONAL RATIONALE ({action}):
                      </span>
                      <p className="text-[11px] text-gray-300 leading-relaxed">
                        {snapshot.why || snapshot.reason}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Execution Levels & Structural Reasons */}
              {isNoTradeState ? (
                <div className="p-3 bg-[#0B0E14] rounded-lg border border-gray-800 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-gray-400 font-extrabold uppercase">
                      EXECUTION LEVELS (LOCKED)
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">NO ACTIVE RISK</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center py-2 bg-[#121620] rounded-lg border border-gray-800/80">
                    <div>
                      <span className="text-[9px] text-gray-500 block">ENTRY</span>
                      <span className="text-xs font-bold text-gray-400">—</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-500 block">STOP LOSS</span>
                      <span className="text-xs font-bold text-gray-400">—</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-500 block">TP1</span>
                      <span className="text-xs font-bold text-gray-400">—</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-500 block">R:R RATIO</span>
                      <span className="text-xs font-bold text-gray-400">—</span>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-400 text-center">
                    Capital preservation mode active. No orders should be placed until market structure forms a high-probability edge.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 text-xs">
                  {/* Planned Entry */}
                  <div
                    className={`p-3 bg-[#0B0E14] rounded-lg border space-y-1 ${
                      isWaitState ? 'border-amber-500/40' : 'border-[#E5B842]/40'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span
                        className={`text-[10px] font-extrabold uppercase ${
                          isWaitState ? 'text-amber-300' : 'text-[#E5B842]'
                        }`}
                      >
                        {isWaitState
                          ? 'POTENTIAL ENTRY ZONE (PENDING CONFIRMATION)'
                          : 'PLANNED ENTRY (DYNAMIC ENTRY ZONE)'}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        R:R 1 : {rrRatio}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-white font-extrabold text-sm">
                        ${potentialEntryZone}
                      </span>
                      <span className="text-[10px] text-gray-400 font-mono">
                        AI Anchor: ${(snapshot?.anchor_price || snapshot?.capturePrice || capturedPrice || currentPrice || 4484.625).toFixed(currentSymbolSpec.digits || 2)}
                      </span>
                    </div>
                  </div>

                  {/* Stop Loss & Take Profit 1 / 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {/* Stop Loss */}
                    <div className="p-2.5 bg-[#0B0E14] rounded-lg border border-gray-800 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-rose-400 font-bold uppercase">
                          {isWaitState ? 'POTENTIAL SL' : 'STOP LOSS (SL)'}
                        </span>
                        <span className="text-[9px] text-gray-500 font-mono">
                          {stopLoss > 0 && entryPrice > 0 ? `-${Math.abs(stopLoss - entryPrice).toFixed(1)}` : '--'}
                        </span>
                      </div>
                      <span className="text-rose-400 font-extrabold text-xs block">
                        ${stopLoss.toFixed(currentSymbolSpec.digits || 2)}
                      </span>
                      <p className="text-[9px] text-gray-400 leading-tight">
                        {snapshot?.stop_loss_reason || (isSell ? 'Above local M15 resistance and H1 swing high.' : 'Below local M15 support and H1 swing low.')}
                      </p>
                    </div>

                    {/* Take Profit 1 */}
                    <div className="p-2.5 bg-[#0B0E14] rounded-lg border border-gray-800 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase">
                          {isWaitState ? 'POTENTIAL TP1' : 'TAKE PROFIT 1'}
                        </span>
                        <span className="text-[9px] text-emerald-400/80 font-mono">
                          {snapshot?.rr_tp1 || `1:${rrRatio}`}
                        </span>
                      </div>
                      <span className="text-emerald-400 font-extrabold text-xs block">
                        ${tp1.toFixed(currentSymbolSpec.digits || 2)}
                      </span>
                      <p className="text-[9px] text-gray-400 leading-tight">
                        {snapshot?.take_profit_1_reason || (isSell ? 'Retest of H1 previous support low.' : 'Retest of H1 previous resistance high.')}
                      </p>
                    </div>

                    {/* Take Profit 2 */}
                    <div className="p-2.5 bg-[#0B0E14] rounded-lg border border-gray-800 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-emerald-400 font-bold uppercase">
                          {isWaitState ? 'POTENTIAL TP2' : 'TAKE PROFIT 2'}
                        </span>
                        <span className="text-[9px] text-emerald-400/80 font-mono">
                          {snapshot?.rr_tp2 || `1:${(Number(rrRatio) * 1.8).toFixed(1)}`}
                        </span>
                      </div>
                      <span className="text-emerald-400 font-extrabold text-xs block">
                        ${tp2.toFixed(currentSymbolSpec.digits || 2)}
                      </span>
                      <p className="text-[9px] text-gray-400 leading-tight">
                        {snapshot?.take_profit_2_reason || 'Extended H1 liquidity target zone.'}
                      </p>
                    </div>
                  </div>

                  {isWaitState && (
                    <p className="text-[9px] text-gray-500 italic px-1">
                      * Potential SL and TP levels are projected targets relative to future execution at the potential entry zone.
                    </p>
                  )}
                </div>
              )}

              {/* Analysis Summary (Max 5 points) */}
              <div className="p-3 bg-[#0B0E14] rounded-lg border border-gray-800 space-y-2 text-xs">
                <div className="flex items-center space-x-1.5 border-b border-gray-800/80 pb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#E5B842]" />
                  <span className="text-[11px] font-extrabold text-white tracking-wide uppercase">
                    ANALYSIS SUMMARY
                  </span>
                </div>
                <ul className="space-y-1 text-[11px] text-gray-300">
                  {(snapshot?.analysis_summary && snapshot.analysis_summary.length > 0
                    ? snapshot.analysis_summary.slice(0, 5)
                    : (snapshot?.primary_confluence || [
                        `H1 macro structure ${snapshot?.macro_direction?.toLowerCase() || 'bullish'}.`,
                        `M15 confirms ${action === 'SELL' ? 'bearish' : 'bullish'} momentum.`,
                        `Price trading near dynamic EMAs and VWAP.`,
                        `MACD momentum confirms ${action === 'SELL' ? 'bearish' : 'bullish'} flow.`,
                        `ADX confirms sufficient trend strength.`,
                      ]).slice(0, 5)
                  ).map((point, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-[#E5B842] font-bold">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Collapsible VIEW TECHNICAL DETAILS Toggle */}
              <div className="pt-1">
                <button
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="w-full py-2 px-3 bg-[#0B0E14] hover:bg-gray-800/80 border border-gray-800 rounded-lg text-xs font-bold text-gray-300 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 text-[#E5B842]">
                    <Cpu className="w-3.5 h-3.5 text-[#E5B842]" />
                    VIEW TECHNICAL DETAILS ({snapshot?.structured_capture ? 'ALL INDICATORS' : 'STRUCTURED CAPTURE'})
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showTechnicalDetails ? 'rotate-180' : ''}`} />
                </button>

                {showTechnicalDetails && snapshot?.structured_capture && (
                  <div className="mt-2.5 p-3 bg-[#0B0E14] rounded-xl border border-gray-800 text-[10px] space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {/* EMA Ribbon */}
                      <div className="bg-[#121620] p-2 rounded-lg border border-gray-800 space-y-1">
                        <span className="text-gray-400 font-bold block text-[9px] uppercase">EMA RIBBON</span>
                        <div className="flex justify-between text-gray-500">
                          <span>EMA 10:</span>
                          <span className="text-white font-mono">${snapshot.structured_capture.ema?.ema10}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>EMA 20:</span>
                          <span className="text-white font-mono">${snapshot.structured_capture.ema?.ema20}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>EMA 50:</span>
                          <span className="text-white font-mono">${snapshot.structured_capture.ema?.ema50}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>EMA 200:</span>
                          <span className="text-white font-mono">${snapshot.structured_capture.ema?.ema200}</span>
                        </div>
                        <span className="text-[8px] text-emerald-400 block font-bold truncate">
                          {snapshot.structured_capture.ema?.alignment}
                        </span>
                      </div>

                      {/* Oscillators */}
                      <div className="bg-[#121620] p-2 rounded-lg border border-gray-800 space-y-1">
                        <span className="text-gray-400 font-bold block text-[9px] uppercase">OSCILLATORS</span>
                        <div className="flex justify-between text-gray-500">
                          <span>RSI(14):</span>
                          <span className="text-[#E5B842] font-extrabold">{snapshot.structured_capture.rsi14?.value}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>MACD:</span>
                          <span className="text-white font-mono">{snapshot.structured_capture.macd?.macdLine}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>Histogram:</span>
                          <span className={`font-mono ${Number(snapshot.structured_capture.macd?.histogram) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {snapshot.structured_capture.macd?.histogram}
                          </span>
                        </div>
                        <span className="text-[8px] text-gray-400 block truncate">
                          {snapshot.structured_capture.rsi14?.condition}
                        </span>
                      </div>

                      {/* Volatility & Trend */}
                      <div className="bg-[#121620] p-2 rounded-lg border border-gray-800 space-y-1">
                        <span className="text-gray-400 font-bold block text-[9px] uppercase">VOLATILITY & ADX</span>
                        <div className="flex justify-between text-gray-500">
                          <span>ATR(14):</span>
                          <span className="text-white font-mono">${snapshot.structured_capture.atr14?.value}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>ADX(14):</span>
                          <span className="text-white font-mono">{snapshot.structured_capture.adx14?.value}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>+DI / -DI:</span>
                          <span className="text-white font-mono">{snapshot.structured_capture.adx14?.plusDI}/{snapshot.structured_capture.adx14?.minusDI}</span>
                        </div>
                        <span className="text-[8px] text-blue-400 block font-bold truncate">
                          {snapshot.structured_capture.adx14?.trendStrength}
                        </span>
                      </div>

                      {/* Structure & Pivots */}
                      <div className="bg-[#121620] p-2 rounded-lg border border-gray-800 space-y-1">
                        <span className="text-gray-400 font-bold block text-[9px] uppercase">PIVOTS & VWAP</span>
                        <div className="flex justify-between text-gray-500">
                          <span>Pivot:</span>
                          <span className="text-[#E5B842] font-mono">${snapshot.structured_capture.pivotPoints?.pivot}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>Resist R1:</span>
                          <span className="text-rose-400 font-mono">${snapshot.structured_capture.pivotPoints?.r1}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>Support S1:</span>
                          <span className="text-emerald-400 font-mono">${snapshot.structured_capture.pivotPoints?.s1}</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                          <span>VWAP:</span>
                          <span className="text-white font-mono">${snapshot.structured_capture.vwap?.value}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Deterministic NO_TRADE & Risk Validation Engine Checklist */}
              <div className="space-y-2 pt-2 border-t border-gray-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    DETERMINISTIC RISK VALIDATION
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-extrabold ${
                      isEligible
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {isEligible ? 'VALIDATED APPROVED' : 'NO TRADE RESTRICTED'}
                  </span>
                </div>

                {/* Guardrails Checklist */}
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className="flex items-center justify-between p-1.5 bg-[#0B0E14] rounded border border-gray-800">
                    <span className="text-gray-400">Confidence (≥65%)</span>
                    {checks?.confidence === 'PASS' ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1"><Check className="w-3 h-3" /> PASS</span>
                    ) : (
                      <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle className="w-3 h-3" /> FAIL</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-1.5 bg-[#0B0E14] rounded border border-gray-800">
                    <span className="text-gray-400">Risk/Reward (≥1.5)</span>
                    {checks?.risk_reward === 'PASS' ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1"><Check className="w-3 h-3" /> PASS</span>
                    ) : (
                      <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle className="w-3 h-3" /> FAIL</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-1.5 bg-[#0B0E14] rounded border border-gray-800">
                    <span className="text-gray-400">Spread Threshold</span>
                    {checks?.spread === 'PASS' ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1"><Check className="w-3 h-3" /> PASS</span>
                    ) : (
                      <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle className="w-3 h-3" /> FAIL</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-1.5 bg-[#0B0E14] rounded border border-gray-800">
                    <span className="text-gray-400">News Blackout</span>
                    {checks?.news === 'PASS' ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1"><Check className="w-3 h-3" /> PASS</span>
                    ) : (
                      <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle className="w-3 h-3" /> FAIL</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-1.5 bg-[#0B0E14] rounded border border-gray-800">
                    <span className="text-gray-400">MTF Alignment</span>
                    {checks?.multi_timeframe === 'PASS' ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1"><Check className="w-3 h-3" /> PASS</span>
                    ) : checks?.multi_timeframe === 'WARNING' ? (
                      <span className="text-amber-300 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> WARN</span>
                    ) : (
                      <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle className="w-3 h-3" /> FAIL</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-1.5 bg-[#0B0E14] rounded border border-gray-800">
                    <span className="text-gray-400">Market Session</span>
                    {checks?.market_session === 'PASS' ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1"><Check className="w-3 h-3" /> PASS</span>
                    ) : (
                      <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle className="w-3 h-3" /> FAIL</span>
                    )}
                  </div>
                </div>

                {/* Validation Reasons */}
                {!isEligible && snapshot?.eligibility?.reasons && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs space-y-1">
                    <span className="font-extrabold flex items-center gap-1.5 text-rose-400">
                      <ShieldAlert className="w-4 h-4" />
                      EXECUTION RESTRICTED REASONS:
                    </span>
                    <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                      {snapshot.eligibility.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Final Action Direct Execution Section */}
              <div className="pt-2 space-y-2.5">
                <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase font-extrabold px-1">
                  <span className="flex items-center gap-1 text-[#E5B842]">
                    <Zap className="w-3.5 h-3.5 text-[#E5B842]" />
                    DIRECT 1-CLICK ORDER EXECUTION
                  </span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    AUTONOMOUS DISPATCH ENABLED
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* BUY EXECUTION BUTTON */}
                  <button
                    onClick={() => handleOpenExecution('BUY')}
                    disabled={isCurrentSignalDispatched}
                    className={`py-3.5 px-4 rounded-xl font-extrabold text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-lg ${
                      isCurrentSignalDispatched
                        ? 'bg-[#0B0E14] text-emerald-400 border border-emerald-500/40 cursor-not-allowed opacity-90'
                        : directionBias === 'BUY'
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/25 ring-2 ring-emerald-400/40 cursor-pointer active:scale-98'
                        : 'bg-[#121620] hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 cursor-pointer active:scale-98'
                    }`}
                  >
                    {isCurrentSignalDispatched ? (
                      <>
                        <Check className="w-5 h-5 text-emerald-400 stroke-[3]" />
                        <span>ORDER DISPATCHED (PENDING MT5)</span>
                      </>
                    ) : (
                      <>
                        <ArrowUpRight className="w-5 h-5" />
                        <span>CONFIRM & EXECUTE BUY</span>
                      </>
                    )}
                  </button>

                  {/* SELL EXECUTION BUTTON */}
                  <button
                    onClick={() => handleOpenExecution('SELL')}
                    disabled={isCurrentSignalDispatched}
                    className={`py-3.5 px-4 rounded-xl font-extrabold text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-2 shadow-lg ${
                      isCurrentSignalDispatched
                        ? 'bg-[#0B0E14] text-rose-400 border border-rose-500/40 cursor-not-allowed opacity-90'
                        : directionBias === 'SELL'
                        ? 'bg-rose-500 hover:bg-rose-600 text-black shadow-rose-500/25 ring-2 ring-rose-400/40 cursor-pointer active:scale-98'
                        : 'bg-[#121620] hover:bg-rose-500/20 text-rose-400 border border-rose-500/40 cursor-pointer active:scale-98'
                    }`}
                  >
                    {isCurrentSignalDispatched ? (
                      <>
                        <Check className="w-5 h-5 text-rose-400 stroke-[3]" />
                        <span>ORDER DISPATCHED (PENDING MT5)</span>
                      </>
                    ) : (
                      <>
                        <ArrowDownRight className="w-5 h-5" />
                        <span>CONFIRM & EXECUTE SELL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation & Execution Modal with Phase 4 Safety Gate Review */}
      {showConfirmModal && (executionParameters || snapshot) && (() => {
        const params = executionParameters || (snapshot ? createExecutionParametersFromSnapshot(
          snapshot,
          selectedSymbol,
          tradingStyle,
          selectedTimeframe,
          currentSymbolSpec.digits || 2,
          accountEquity,
          riskPercent,
          fixedLot
        ) : null);

        if (!params) return null;

        // Phase 4 Authoritative Safety Gate Calculation
        // Required MT5 Execution Connectivity Gates (HARD BLOCKERS)
        const isAccountConnected = Boolean(connectedAccount?.accountNumber);
        const isWorkerOnline = Boolean(connectedAccount?.workerOnline);
        const isExecutionEnabled = Boolean(connectedAccount?.executionEnabled);
        const isSignalNotDispatched = !dispatchedSignalIds.includes(params.signalId);

        const blockingGateReasons: string[] = [];
        if (!isAccountConnected) blockingGateReasons.push('No MT5 trading account connected.');
        if (!isWorkerOnline) blockingGateReasons.push(`MT5 Worker (${connectedAccount?.workerId || 'UNREGISTERED'}) is OFFLINE.`);
        if (!isExecutionEnabled) blockingGateReasons.push(`MT5 Execution is DISABLED for account ${connectedAccount?.accountNumber || ''}.`);
        if (!isSignalNotDispatched) blockingGateReasons.push('Signal has already been dispatched to MT5.');

        const allGatesPass = blockingGateReasons.length === 0;

        // Trade Plan Structure & Risk Assessment (ADVISORY / WARNING ONLY - NON-BLOCKING)
        const isDirectionValid = params.side === 'BUY' || params.side === 'SELL';
        const isLotValid = params.lot > 0 && isFinite(params.lot) && params.lot <= 100;
        const isEntryValid = params.entryPrice > 0 && isFinite(params.entryPrice);
        const isSLValid = params.stopLoss > 0 && (params.side === 'BUY' ? params.stopLoss < params.entryPrice : params.stopLoss > params.entryPrice);
        const isTPValid = params.takeProfit1 > 0 && (params.side === 'BUY' ? params.takeProfit1 > params.entryPrice : params.takeProfit1 < params.entryPrice);

        const riskDist = Math.abs(params.entryPrice - params.stopLoss);
        const rewardDist = Math.abs(params.takeProfit1 - params.entryPrice);
        const calculatedRR = riskDist > 0 && rewardDist > 0 ? Number((rewardDist / riskDist).toFixed(2)) : 0;
        const minRecommendedRR = params.tradingStyle === 'SCALPING' ? 1.20 : 1.50;

        const advisoryWarnings: string[] = [];
        if (!isDirectionValid) advisoryWarnings.push(`Direction '${params.side}' advisory check.`);
        if (!isLotValid) advisoryWarnings.push(`Lot size (${params.lot}) advisory notice.`);
        if (!isEntryValid) advisoryWarnings.push(`Entry price ($${params.entryPrice}) advisory.`);
        if (!isSLValid) advisoryWarnings.push(`Stop Loss ($${params.stopLoss}) advisory: Recommended ${params.side === 'BUY' ? 'below' : 'above'} Entry ($${params.entryPrice}).`);
        if (!isTPValid) advisoryWarnings.push(`Take Profit ($${params.takeProfit1}) advisory: Recommended ${params.side === 'BUY' ? 'above' : 'below'} Entry ($${params.entryPrice}).`);
        if (calculatedRR > 0 && calculatedRR < minRecommendedRR) advisoryWarnings.push(`Risk/Reward (1:${calculatedRR.toFixed(2)}) is lower than recommended (1:${minRecommendedRR.toFixed(2)}).`);

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#121620] border border-gray-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl my-8">
              <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                <div className="flex items-center space-x-2">
                  <ShieldCheck className={`w-6 h-6 ${allGatesPass ? 'text-emerald-400' : 'text-rose-400'}`} />
                  <div>
                    <h3 className="text-sm font-extrabold text-white tracking-wider">
                      CONFIRM {params.side} ORDER EXECUTION
                    </h3>
                    <span className="text-[10px] text-gray-400 font-mono">PHASE 4 SAFETY & RISK GATE</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setExecutionResult(null);
                    setModalExecutionError(null);
                  }}
                  className="text-gray-400 hover:text-white text-xs cursor-pointer"
                >
                  ✕ CLOSE
                </button>
              </div>

              {/* Dynamic MT5 Routing Target Review */}
              <div className="bg-[#0B0E14] p-3.5 rounded-xl border border-gray-800 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-gray-800/60">
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-[#E5B842]" />
                    ROUTED MT5 TRADING ACCOUNT
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                    connectedAccount?.workerOnline
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {connectedAccount?.workerOnline ? 'WORKER ONLINE' : 'WORKER OFFLINE'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-gray-500 block text-[10px]">Account Number:</span>
                    <span className="text-white font-mono font-bold">{connectedAccount?.accountNumber || 'Belum Terhubung'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Worker ID:</span>
                    <span className="text-[#E5B842] font-mono font-bold">{connectedAccount?.workerId || 'Auto Assigned'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Broker / Server:</span>
                    <span className="text-gray-300 font-sans">{connectedAccount?.broker || 'AIMS'} • {connectedAccount?.brokerServer || '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Execution Switch:</span>
                    <span className={`font-bold ${connectedAccount?.executionEnabled ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {connectedAccount?.executionEnabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Execution Parameter Review */}
              <div className="bg-[#0B0E14] p-3.5 rounded-xl border border-gray-800 space-y-2 text-xs">
                <div className="flex justify-between items-center pb-1.5 border-b border-gray-800/60">
                  <span className="text-gray-400 text-[11px]">Signal ID:</span>
                  <span className="font-mono text-amber-300 font-bold text-xs">
                    {params.signalId}
                  </span>
                </div>
                <div className="flex justify-between items-center pb-1.5 border-b border-gray-800/60">
                  <span className="text-gray-400 text-[11px]">Symbol & Side:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 font-mono">
                      {params.canonicalSymbol || params.symbol}
                      {connectedAccount?.symbol && connectedAccount.symbol !== params.symbol ? ` → ${connectedAccount.symbol}` : ''}
                    </span>
                    <span className={`font-black text-xs px-2 py-0.5 rounded ${
                      params.side === 'BUY'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {params.side}
                    </span>
                  </div>
                </div>

                {/* Position Sizing & Safety Cap Breakdown */}
                <div className="p-2.5 rounded-lg bg-[#121620] border border-gray-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Calculated Mathematical Lot:</span>
                    <span className="text-gray-300 font-mono">{(params.calculatedLot ?? params.lot).toFixed(2)} Lots</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Hard Safety Cap (Test Mode):</span>
                    <span className="text-[#E5B842] font-mono font-bold">{(params.safetyCapLot ?? 0.01).toFixed(2)} Lots</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-gray-800">
                    <span className="text-white font-bold">Final Execution Lot (SSOT):</span>
                    <span className="text-emerald-400 font-black font-mono text-xs">{params.lot.toFixed(2)} Lots</span>
                  </div>
                  {params.calculatedLot && params.calculatedLot > params.lot && (
                    <div className="flex items-center gap-1.5 text-[10px] text-[#E5B842] bg-[#E5B842]/10 px-2 py-1 rounded border border-[#E5B842]/30 mt-1">
                      <Shield className="w-3 h-3 text-[#E5B842] shrink-0" />
                      <span>Safety Cap Active: Capped from {params.calculatedLot.toFixed(2)} to {params.lot.toFixed(2)} Lots</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-gray-500 block text-[10px]">Entry Price:</span>
                    <span className="text-white font-bold font-mono">${params.entryPrice.toFixed(currentSymbolSpec.digits || 2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Stop Loss:</span>
                    <span className="text-rose-400 font-bold font-mono">${params.stopLoss.toFixed(currentSymbolSpec.digits || 2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Take Profit 1:</span>
                    <span className="text-emerald-400 font-bold font-mono">${params.takeProfit1.toFixed(currentSymbolSpec.digits || 2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">Risk/Reward Ratio:</span>
                    <span className="text-blue-400 font-bold font-mono">
                      1 : {calculatedRR.toFixed(2)} <span className="text-[9px] text-gray-400 font-normal">(Advisory)</span>
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500 block text-[10px]">Risk % / Estimated Loss:</span>
                    <span className="text-amber-300 font-bold font-mono">{params.riskPercent}% (${params.estimatedLoss.toFixed(2)})</span>
                  </div>
                </div>
              </div>

              {/* FINAL SAFETY STATUS CHECKLIST */}
              <div className="bg-[#0B0E14] p-3.5 rounded-xl border border-gray-800 space-y-2 text-xs">
                <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-gray-800/60">
                  <Shield className="w-3.5 h-3.5 text-blue-400" />
                  SAFETY & RISK GATE VALIDATION
                </span>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">1. Account Connected:</span>
                    <span className={isAccountConnected ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {isAccountConnected ? 'PASS ✓' : 'FAIL (No Account)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">2. MT5 Worker Online:</span>
                    <span className={isWorkerOnline ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {isWorkerOnline ? 'PASS ✓ (Online)' : 'FAIL (Offline)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">3. MT5 Execution Permission:</span>
                    <span className={isExecutionEnabled ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {isExecutionEnabled ? 'PASS ✓ (Enabled)' : 'FAIL (Disabled)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">4. Direction & Structure (SL/TP):</span>
                    <span className="text-blue-400 font-bold">
                      {isSLValid && isTPValid ? 'PASS ✓ (Advisory)' : 'ADVISORY ONLY (Non-Blocking)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">5. Risk / Reward:</span>
                    <span className="text-blue-400 font-bold">
                      1:{calculatedRR.toFixed(2)} (ADVISORY ONLY)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">6. AI Plan Advisory:</span>
                    <span className="text-blue-400 font-bold">
                      {snapshot?.eligibility?.eligible !== false ? 'ELIGIBLE (Advisory)' : 'ADVISORY ONLY (Non-Blocking)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Execution Blocked Banner ONLY if MT5 / Account Blocking Gates Fail */}
              {!allGatesPass && (
                <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs space-y-1.5">
                  <div className="font-extrabold flex items-center gap-1.5 text-rose-400">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    EXECUTION BLOCKED — MT5 WORKER / ACCOUNT CRITERIA NOT MET
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    {blockingGateReasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Non-blocking Trade Plan Advisory Warning Banner */}
              {allGatesPass && advisoryWarnings.length > 0 && (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>TRADE PLAN ADVISORY NOTICE (NON-BLOCKING)</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-amber-300/90">
                    {advisoryWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Error Notification Alert in Modal */}
              {modalExecutionError && (
                <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-300 text-xs space-y-1">
                  <div className="font-extrabold flex items-center gap-1.5 text-rose-400">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    ORDER DISPATCH REJECTED
                  </div>
                  <p className="text-[11px] leading-relaxed">{modalExecutionError}</p>
                </div>
              )}

              {/* Execution Result Notification */}
              {executionResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                    executionResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <div className="font-extrabold flex items-center gap-1.5">
                    {executionResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
                    {executionResult.status}
                  </div>
                  <p className="text-[11px] leading-relaxed">{executionResult.message}</p>
                  {executionResult.mt5_ticket && (
                    <span className="font-mono text-[10px] text-amber-300 block">
                      Broker Ticket #{executionResult.mt5_ticket}
                    </span>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setExecutionResult(null);
                    setModalExecutionError(null);
                  }}
                  className="flex-1 py-3 rounded-xl bg-[#0B0E14] hover:bg-gray-800 text-gray-300 font-bold text-xs border border-gray-800 transition-all cursor-pointer"
                >
                  CANCEL
                </button>

                {!executionResult?.success && (
                  <button
                    onClick={handleExecuteOrder}
                    disabled={isExecuting || !allGatesPass}
                    className={`flex-1 py-3 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                      !allGatesPass
                        ? 'bg-[#1a1f2c] text-rose-400/80 border border-rose-500/30 cursor-not-allowed opacity-80'
                        : params.side === 'BUY'
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20 cursor-pointer'
                        : 'bg-rose-500 hover:bg-rose-600 text-black shadow-rose-500/20 cursor-pointer'
                    }`}
                  >
                    {!allGatesPass ? (
                      <>
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                        <span>EXECUTION BLOCKED</span>
                      </>
                    ) : (
                      <>
                        <Zap className={`w-4 h-4 text-black ${isExecuting ? 'animate-spin' : ''}`} />
                        <span>{isExecuting ? 'DISPATCHING TO MT5...' : `DISPATCH ${params.side} ORDER`}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* MT5 EXECUTION QUEUE (PHASE 1 BRIDGE DEBUG PANEL) */}
      <div className="bg-[#121620] border border-gray-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800 flex-wrap gap-2">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-sm font-extrabold text-white tracking-wider">MT5 EXECUTION QUEUE</h2>
              <span className="text-[10px] text-blue-400 font-mono">PHASE 1 BRIDGE • TEST MODE ONLY</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchExecutionQueue}
              className="text-[10px] text-gray-300 bg-[#0B0E14] hover:bg-gray-800 px-2.5 py-1 rounded border border-gray-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 text-blue-400 ${isLoadingQueue ? 'animate-spin' : ''}`} />
              REFRESH QUEUE
            </button>
            <span className="text-[10px] text-gray-400 bg-[#0B0E14] px-2.5 py-1 rounded border border-gray-800 font-bold flex items-center gap-1">
              <Layers className="w-3 h-3 text-blue-400" />
              {executionQueue.length} ORDERS TOTAL
            </span>
          </div>
        </div>

        {/* DEV ONLY SIMULATOR CONTROLS BAR */}
        {isDev && (
          <div className="p-3 bg-[#0B0E14] rounded-xl border border-blue-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-extrabold text-[10px] border border-blue-500/30 tracking-wider">
                DEV ONLY
              </span>
              <span className="text-gray-300 font-bold text-xs">EA Bridge Simulator Controls</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleClaimNextOrder()}
                disabled={isSimulating || !executionQueue.some((o) => o.status === 'PENDING')}
                className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Atomically claims the next PENDING order"
              >
                <Bot className="w-3.5 h-3.5" />
                CLAIM NEXT ORDER
              </button>
              <button
                onClick={() => handleSimulateLatest('EXECUTED')}
                disabled={isSimulating || !executionQueue.some((o) => o.status === 'CLAIMED' || o.status === 'PENDING' || o.status === 'PROCESSING')}
                className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Simulates broker execution for claimed/pending order"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                SIMULATE EXECUTED
              </button>
              <button
                onClick={() => handleSimulateLatest('REJECTED')}
                disabled={isSimulating || !executionQueue.some((o) => o.status === 'CLAIMED' || o.status === 'PENDING' || o.status === 'PROCESSING')}
                className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                title="Simulates broker rejection for claimed/pending order"
              >
                <XCircle className="w-3.5 h-3.5" />
                SIMULATE REJECTED
              </button>
            </div>
          </div>
        )}

        {executionQueue.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500 bg-[#0B0E14] rounded-lg border border-gray-800">
            MT5 execution queue is empty. Click &quot;DISPATCH ORDER&quot; from any validated recommendation to enqueue an order.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 bg-[#0B0E14]/70 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Signal ID</th>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Side</th>
                  <th className="py-2.5 px-3">Lot</th>
                  <th className="py-2.5 px-3">Entry</th>
                  <th className="py-2.5 px-3">SL</th>
                  <th className="py-2.5 px-3">TP1</th>
                  <th className="py-2.5 px-3">TP2</th>
                  <th className="py-2.5 px-3">Status & Execution Details</th>
                  {isDev && <th className="py-2.5 px-3 text-right">Dev Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {executionQueue.map((item) => {
                  const isBuy = item.side === 'BUY';
                  const displayTime = item.createdAt
                    ? new Date(item.createdAt).toLocaleTimeString('en-US', {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : 'Now';

                  return (
                    <tr key={item.signalId} className="hover:bg-[#0B0E14]/50 transition-colors">
                      <td className="py-3 px-3 font-mono text-gray-300 font-bold whitespace-nowrap">{displayTime}</td>
                      <td className="py-3 px-3 font-mono text-amber-300 text-[11px] font-bold whitespace-nowrap">
                        {item.signalId}
                      </td>
                      <td className="py-3 px-3 font-bold text-gray-300 whitespace-nowrap">{item.symbol}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            isBuy
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {isBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {item.side}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-blue-400 font-black whitespace-nowrap">{item.lot.toFixed(2)}</td>
                      <td className="py-3 px-3 font-mono text-white whitespace-nowrap">${item.entryPrice.toFixed(2)}</td>
                      <td className="py-3 px-3 font-mono text-rose-400 whitespace-nowrap">${item.stopLoss.toFixed(2)}</td>
                      <td className="py-3 px-3 font-mono text-emerald-400 whitespace-nowrap">${item.takeProfit1.toFixed(2)}</td>
                      <td className="py-3 px-3 font-mono text-emerald-400 whitespace-nowrap">{item.takeProfit2 !== null && item.takeProfit2 !== undefined ? `$${item.takeProfit2.toFixed(2)}` : '—'}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {item.status === 'PENDING' && (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-blue-500/10 text-blue-400 border border-blue-500/30 font-mono w-max">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                              PENDING
                            </span>
                            <span className="text-[9px] text-gray-400">Awaiting MT5 EA Claim</span>
                          </div>
                        )}
                        {item.status === 'CLAIMED' && (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-purple-500/10 text-purple-400 border border-purple-500/30 font-mono w-max">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                              CLAIMED
                            </span>
                            <span className="text-[9px] text-purple-300/80 font-mono">
                              By {item.claimedBy || 'MT5_EA'}
                            </span>
                          </div>
                        )}
                        {item.status === 'PROCESSING' && (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-mono w-max">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                              PROCESSING
                            </span>
                            <span className="text-[9px] text-cyan-300/80">Broker routing...</span>
                          </div>
                        )}
                        {item.status === 'EXECUTED' && (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono w-max">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              EXECUTED
                            </span>
                            <span className="text-[9px] text-emerald-300 font-mono">
                              Ticket: #{item.mt5Ticket || '—'} • Fill: ${item.fillPrice ? item.fillPrice.toFixed(2) : item.entryPrice.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {item.status === 'REJECTED' && (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-500/10 text-rose-400 border border-rose-500/30 font-mono w-max">
                              <XCircle className="w-3 h-3 text-rose-400" />
                              REJECTED
                            </span>
                            <span className="text-[9px] text-rose-300 font-mono">
                              [{item.errorCode || 'REJECT'}] {item.errorMessage || 'Broker rejected order'}
                            </span>
                          </div>
                        )}
                        {item.status === 'FAILED' && (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-red-500/10 text-red-400 border border-red-500/30 font-mono w-max">
                              <AlertTriangle className="w-3 h-3 text-red-400" />
                              FAILED
                            </span>
                            <span className="text-[9px] text-red-300 font-mono">
                              {item.errorMessage || 'Execution failure'}
                            </span>
                          </div>
                        )}
                      </td>
                      {isDev && (
                        <td className="py-3 px-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.status === 'PENDING' && (
                              <button
                                onClick={() => handleClaimNextOrder()}
                                disabled={isSimulating}
                                className="px-2 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[10px] font-bold cursor-pointer transition-all"
                                title="Claim this order"
                              >
                                Claim
                              </button>
                            )}
                            {(item.status === 'CLAIMED' || item.status === 'PROCESSING' || item.status === 'PENDING') && (
                              <>
                                <button
                                  onClick={() => handleSimulateResult(item.signalId, 'EXECUTED')}
                                  disabled={isSimulating}
                                  className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold cursor-pointer transition-all"
                                  title="Simulate successful execution"
                                >
                                  Exec
                                </button>
                                <button
                                  onClick={() => handleSimulateResult(item.signalId, 'REJECTED')}
                                  disabled={isSimulating}
                                  className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold cursor-pointer transition-all"
                                  title="Simulate broker rejection"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {item.status === 'EXECUTED' && (
                              <span className="text-[10px] text-emerald-400 font-mono font-bold">✓ Done</span>
                            )}
                            {(item.status === 'REJECTED' || item.status === 'FAILED') && (
                              <span className="text-[10px] text-rose-400 font-mono font-bold">✕ Closed</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Signal Log & Execution History Table */}
      <div className="bg-[#121620] border border-gray-800 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center space-x-2">
            <History className="w-5 h-5 text-[#E5B842]" />
            <h2 className="text-sm font-extrabold text-white tracking-wider">COPILOT SIGNAL & EXECUTION AUDIT TRAIL</h2>
          </div>
          <span className="text-[10px] text-gray-400 bg-[#0B0E14] px-2.5 py-1 rounded border border-gray-800 font-bold flex items-center gap-1">
            <Layers className="w-3 h-3 text-[#E5B842]" />
            {dbSignalHistory.length} ENTRIES LOGGED
          </span>
        </div>

        {dbSignalHistory.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500 bg-[#0B0E14] rounded-lg border border-gray-800">
            No execution logs recorded yet. Signals generated via Copilot will be logged here in real-time.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 bg-[#0B0E14]/70 uppercase text-[10px]">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Signal ID</th>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Direction</th>
                  <th className="py-2.5 px-3">Entry</th>
                  <th className="py-2.5 px-3">TP1 / TP2</th>
                  <th className="py-2.5 px-3">Stop Loss</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3">Status / Ticket</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {dbSignalHistory.map((item) => {
                  const sigDir = item.direction || 'BUY';
                  const isBuyLog = sigDir === 'BUY';
                  const isSellLog = sigDir === 'SELL';

                  const displayTime = item.timestamp
                    ? new Date(item.timestamp).toLocaleTimeString('en-US', {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : 'Now';

                  return (
                    <tr key={item.id || item.signalId} className="hover:bg-[#0B0E14]/50 transition-colors">
                      <td className="py-3 px-3 font-mono text-gray-300 font-bold whitespace-nowrap">{displayTime}</td>
                      <td className="py-3 px-3 font-mono text-amber-300 text-[11px] font-bold whitespace-nowrap">
                        {item.signalId || item.id}
                      </td>
                      <td className="py-3 px-3 font-bold text-gray-400 whitespace-nowrap">{item.symbol || 'XAUUSD'}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold ${
                            isBuyLog
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isSellLog
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                          }`}
                        >
                          {isBuyLog && <ArrowUpRight className="w-3 h-3" />}
                          {isSellLog && <ArrowDownRight className="w-3 h-3" />}
                          {sigDir}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-extrabold text-white whitespace-nowrap">
                        ${normalizeCentPrice(item.signalEntryPrice || item.entryPrice || item.price, item.symbol || 'XAUUSD').toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-emerald-400 font-bold whitespace-nowrap">
                        ${normalizeCentPrice(item.takeProfit1, item.symbol || 'XAUUSD').toFixed(2)}
                        {item.takeProfit2 ? ` / $${normalizeCentPrice(item.takeProfit2, item.symbol || 'XAUUSD').toFixed(2)}` : ''}
                      </td>
                      <td className="py-3 px-3 text-rose-400 font-bold whitespace-nowrap">
                        ${normalizeCentPrice(item.stopLoss, item.symbol || 'XAUUSD').toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-[#E5B842] font-extrabold whitespace-nowrap">{item.aiConfidence}%</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.status === 'EXECUTED'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {item.status || 'ACTIVE'}
                          </span>
                          {item.mt5Ticket && (
                            <span className="text-[10px] text-amber-300 font-mono">#{item.mt5Ticket}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SPILLA AI Credit Wallet & Top Up Modal */}
      <CreditWalletModal
        isOpen={isCreditWalletOpen}
        onClose={() => setIsCreditWalletOpen(false)}
        authToken={effectiveAuthToken}
        onBalanceUpdated={fetchCreditBalance}
      />

      {/* Insufficient Credit Alert Modal */}
      <InsufficientCreditModal
        isOpen={isInsufficientCreditOpen}
        onClose={() => setIsInsufficientCreditOpen(false)}
        currentBalance={userCreditBalance}
        requiredCredit={100}
        onOpenTopUp={() => {
          setIsInsufficientCreditOpen(false);
          setIsCreditWalletOpen(true);
        }}
      />
    </div>
  );
};
