import {
  AnalysisHistoryRecord,
  CollectorStatus,
  EngineSettings,
  SystemLog,
  FundamentalIndicator,
  TraderLoginRecord,
  ActiveSignal,
  CopilotTradePlanSnapshot,
} from '../../src/types.js';
import { marketDataService } from '../services/marketDataService.js';

class InMemoryDatabase {
  private history: AnalysisHistoryRecord[] = [];
  private activeSignals: Map<string, ActiveSignal> = new Map();
  private activeTradePlanSnapshots: Map<string, CopilotTradePlanSnapshot> = new Map();
  private logs: SystemLog[] = [];
  private traderLogins: TraderLoginRecord[] = [];
  private collectorStatuses: Map<string, CollectorStatus> = new Map();
  private settings: EngineSettings = {
    fundamentalWeights: {
      INTEREST_RATE: 10,
      INFLATION_CPI: 9,
      FED_PROBABILITY: 9,
      TREASURY_YIELD_10Y: 8,
      DOLLAR_INDEX: 8,
      NFP_JOBS: 7,
      GDP_GROWTH: 7,
      GOLD_ETF_FLOW: 7,
      MONEY_SUPPLY_M2: 6,
      MANUFACTURING_PMI: 5,
      PPI_INFLATION: 5,
      RETAIL_SALES: 5,
      CONSUMER_CONFIDENCE: 4,
    },
    technicalWeights: {
      rsi: 8,
      macd: 8,
      ema: 9,
      pivot: 7,
      timeframeConfluence: 10,
    },
    riskTolerance: 'MODERATE',
    autoSyncIntervalSeconds: 30,
    enableAiReasoning: true,
  };

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    // Seed initial logs
    this.addLog('INFO', 'SYSTEM', 'SPILLA GOLD Analysis Engine initialized.');
    this.addLog('INFO', 'COLLECTOR_MGR', 'Booting modular collectors for ForexFactory, MetaTrader 5 (MT5), FRED, COT, WGC...');

    // Seed collectors status
    const collectorsList = [
      { id: 'forex_factory', name: 'ForexFactory Collector', source: 'ForexFactory API / RSS' },
      { id: 'mt5', name: 'MetaTrader 5 (MT5) Collector', source: 'MT5 Terminal Bridge API' },
      { id: 'investing_com', name: 'Investing.com Collector', source: 'Investing.com Macro' },
      { id: 'fred', name: 'FRED Collector', source: 'St. Louis Fed API' },
      { id: 'trading_economics', name: 'Trading Economics Collector', source: 'Trading Economics' },
      { id: 'reuters', name: 'Reuters News Collector', source: 'Reuters Financial Wire' },
      { id: 'kitco', name: 'Kitco Gold Collector', source: 'Kitco Metals Data' },
      { id: 'world_gold_council', name: 'World Gold Council Collector', source: 'World Gold Council' },
      { id: 'cot_cftc', name: 'COT Report Collector', source: 'CFTC Gold Futures' },
      { id: 'cme_fedwatch', name: 'CME FedWatch Collector', source: 'CME Group Interest Rate Tool' },
      { id: 'ice_dxy', name: 'ICE Dollar Index Collector', source: 'ICE Futures US DXY' },
      { id: 'bls', name: 'BLS Collector', source: 'US Bureau of Labor Statistics' },
      { id: 'bea', name: 'BEA Collector', source: 'US Bureau of Economic Analysis' },
      { id: 'treasury', name: 'US Treasury Collector', source: 'US Dept of Treasury Yields' },
    ];

    const now = new Date().toISOString();
    collectorsList.forEach((col) => {
      this.collectorStatuses.set(col.id, {
        id: col.id,
        name: col.name,
        source: col.source,
        lastRun: now,
        status: 'HEALTHY',
        latencyMs: Math.floor(Math.random() * 80) + 40,
        itemCount: Math.floor(Math.random() * 50) + 120,
      });
    });

    // Seed mock initial history
    const pastRecords: AnalysisHistoryRecord[] = [
      {
        id: 'HIST-1001',
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        price: 4242.20,
        symbol: 'XAUUSD',
        recommendation: 'STRONG_BUY',
        fundamentalScore: 84,
        technicalScore: 88,
        sentimentScore: 79,
        riskScore: 32,
        aiConfidence: 91,
        entryPrice: 4243.00,
        stopLoss: 4226.00,
        takeProfit1: 4265.00,
        riskRewardRatio: 2.35,
        status: 'HIT_TP1',
        returnPips: 160,
      },
      {
        id: 'HIST-1002',
        timestamp: new Date(Date.now() - 3600000 * 12).toISOString(),
        price: 4235.10,
        symbol: 'XAUUSD',
        recommendation: 'BUY',
        fundamentalScore: 78,
        technicalScore: 81,
        sentimentScore: 72,
        riskScore: 40,
        aiConfidence: 85,
        entryPrice: 4236.50,
        stopLoss: 4221.00,
        takeProfit1: 4252.00,
        riskRewardRatio: 2.10,
        status: 'HIT_TP2',
        returnPips: 310,
      },
      {
        id: 'HIST-1003',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        price: 4258.90,
        symbol: 'XAUUSD',
        recommendation: 'WAIT',
        fundamentalScore: 52,
        technicalScore: 49,
        sentimentScore: 55,
        riskScore: 78,
        aiConfidence: 62,
        entryPrice: 4258.90,
        stopLoss: 4275.00,
        takeProfit1: 4240.00,
        riskRewardRatio: 1.80,
        status: 'EXPIRED',
        returnPips: 0,
      },
    ];

    // Seed initial trader logins for demonstration
    this.traderLogins = [
      {
        id: 'TLOG-1001',
        identifier: 'trader1@email.com',
        accountNumber: '88201923',
        brokerServer: 'AIMS-Live',
        loginDate: '11-08-2026',
        loginTime: '20:00:00',
        status: 'SUCCESS',
        selectedMaster: 'SPILLA INFINITY',
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: 'TLOG-1002',
        identifier: 'trader2@email.com',
        accountNumber: '88204811',
        brokerServer: 'AIMS-Live',
        loginDate: '11-08-2026',
        loginTime: '20:15:00',
        status: 'SUCCESS',
        selectedMaster: 'SPILLA ELITE',
        createdAt: new Date(Date.now() - 3600000 * 1).toISOString(),
      },
    ];

    this.history = pastRecords;
  }

  public getActiveTradePlanSnapshot(symbol?: string): CopilotTradePlanSnapshot | null {
    const sym = (symbol || 'XAUUSD').trim().toUpperCase();
    return this.activeTradePlanSnapshots.get(sym) || null;
  }

  public setActiveTradePlanSnapshot(snapshot: CopilotTradePlanSnapshot): CopilotTradePlanSnapshot {
    const sym = (snapshot.symbol || 'XAUUSD').trim().toUpperCase();
    const oldSnapshot = this.activeTradePlanSnapshots.get(sym);
    if (oldSnapshot && oldSnapshot.planId !== snapshot.planId) {
      console.log(
        `[TRADE PLAN MUTATION] Plan replaced for ${sym}:\n  Old Plan ID: ${oldSnapshot.planId} (Planned Entry: ${oldSnapshot.trade_plan.entry_price})\n  New Plan ID: ${snapshot.planId} (Planned Entry: ${snapshot.trade_plan.entry_price})\n  Timestamp: ${new Date().toISOString()}\n  Source: CREATE_NEW_PLAN\n  Reason: Explicit Plan Generation`
      );
    }
    this.activeTradePlanSnapshots.set(sym, snapshot);
    return snapshot;
  }

  public logTradePlanMutation(planId: string, oldPlannedEntry: number, newPlannedEntry: number, source: string, reason: string) {
    console.log(
      `[TRADE PLAN MUTATION]\n  Plan ID: ${planId}\n  Old Planned Entry: ${oldPlannedEntry}\n  New Planned Entry: ${newPlannedEntry}\n  Source: ${source}\n  Reason: ${reason}\n  Timestamp: ${new Date().toISOString()}`
    );
  }

  public getSettings(): EngineSettings {
    return this.settings;
  }

  public updateSettings(newSettings: Partial<EngineSettings>): EngineSettings {
    this.settings = { ...this.settings, ...newSettings };
    this.addLog('INFO', 'SETTINGS', 'Engine parameters updated by user.');
    return this.settings;
  }

  public getHistory(symbol?: string): AnalysisHistoryRecord[] {
    if (symbol) {
      const sym = symbol.trim().toUpperCase();
      return this.history.filter((h) => (h.symbol || 'XAUUSD').toUpperCase() === sym);
    }
    return this.history;
  }

  public getActiveSignal(symbol?: string): ActiveSignal | null {
    const sym = (symbol || 'XAUUSD').trim().toUpperCase();
    const signal = this.activeSignals.get(sym);
    if (!signal) return null;

    // Stale Signal Protection: If active signal entry price differs significantly from live market price, expire it
    const currentMarketPrice = marketDataService.getCurrentPrice(sym);
    const priceDiff = Math.abs(signal.entryPrice - currentMarketPrice);
    const ageMinutes = (Date.now() - new Date(signal.createdAt).getTime()) / 60000;
    const maxThreshold = sym === 'BTCUSD' ? 500.0 : sym.includes('XAU') ? 15.0 : 0.01;

    if (priceDiff > maxThreshold || ageMinutes > 60) {
      console.log(`[FORENSIC STALE SIGNAL EXPIRED] Expiry triggered for ${sym} signal ${signal.signalId}: entryPrice=${signal.entryPrice}, currentMarketPrice=${currentMarketPrice}, diff=${priceDiff.toFixed(2)}, age=${ageMinutes.toFixed(1)}m`);
      signal.status = 'EXPIRED';
      this.activeSignals.delete(sym);
      return null;
    }

    console.log(`[FORENSIC DATABASE ACTIVE SIGNAL] symbol=${sym} signalId=${signal.signalId} entryPrice=${signal.entryPrice} status=${signal.status}`);
    return signal;
  }

  public setActiveSignal(signal: Partial<ActiveSignal>): ActiveSignal {
    const now = new Date().toISOString();
    const sym = (signal.symbol || 'XAUUSD').trim().toUpperCase();
    const signalId = signal.signalId || `SIG-${now.replace(/[-:T.]/g, '').slice(0, 12)}`;
    const aiEntry = signal.signalEntryPrice ?? signal.entryPrice ?? 0;
    
    const fullSignal: ActiveSignal = {
      signalId,
      symbol: sym,
      direction: signal.direction || 'BUY',
      confidence: signal.confidence ?? 90,
      entryPrice: aiEntry, // AI Signal Entry Price (Immutable)
      signalEntryPrice: aiEntry, // Explicit AI Signal Entry Price
      requestedExecutionPrice: signal.requestedExecutionPrice,
      actualExecutionPrice: signal.actualExecutionPrice,
      executionSlippage: signal.executionSlippage,
      executedAt: signal.executedAt,
      takeProfit1: signal.takeProfit1 ?? 0,
      takeProfit2: signal.takeProfit2 ?? 0,
      takeProfit3: signal.takeProfit3,
      stopLoss: signal.stopLoss ?? 0,
      riskReward: signal.riskReward || '1 : 2.0',
      reasoning: signal.reasoning || 'AI Multi-Engine Confluence Signal',
      status: signal.status || 'ACTIVE',
      mt5Ticket: signal.mt5Ticket,
      executionStatus: signal.executionStatus || 'NONE',
      closedResult: signal.closedResult,
      createdAt: signal.createdAt || now,
      updatedAt: now,
    };

    this.activeSignals.set(sym, fullSignal);
    console.log(`[FORENSIC SET ACTIVE SIGNAL] symbol=${sym} signalId=${fullSignal.signalId} signalEntryPrice=${fullSignal.entryPrice} status=${fullSignal.status}`);

    // Upsert into signal history
    const existingIndex = this.history.findIndex((h) => h.signalId === signalId);
    const histRecord: AnalysisHistoryRecord = {
      id: `HIST-${signalId}`,
      signalId,
      timestamp: fullSignal.createdAt,
      symbol: fullSignal.symbol,
      price: fullSignal.entryPrice,
      recommendation: fullSignal.direction === 'BUY' ? 'BUY' : fullSignal.direction === 'SELL' ? 'SELL' : 'WAIT',
      direction: fullSignal.direction,
      fundamentalScore: 80,
      technicalScore: 82,
      sentimentScore: 78,
      riskScore: 35,
      aiConfidence: fullSignal.confidence,
      entryPrice: fullSignal.entryPrice,
      signalEntryPrice: fullSignal.entryPrice,
      requestedExecutionPrice: fullSignal.requestedExecutionPrice,
      actualExecutionPrice: fullSignal.actualExecutionPrice,
      executionSlippage: fullSignal.executionSlippage,
      executedAt: fullSignal.executedAt,
      stopLoss: fullSignal.stopLoss,
      takeProfit1: fullSignal.takeProfit1,
      takeProfit2: fullSignal.takeProfit2,
      takeProfit3: fullSignal.takeProfit3,
      riskRewardRatio: fullSignal.riskReward,
      status: fullSignal.status as any,
      mt5Ticket: fullSignal.mt5Ticket,
      executionStatus: fullSignal.executionStatus,
      closedResult: fullSignal.closedResult,
      reasoning: fullSignal.reasoning,
    };

    if (existingIndex >= 0) {
      this.history[existingIndex] = { ...this.history[existingIndex], ...histRecord };
    } else {
      this.history.unshift(histRecord);
      if (this.history.length > 200) this.history.pop();
    }

    this.addLog('INFO', 'AI_SIGNAL', `Active signal updated for ${sym}: ${signalId} [${fullSignal.direction}] @ ${fullSignal.entryPrice}`);
    return fullSignal;
  }

  public updateSignalExecution(
    signalId: string,
    updates: {
      mt5Ticket?: number | string;
      executionStatus?: 'NONE' | 'PENDING' | 'EXECUTED' | 'FAILED';
      status?: 'PENDING' | 'ACTIVE' | 'EXECUTED' | 'EXECUTION_PENDING' | 'EXECUTION_FAILED' | 'HIT_TP1' | 'HIT_TP2' | 'HIT_SL' | 'EXPIRED' | 'CLOSED';
      requestedExecutionPrice?: number;
      actualExecutionPrice?: number;
      executionSlippage?: number;
      executedAt?: string;
      closedResult?: string;
      returnPips?: number;
      symbol?: string;
    }
  ): ActiveSignal | null {
    const now = new Date().toISOString();
    let targetSignal: ActiveSignal | null = null;
    let targetSym = updates.symbol;

    if (targetSym) {
      targetSignal = this.activeSignals.get(targetSym.trim().toUpperCase()) || null;
    } else {
      for (const [sym, sig] of this.activeSignals.entries()) {
        if (sig.signalId === signalId) {
          targetSignal = sig;
          targetSym = sym;
          break;
        }
      }
    }

    if (targetSignal && targetSym) {
      const reqPrice = updates.requestedExecutionPrice ?? targetSignal.requestedExecutionPrice ?? targetSignal.signalEntryPrice ?? targetSignal.entryPrice;
      const actPrice = updates.actualExecutionPrice ?? targetSignal.actualExecutionPrice;

      let slippage = updates.executionSlippage;
      if (slippage === undefined && actPrice !== undefined) {
        const isBuy = targetSignal.direction === 'BUY';
        slippage = isBuy ? actPrice - reqPrice : reqPrice - actPrice;
        slippage = Number(slippage.toFixed(2));
      }

      const updatedSignal = {
        ...targetSignal,
        ...(updates.mt5Ticket !== undefined && { mt5Ticket: updates.mt5Ticket }),
        ...(updates.executionStatus && { executionStatus: updates.executionStatus }),
        ...(updates.status && { status: updates.status as any }),
        requestedExecutionPrice: reqPrice,
        ...(actPrice !== undefined && { actualExecutionPrice: actPrice }),
        ...(slippage !== undefined && { executionSlippage: slippage }),
        executedAt: updates.executedAt || targetSignal.executedAt || now,
        ...(updates.closedResult !== undefined && { closedResult: updates.closedResult }),
        updatedAt: now,
      };

      this.activeSignals.set(targetSym, updatedSignal);
      targetSignal = updatedSignal;

      console.log(`[EXECUTION UPDATE] Symbol=${targetSym} Signal=${targetSignal.signalId} SignalEntry=${targetSignal.entryPrice} Requested=${reqPrice} ActualFill=${actPrice} Slippage=${slippage} Ticket=#${updates.mt5Ticket}`);
    }

    // Update history record
    const target = this.history.find((h) => h.signalId === signalId);
    if (target) {
      const reqPrice = updates.requestedExecutionPrice ?? target.requestedExecutionPrice ?? target.signalEntryPrice ?? target.entryPrice;
      const actPrice = updates.actualExecutionPrice ?? target.actualExecutionPrice;

      let slippage = updates.executionSlippage;
      if (slippage === undefined && actPrice !== undefined) {
        const isBuy = target.direction === 'BUY' || target.recommendation === 'BUY';
        slippage = isBuy ? actPrice - reqPrice : reqPrice - actPrice;
        slippage = Number(slippage.toFixed(2));
      }

      if (updates.mt5Ticket !== undefined) target.mt5Ticket = updates.mt5Ticket;
      if (updates.executionStatus) target.executionStatus = updates.executionStatus;
      if (updates.status) target.status = updates.status;
      target.requestedExecutionPrice = reqPrice;
      if (actPrice !== undefined) target.actualExecutionPrice = actPrice;
      if (slippage !== undefined) target.executionSlippage = slippage;
      target.executedAt = updates.executedAt || target.executedAt || now;
      if (updates.closedResult !== undefined) target.closedResult = updates.closedResult;
      if (updates.returnPips !== undefined) target.returnPips = updates.returnPips;
    }

    this.addLog('INFO', 'EA_EXECUTION', `Signal execution updated for ${signalId}: status=${updates.status}, ticket=${updates.mt5Ticket}, fillPrice=${updates.actualExecutionPrice}`);
    return targetSignal;
  }

  public addHistoryRecord(record: Omit<AnalysisHistoryRecord, 'id'>): AnalysisHistoryRecord {
    const fullRecord: AnalysisHistoryRecord = {
      ...record,
      id: `HIST-${Date.now().toString().slice(-6)}`,
    };
    this.history.unshift(fullRecord);
    if (this.history.length > 200) {
      this.history.pop();
    }
    return fullRecord;
  }

  public getLogs(): SystemLog[] {
    return this.logs;
  }

  public addLog(level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', module: string, message: string, details?: string) {
    const log: SystemLog = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      level,
      module,
      message,
      details,
    };
    this.logs.unshift(log);
    if (this.logs.length > 300) {
      this.logs.pop();
    }
  }

  public getCollectorStatuses(): CollectorStatus[] {
    return Array.from(this.collectorStatuses.values());
  }

  public updateCollectorStatus(id: string, updates: Partial<CollectorStatus>) {
    const existing = this.collectorStatuses.get(id);
    if (existing) {
      this.collectorStatuses.set(id, { ...existing, ...updates, lastRun: new Date().toISOString() });
    }
  }

  public getTraderLogins(): TraderLoginRecord[] {
    return this.traderLogins;
  }

  public addTraderLogin(record: Omit<TraderLoginRecord, 'id' | 'createdAt' | 'loginDate' | 'loginTime'>): TraderLoginRecord {
    const now = new Date();
    // Format date as DD-MM-YYYY
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const loginDate = `${day}-${month}-${year}`;

    // Format time as HH:MM:SS
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const loginTime = `${hours}:${minutes}:${seconds}`;

    const newRecord: TraderLoginRecord = {
      id: `TLOG-${Date.now()}`,
      identifier: record.identifier.trim(),
      accountNumber: record.accountNumber ? record.accountNumber.trim() : '-',
      brokerServer: record.brokerServer ? record.brokerServer.trim() : 'AIMS-Live',
      loginDate,
      loginTime,
      status: record.status || 'SUCCESS',
      selectedMaster: record.selectedMaster,
      createdAt: now.toISOString(),
    };

    this.traderLogins.unshift(newRecord);
    if (this.traderLogins.length > 500) {
      this.traderLogins.pop();
    }
    return newRecord;
  }
}

export const db = new InMemoryDatabase();
