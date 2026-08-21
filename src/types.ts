export interface TraderLoginRecord {
  id: string;
  identifier: string;
  accountNumber?: string;
  brokerServer?: string;
  loginDate: string;
  loginTime: string;
  status: 'SUCCESS' | 'FAILED';
  selectedMaster: string;
  createdAt: string;
}

export type MarketStatus = 'OPEN' | 'CLOSED' | 'PRE_MARKET';
export type TradingSession = 'ASIAN' | 'LONDON' | 'NEW_YORK' | 'LONDON_NY_OVERLAP' | 'OFF_HOURS';
export type SignalType = 'STRONG_BUY' | 'BUY' | 'WAIT' | 'SELL' | 'STRONG_SELL';
export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type SentimentType = 'BULLISH' | 'BEARISH' | 'NEUTRAL';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ProviderType = 'OFFICIAL_API' | 'RSS_FEED' | 'WEB_SCRAPER' | 'PLACEHOLDER';

export interface ValidationResult {
  synced: boolean;
  status: 'VALID' | 'PRICE_MISMATCH' | 'WAITING_FOR_DATA';
  message: string;
  price?: number;
  chartClose?: number;
  timestamp?: string;
}

export interface ProviderStatus {
  id: string;
  name: string;
  type: ProviderType;
  description: string;
  dataType: string;
  requiresApiKey: boolean;
  hasOfficialApi: boolean;
  refreshInterval: string;
  status: 'ONLINE' | 'WARNING' | 'OFFLINE' | 'UNCONFIGURED';
  message: string;
  lastUpdate: string;
  responseTimeMs: number;
}

export interface MarketPrice {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  high24h: number;
  low24h: number;
  change24h: number;
  change24hPercent: number;
  spread: number;
  timestamp: string;
  status: MarketStatus;
  session: TradingSession;
  dollarIndex: number;
  treasuryYield10Y: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicator {
  name: string;
  value: number;
  signal: SentimentType;
  description: string;
}

export interface SupportResistance {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export interface TechnicalScore {
  score: number; // 0-100
  status: SentimentType;
  rsi: { value: number; signal: SentimentType };
  macd: { macdLine: number; signalLine: number; histogram: number; signal: SentimentType };
  ema20: number;
  ema50: number;
  ema200: number;
  sma50: number;
  sma200: number;
  atr14: number;
  adx14: number;
  pivotPoints: SupportResistance;
  timeframeAnalysis: {
    M15: SentimentType;
    H1: SentimentType;
    H4: SentimentType;
    D1: SentimentType;
  };
  reasoning: string[];
}

export interface FundamentalIndicator {
  id: string;
  name: string;
  category: string;
  actual: string | number;
  forecast: string | number;
  previous: string | number;
  impact: ImpactLevel;
  weight: number; // 1-10
  bias: SentimentType;
  description: string;
}

export interface FundamentalScore {
  score: number; // 0-100
  status: SentimentType;
  indicators: FundamentalIndicator[];
  reasoning: string[];
}

export interface CotData {
  commercialLongs: number;
  commercialShorts: number;
  nonCommercialLongs: number; // Speculators
  nonCommercialShorts: number;
  netPositionSpeculators: number;
  changeFromLastWeek: number;
  sentiment: SentimentType;
}

export interface EtfFlow {
  date: string;
  gldHoldingsTonnes: number;
  netFlowTonnes: number;
  netFlowUsdMillions: number;
  sentiment: SentimentType;
}

export interface MarketNews {
  id: string;
  source: string;
  title: string;
  summary: string;
  url?: string;
  timestamp: string;
  impact: ImpactLevel;
  sentiment: SentimentType;
  category: 'CENTRAL_BANK' | 'GEOPOLITICAL' | 'GOLD_DEMAND' | 'MACRO' | 'MARKETS';
}

export interface SentimentScore {
  score: number; // 0-100
  status: SentimentType;
  cot: CotData;
  etf: EtfFlow;
  newsSentiment: {
    bullishPercent: number;
    bearishPercent: number;
    neutralPercent: number;
  };
  reasoning: string[];
}

export interface RiskScore {
  score: number; // 0-100
  level: RiskLevel;
  volatility: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  spreadRisk: 'NORMAL' | 'ELEVATED' | 'WIDE';
  liquidity: 'HIGH' | 'MEDIUM' | 'THIN';
  newsProximityMinutes: number; // Minutes to next high-impact news
  sessionRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  atrPercent: number;
  warnings: string[];
  reasoning: string[];
}

export interface AiConfidence {
  score: number; // 0-100
  level: 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW';
  marketNarrative: string;
  keyDrivers: string[];
  bullCase: string;
  baseCase: string;
  bearCase: string;
  reasoning: string;
  modelUsed: string;
  timestamp: string;
}

export interface TradeSetup {
  signal: SignalType;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  riskRewardRatio: number;
  riskAmountPercent: number;
  suggestedLotSize: number; // Per $10k account
  reasoning: string[];
  strategyType: 'TREND_FOLLOWING' | 'BREAKOUT' | 'COUNTER_TREND' | 'RANGE_BOUND';
}

export interface RecommendationResponse {
  symbol: string;
  currentPrice: number;
  timestamp: string;
  recommendation: SignalType;
  setup: TradeSetup;
  fundamentalScore: FundamentalScore;
  technicalScore: TechnicalScore;
  sentimentScore: SentimentScore;
  riskScore: RiskScore;
  aiConfidence: AiConfidence;
  validation?: ValidationResult;
}

export interface EconomicEvent {
  id: string;
  time: string;
  currency: string;
  event: string;
  impact: ImpactLevel;
  actual?: string;
  forecast?: string;
  previous?: string;
  unit?: string;
  date: string;
}

export interface ActiveSignal {
  signalId: string;
  symbol: string;
  direction: 'BUY' | 'SELL' | 'WAIT';
  confidence: number;
  entryPrice: number; // AI Signal Entry Price (Immutable)
  signalEntryPrice?: number; // AI Signal Entry Price (Explicit Alias)
  requestedExecutionPrice?: number; // Price sent by EA to broker
  actualExecutionPrice?: number; // Price filled by broker/MT5
  executionSlippage?: number; // Slippage (actual - requested)
  executedAt?: string; // MT5 Execution Timestamp
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3?: number;
  stopLoss: number;
  riskReward: string | number;
  reasoning: string;
  status: 'ACTIVE' | 'EXECUTED' | 'EXECUTION_PENDING' | 'EXECUTION_FAILED' | 'HIT_TP1' | 'HIT_TP2' | 'HIT_SL' | 'CLOSED' | 'EXPIRED';
  mt5Ticket?: number | string;
  executionStatus?: 'NONE' | 'PENDING' | 'EXECUTED' | 'FAILED';
  closedResult?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisHistoryRecord {
  id: string;
  signalId?: string;
  timestamp: string;
  symbol?: string;
  price: number;
  recommendation: SignalType;
  direction?: 'BUY' | 'SELL' | 'WAIT';
  fundamentalScore: number;
  technicalScore: number;
  sentimentScore: number;
  riskScore: number;
  aiConfidence: number;
  entryPrice: number; // AI Signal Entry Price
  signalEntryPrice?: number; // AI Signal Entry Price (Explicit Alias)
  requestedExecutionPrice?: number; // Price sent by EA to broker
  actualExecutionPrice?: number; // Price filled by broker/MT5
  executionSlippage?: number; // Slippage (actual - requested)
  executedAt?: string; // MT5 Execution Timestamp
  stopLoss: number;
  takeProfit1: number;
  takeProfit2?: number;
  takeProfit3?: number;
  riskRewardRatio: number | string;
  status: 'PENDING' | 'ACTIVE' | 'EXECUTED' | 'EXECUTION_PENDING' | 'EXECUTION_FAILED' | 'HIT_TP1' | 'HIT_TP2' | 'HIT_SL' | 'EXPIRED' | 'CLOSED';
  mt5Ticket?: number | string;
  executionStatus?: 'NONE' | 'PENDING' | 'EXECUTED' | 'FAILED';
  closedResult?: string;
  returnPips?: number;
  reasoning?: string;
}

export interface CollectorStatus {
  id: string;
  name: string;
  source: string;
  lastRun: string;
  status: 'HEALTHY' | 'SYNCING' | 'DEGRADED' | 'ERROR';
  latencyMs: number;
  itemCount: number;
  lastError?: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  module: string;
  message: string;
  details?: string;
}

export interface EngineSettings {
  fundamentalWeights: Record<string, number>; // Indicator ID -> weight 1 to 10
  technicalWeights: {
    rsi: number;
    macd: number;
    ema: number;
    pivot: number;
    timeframeConfluence: number;
  };
  riskTolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  autoSyncIntervalSeconds: number;
  enableAiReasoning: boolean;
}

export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'PENDING' | 'SUSPENDED';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  accountType?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: AuthUser;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  pendingUsers: number;
  adminCount: number;
}

export interface Mt5PayloadIndicators {
  ema_20: number;
  ema_50: number;
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
  volume: number;
}

export interface Mt5Payload {
  symbol: string;
  timeframe: string;
  current_price: number;
  price?: number;
  bid?: number;
  ask?: number;
  indicators: Mt5PayloadIndicators;
  candles: Array<{
    time: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
    vol?: number;
    volume?: number;
  }>;
}

export interface Mt5AiAnalysisResult {
  fundamental_score: number;
  technical_score: number;
  market_sentiment: number;
  risk_score: number;
  ai_confidence: number;
  trade_quality_score: number;
  signal: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';
  execution_plan: {
    entry_price: number;
    stop_loss: number;
    take_profit_1: number;
    risk_reward_ratio: string;
  };
  analysis_summary: string;
}

// --- COPILOT PHASE 1 SPECIFICATION TYPES ---

export type MarketCondition = 'BULLISH' | 'BEARISH' | 'SIDEWAY' | 'SIDEWAYS' | 'TRANSITION' | 'NO_TRADE';
export type TradingAction = 'BUY' | 'SELL' | 'WAIT' | 'NONE' | 'NO TRADE' | 'NO_TRADE';
export type EntryMode = 'MARKET' | 'PULLBACK' | 'BREAKOUT' | 'RETEST' | 'NONE';
export type ExecutionStatus = 'READY' | 'WAIT FOR CONFIRMATION' | 'NO TRADE';
export type PotentialDirection = 'BUY' | 'SELL' | 'NONE';

export interface SymbolSpecification {
  symbol: string;
  name: string;
  category: 'METALS' | 'FOREX' | 'CRYPTO' | 'INDICES';
  contractSize: number;
  tickSize: number;
  tickValue: number;
  volumeMin: number;
  volumeMax: number;
  volumeStep: number;
  digits: number;
  point: number;
  stopsLevel: number;
  freezeLevel: number;
  tradeMode: 'FULL_ACCESS' | 'CLOSE_ONLY' | 'DISABLED';
  currencyBase: string;
  currencyProfit: string;
  currencyMargin: string;
  maxSpreadPoints: number;
  defaultSpreadPoints: number;
}

export type PositionSizingMode = 'RISK_PERCENT' | 'FIXED_LOT' | 'FIXED_RISK_AMOUNT';

export interface PositionSizingInput {
  accountEquity: number;
  mode: PositionSizingMode;
  riskPercent?: number;
  fixedLot?: number;
  fixedRiskAmount?: number;
  entryPrice: number;
  stopLoss: number;
  symbol: string;
}

export interface PositionSizingResult {
  mode: PositionSizingMode;
  risk_percent: number;
  risk_amount: number;
  calculated_lot: number;
  normalized_lot: number;
  estimated_loss_at_sl: number;
  margin_required: number;
  lot_validation: {
    valid: boolean;
    reason?: string;
  };
}

export type ValidationCheckStatus = 'PASS' | 'FAIL' | 'WARNING';

export interface ValidationChecks {
  confidence: ValidationCheckStatus;
  risk_reward: ValidationCheckStatus;
  spread: ValidationCheckStatus;
  news: ValidationCheckStatus;
  multi_timeframe: ValidationCheckStatus;
  market_session: ValidationCheckStatus;
  margin: ValidationCheckStatus;
}

export interface TradeEligibilityResult {
  eligible: boolean;
  status: 'APPROVED' | 'NO_TRADE';
  reasons: string[];
  codes: string[];
  checks: ValidationChecks;
}

export interface MultiTimeframeSummary {
  bias: SentimentType;
  trend: string;
  structure: string;
  keyLevel: string;
}

export type SetupType = 'TREND_CONTINUATION' | 'PULLBACK' | 'COUNTER-TREND' | 'RANGE_BREAKOUT' | 'NONE';
export type RiskClass = 'NORMAL_RISK' | 'HIGHER_RISK' | 'MAX_RISK';
export type TradingStyle = 'SCALPING' | 'INTRADAY';
export type DirectionBias = 'BUY' | 'SELL';

export interface StandardizedAiAnalysis {
  analysis_id: string;
  symbol: string;
  timeframe: string;
  tradingStyle?: TradingStyle;
  selectedTimeframe?: string;
  primaryTimeframe?: string;
  primary_bias?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  primaryTimeframeDirection?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  setup_type?: SetupType;
  risk_class?: RiskClass;
  validation_error?: string;
  timestamp: string;
  market_condition: MarketCondition;
  action: TradingAction;
  confidence: number;
  bias: string;
  chart_detected_price?: number;
  direction_bias?: DirectionBias;
  directional_bias?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  potential_direction: PotentialDirection;
  entry_mode: EntryMode;
  trigger_required: string;
  market_bias?: string;
  bias_signal?: 'BUY' | 'SELL' | 'WAIT' | 'NO TRADE';
  setup_quality?: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY STRONG';
  macro_direction?: string;
  macro_direction_h1?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  h1_macro?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  micro_structure?: string;
  micro_direction_m15?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  m15_micro?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  primary_confluence?: string[];
  risk_flags?: string[];
  execution_status: ExecutionStatus;
  invalidation?: string;
  planned_entry_zone?: string;
  potential_entry_zone?: string;
  stop_loss_reason?: string;
  take_profit_1_reason?: string;
  take_profit_2_reason?: string;
  analysis_summary?: string[];
  why?: string;
  reason?: string;
  next_condition?: string;
  next_action?: string;
  rr_tp1?: string | number;
  rr_tp2?: string | number;
  multi_timeframe: {
    D1: MultiTimeframeSummary;
    H4: MultiTimeframeSummary;
    H1: MultiTimeframeSummary;
    M15: MultiTimeframeSummary;
  };
  trade_plan: {
    entry_zone: {
      min: number;
      max: number;
    };
    entry_price: number;
    planned_entry?: number;
    stop_loss: number;
    take_profit_1: number;
    take_profit_2: number;
    take_profit_3?: number;
    risk_reward_ratio: number;
  };
  key_drivers: string[];
  invalidation_condition: string[];
  market_narrative: string;
  warnings: string[];
}

export interface MarketSnapshot {
  snapshot_id: string;
  id?: string;
  symbol: string;
  timestamp: string;
  source: 'MT5' | 'YAHOO_FINANCE' | 'INSTITUTIONAL_FEED';
  broker_source?: string;
  bid: number;
  ask: number;
  mid_price: number;
  midPrice?: number;
  spread: number;
  timeframe: string;
  candle_timestamp: string;
  candle_open: number;
  candle_high: number;
  candle_low: number;
  candle_close: number;
  candleTelemetry?: {
    timeframe: string;
    open: number;
    high: number;
    low: number;
    close: number;
  };
}

export interface CopilotTradePlanSnapshot {
  trade_plan_id: string;
  planId?: string;
  snapshot_id?: string;
  snapshotId?: string;
  captureId?: string;
  capturePrice?: number;
  captureTimestamp?: string;
  captureVersion?: number;
  plannedEntry?: number;
  analysis_id: string;
  signal_id: string;
  risk_validation_id: string;
  symbol: string;
  timeframe: string;
  tradingStyle?: TradingStyle;
  selectedTimeframe?: string;
  primaryTimeframe?: string;
  primary_bias?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  primaryTimeframeDirection?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  direction_bias?: DirectionBias;
  setup_type?: SetupType;
  risk_class?: RiskClass;
  createdAt: string;
  expiresAt: string;
  market_condition: MarketCondition;
  action: TradingAction;
  confidence: number;
  market_price_at_creation: number;
  anchor_price?: number;
  liveAnchorPrice?: number;
  plan_mode?: 'DYNAMIC' | 'LOCKED';
  marketTimestamp?: string;
  tradePlanTimestamp?: string;
  risk_distance?: number;
  source?: 'MT5' | 'YAHOO_FINANCE' | 'INSTITUTIONAL_FEED' | 'CAPTURE_NOW';
  bid: number;
  ask: number;
  spread_points: number;
  trade_plan: {
    entry_zone: {
      min: number;
      max: number;
    };
    planned_entry?: number;
    entry_price: number;
    stop_loss: number;
    take_profit_1: number;
    take_profit_2: number;
    take_profit_3?: number;
    risk_reward_ratio: number;
  };
  eligibility: TradeEligibilityResult;
  position_sizing: PositionSizingResult;
  symbol_spec: SymbolSpecification;
  multi_timeframe: {
    D1: MultiTimeframeSummary;
    H4: MultiTimeframeSummary;
    H1: MultiTimeframeSummary;
    M15: MultiTimeframeSummary;
  };
  key_drivers: string[];
  invalidation_condition: string[];
  market_narrative: string;
  user_confirmed: boolean;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'EXPIRED' | 'TRADE_PLAN_EXPIRED' | 'WAITING' | 'ACTIVE' | 'CANCELLED' | 'DYNAMIC' | 'LOCKED';
  setup_quality?: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY STRONG';
  directional_bias?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  potential_direction?: PotentialDirection;
  entry_mode?: EntryMode;
  trigger_required?: string;
  market_bias?: string;
  bias_signal?: 'BUY' | 'SELL' | 'WAIT' | 'NO TRADE';
  macro_direction?: string;
  macro_direction_h1?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  h1_macro?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  micro_structure?: string;
  micro_direction_m15?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  m15_micro?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  primary_confluence?: string[];
  risk_flags?: string[];
  execution_status?: ExecutionStatus | 'WAIT FOR ENTRY';
  invalidation?: string;
  planned_entry_zone?: string;
  potential_entry_zone?: string;
  stop_loss_reason?: string;
  take_profit_1_reason?: string;
  take_profit_2_reason?: string;
  analysis_summary?: string[];
  why?: string;
  reason?: string;
  next_condition?: string;
  next_action?: string;
  rr_tp1?: string | number;
  rr_tp2?: string | number;
  structured_capture?: any;
  indicators_used?: string[];
  indicator_count?: number;
  price_drift?: number;
  plan_age_seconds?: number;
  actual_execution_price?: number;
  actualEntry?: number;
  mt5_ticket?: number | string;
  chart_objects?: {
    entry: string;
    sl: string;
    tp1: string;
    tp2: string;
  };
}

export interface AnalyzeRequestOptions {
  symbol?: string;
  timeframe?: string;
  selectedTimeframe?: string;
  tradingStyle?: TradingStyle;
  equity?: number;
  riskPercent?: number;
  mode?: PositionSizingMode;
  fixedLot?: number;
  fixedRiskAmount?: number;
  chartImageBase64?: string;
  capturePrice?: number;
  chartRunningPrice?: number;
  captureId?: string;
  captureVersion?: number;
  bid?: number;
  ask?: number;
  mid?: number;
  timestamp?: string;
  indicators?: string[];
}

export interface CopilotConfig {
  AI_MIN_CONFIDENCE: number;
  MIN_RISK_REWARD: number;
  MAX_SPREAD_POINTS: Record<string, number>;
  NEWS_BLACKOUT_MINUTES: number;
  MAX_DAILY_LOSS_PERCENT: number;
  MAX_OPEN_POSITIONS: number;
  MAX_RISK_PERCENT: number;
  DEFAULT_RISK_PERCENT: number;
  DEFAULT_ACCOUNT_EQUITY: number;
  DEFAULT_POSITION_SIZING_MODE: PositionSizingMode;
  PRICE_DEVIATION_THRESHOLD: number;
  MAX_TRADE_PLAN_AGE_SECONDS: number;
}

export interface CopilotExecutionRequest {
  idempotency_key: string;
  trade_plan_id: string;
  analysis_id?: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  volume: number;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  magic_number?: number;
  user_confirmed: boolean;
  account_id?: string;
}

export interface CopilotExecutionResponse {
  success: boolean;
  code: string;
  message: string;
  execution_id?: string;
  broker_order_id?: string | number;
  mt5_ticket?: number | string;
  actual_fill_price?: number;
  slippage_points?: number;
  timestamp: string;
  status: 'ORDER_EXECUTED' | 'ORDER_BLOCKED' | 'ORDER_FAILED';
  reasons?: string[];
  snapshot?: CopilotTradePlanSnapshot;
}

export interface CopilotAuditEvent {
  id: string;
  timestamp: string;
  eventType:
    | 'ANALYSIS_CREATED'
    | 'AI_RESULT_GENERATED'
    | 'TRADE_PLAN_CREATED'
    | 'RISK_VALIDATED_APPROVED'
    | 'RISK_VALIDATED_BLOCKED'
    | 'USER_CONFIRMED'
    | 'EXECUTION_REQUESTED'
    | 'EXECUTION_REJECTED'
    | 'BROKER_EXECUTED'
    | 'BROKER_REJECTED'
    | 'POSITION_OPENED'
    | 'POSITION_MODIFIED'
    | 'POSITION_CLOSED';
  userId?: string;
  accountId?: string;
  symbol: string;
  relatedEntityId?: string;
  idempotencyKey?: string;
  status: 'SUCCESS' | 'BLOCKED' | 'FAILED' | 'INFO';
  reason?: string;
  details?: Record<string, any>;
}

export type TradeOrderStatus = 'PENDING' | 'CLAIMED' | 'PROCESSING' | 'EXECUTED' | 'REJECTED' | 'FAILED';

export interface CanonicalExecutionParameters {
  signalId: string;
  snapshotId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  lot: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number | null;
  riskPercent: number;
  estimatedLoss: number;
  confidence: number;
  tradingStyle: 'SCALPING' | 'INTRADAY';
  timeframe: string;
  potentialEntryZone: string;
  entryMode: string;
  stopLossReason?: string;
  takeProfit1Reason?: string;
  takeProfit2Reason?: string;
  riskRewardRatio?: number;
  createdAt: string;
}

export interface TradeExecutionOrder {
  signalId: string;
  snapshotId: string;
  accountId: string;

  symbol: string;
  side: 'BUY' | 'SELL';

  orderType: 'MARKET' | 'LIMIT' | 'STOP';

  lot: number;

  capturePrice: number;
  entryPrice: number;

  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number | null;

  riskPercent: number;
  estimatedLoss: number;

  confidence: number;

  tradingStyle: 'SCALPING' | 'INTRADAY';
  timeframe: string;

  status: TradeOrderStatus;

  // Server Validation & MT5 Execution Lifecycle
  riskValidation?: 'PASS' | 'FAIL' | 'BLOCKED';
  claimedAt?: string | null;
  claimedBy?: string | null;
  processedAt?: string | null;
  executedAt?: string | null;
  mt5Ticket?: string | null;
  fillPrice?: number | null;
  executedLot?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;

  createdAt: string;
  updatedAt?: string;
}

export * from './types/credit.js';




