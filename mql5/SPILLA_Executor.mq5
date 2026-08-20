//+------------------------------------------------------------------+
//|                                           SPILLA_Executor.mq5   |
//|                         Copyright 2026, SPILLA GOLD Systems      |
//|                                       https://ai.studio/build    |
//+------------------------------------------------------------------+
#property copyright   "Copyright 2026, SPILLA GOLD Institutional Engine"
#property link        "https://ai.studio"
#property version     "2.00"
#property description "SPILLA GOLD Automated Trade Execution Worker for MetaTrader 5 (DEMO ONLY)"
#property strict

//+------------------------------------------------------------------+
//| Standard Library Includes                                        |
//+------------------------------------------------------------------+
#include <Trade\Trade.mqh>
#include <Trade\SymbolInfo.mqh>
#include <Trade\AccountInfo.mqh>

//+------------------------------------------------------------------+
//| INPUT PARAMETERS                                                 |
//+------------------------------------------------------------------+
input group "=== [1] SPILLA GOLD SERVER CONFIGURATION ==="
input string   InpApiBaseUrl            = "https://ais-dev-ckdy5yfqugrvrauecjzngx-376477738743.asia-east1.run.app"; // API Base URL (without trailing slash)
input string   InpApiKey                = "";                                                                       // API Key / Bearer Secret (Optional)
input string   InpWorkerId              = "MT5_DEMO_WORKER_1";                                                      // Worker Identifier
input int      InpPollIntervalSec       = 3;                                                                        // Queue Polling Interval (Seconds)

input group "=== [2] EXECUTION SAFEGUARDS (DEMO ONLY) ==="
input bool     InpEnableExecution       = false;                                                                    // Master Execution Switch (false = Dry-Run only)
input long     InpExpectedAccountLogin  = 0;                                                                        // Expected Account Login (0 = Ignore check)
input string   InpAllowedSymbol         = "XAUUSD";                                                                 // Allowed Trading Symbol
input double   InpMaxLot                = 1.00;                                                                     // Maximum Allowed Lot Size
input int      InpMaxSpreadPoints       = 300;                                                                      // Max Spread Allowed (Points, e.g. 300 = $3.00)
input ulong    InpMagicNumber           = 888999;                                                                   // EA Magic Number
input ulong    InpDeviationPoints       = 50;                                                                       // Max Allowed Slippage (Points)

//+------------------------------------------------------------------+
//| Data Structures                                                  |
//+------------------------------------------------------------------+
struct SPILLA_Order
{
   string   signalId;
   string   snapshotId;
   string   accountId;
   string   symbol;
   string   side;         // BUY or SELL
   string   orderType;    // MARKET
   double   lot;
   double   entryPrice;
   double   stopLoss;
   double   takeProfit1;
   double   takeProfit2;
   double   riskPercent;
   double   estimatedLoss;
   string   status;
   string   riskValidation;
};

//+------------------------------------------------------------------+
//| Global Variables                                                 |
//+------------------------------------------------------------------+
CTrade         g_trade;
CSymbolInfo    g_symbolInfo;
CAccountInfo   g_accountInfo;

bool           g_isNetworkBusy          = false;
datetime       g_lastPollTime           = 0;
string         g_executedSignals[];     // Local in-memory duplicate cache

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
   Print("====================================================================");
   Print("[SPILLA EXECUTOR] Initializing SPILLA GOLD MT5 Execution Bridge v2.00");
   Print("[SPILLA EXECUTOR] Worker ID: ", InpWorkerId);
   Print("[SPILLA EXECUTOR] Target API: ", InpApiBaseUrl);
   Print("[SPILLA EXECUTOR] Execution Enabled: ", (InpEnableExecution ? "YES (LIVE MT5 ORDERS)" : "NO (DRY-RUN SAFEGUARD MODE)"));

   // 1. Check Account Mode (DEMO ONLY RESTRICTION)
   ENUM_ACCOUNT_TRADE_MODE tradeMode = (ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE);
   if(tradeMode == ACCOUNT_TRADE_MODE_REAL)
   {
      Print("[CRITICAL ERROR] REAL MONEY ACCOUNT DETECTED (Login #", AccountInfoInteger(ACCOUNT_LOGIN), ").");
      Print("[CRITICAL ERROR] SPILLA GOLD Phase 2 Executor EA is strictly restricted to DEMO accounts only!");
      Alert("SPILLA EXECUTOR HALTED: Real money accounts are forbidden in Phase 2!");
      return(INIT_FAILED);
   }

   // 2. Account Login Verification
   long currentLogin = AccountInfoInteger(ACCOUNT_LOGIN);
   if(InpExpectedAccountLogin > 0 && currentLogin != InpExpectedAccountLogin)
   {
      Print("[CONFIG ERROR] Account Login mismatch! Connected: ", currentLogin, " | Expected: ", InpExpectedAccountLogin);
      Alert("SPILLA EXECUTOR: Account Login mismatch!");
      return(INIT_PARAMETERS_INCORRECT);
   }

   // 3. Symbol Verification
   if(!g_symbolInfo.Name(InpAllowedSymbol))
   {
      Print("[CONFIG WARNING] Symbol ", InpAllowedSymbol, " could not be loaded into CSymbolInfo. Checking Market Watch...");
   }
   if(!SymbolSelect(InpAllowedSymbol, true))
   {
      Print("[CONFIG ERROR] Symbol ", InpAllowedSymbol, " cannot be selected in Market Watch.");
      return(INIT_PARAMETERS_INCORRECT);
   }

   // 4. Configure CTrade
   g_trade.SetExpertMagicNumber(InpMagicNumber);
   g_trade.SetDeviationInPoints(InpDeviationPoints);
   g_trade.SetTypeFillingBySymbol(InpAllowedSymbol);

   // 5. Initialize Timer
   int pollSeconds = (InpPollIntervalSec < 1) ? 1 : InpPollIntervalSec;
   if(!EventSetTimer(pollSeconds))
   {
      Print("[ERROR] Failed to start timer with interval ", pollSeconds, "s.");
      return(INIT_FAILED);
   }

   Print("[SPILLA EXECUTOR] Polling timer started. Interval: ", pollSeconds, " seconds.");
   Print("[SPILLA EXECUTOR] Initialized successfully on Account #", currentLogin, " (DEMO).");
   Print("====================================================================");

   return(INIT_SUCCEEDED);
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
   EventKillTimer();
   Print("[SPILLA EXECUTOR] EA Stopped. Timer killed. Reason code: ", reason);
}

//+------------------------------------------------------------------+
//| Expert timer function (Queue Polling)                            |
//+------------------------------------------------------------------+
void OnTimer()
{
   if(g_isNetworkBusy)
   {
      Print("[SPILLA EXECUTOR] Skipping poll cycle: previous request still active.");
      return;
   }

   g_isNetworkBusy = true;

   // 1. Attempt to claim next order from backend queue
   SPILLA_Order order;
   bool hasOrder = ClaimNextOrder(order);

   if(hasOrder)
   {
      Print("--------------------------------------------------------------------");
      Print("[SPILLA EXECUTOR] CLAIMED ORDER DETECTED: SignalId=", order.signalId, " Side=", order.side, " Lot=", DoubleToString(order.lot, 2));

      // 2. Process and execute claimed order
      ProcessClaimedOrder(order);
      Print("--------------------------------------------------------------------");
   }

   g_isNetworkBusy = false;
   g_lastPollTime = TimeCurrent();
}

//+------------------------------------------------------------------+
//| 1. WebRequest Core HTTP Helper                                   |
//+------------------------------------------------------------------+
bool HttpSend(const string endpoint, const string method, const string body, string &response, int &httpStatus)
{
   string fullUrl = InpApiBaseUrl + endpoint;
   
   string headers = "Content-Type: application/json\r\n";
   if(StringLen(InpApiKey) > 0)
   {
      headers += "x-api-key: " + InpApiKey + "\r\n";
      headers += "Authorization: Bearer " + InpApiKey + "\r\n";
   }

   uchar postData[];
   int postDataSize = 0;
   if(StringLen(body) > 0)
   {
      postDataSize = StringToCharArray(body, postData, 0, WHOLE_ARRAY, CP_UTF8);
      if(postDataSize > 0 && postData[postDataSize - 1] == 0)
      {
         postDataSize--;
         ArrayResize(postData, postDataSize);
      }
   }

   uchar resultData[];
   string resultHeaders;
   ResetLastError();

   int timeoutMs = 8000;
   httpStatus = WebRequest(method, fullUrl, headers, timeoutMs, postData, resultData, resultHeaders);

   if(httpStatus == -1)
   {
      int err = GetLastError();
      Print("[WEBREQUEST ERROR] Request to '", fullUrl, "' failed with error code: ", err);

      if(err == 4014 || err == 4060)
      {
         Print("====================================================================");
         Print("[CONFIGURATION REQUIRED] WebRequest URL is not allowed in MetaTrader 5!");
         Print("1. Open MetaTrader 5 menu: Tools -> Options -> Expert Advisors");
         Print("2. Check 'Allow WebRequest for listed URL'");
         Print("3. Add this exact URL to the whitelist: ", InpApiBaseUrl);
         Print("====================================================================");
      }
      return(false);
   }

   response = CharArrayToString(resultData, 0, WHOLE_ARRAY, CP_UTF8);
   return(true);
}

//+------------------------------------------------------------------+
//| 2. Claim Next Pending Order (POST /api/trade/claim)              |
//+------------------------------------------------------------------+
bool ClaimNextOrder(SPILLA_Order &order)
{
   string body = "{\"claimedBy\":\"" + InpWorkerId + "\"}";
   string response = "";
   int httpStatus = 0;

   if(!HttpSend("/api/trade/claim", "POST", body, response, httpStatus))
   {
      return(false);
   }

   if(httpStatus != 200)
   {
      return(false);
   }

   // Verify response success
   bool success = JsonGetBool(response, "success");
   string code = JsonGetString(response, "code");

   if(!success || code != "ORDER_CLAIMED")
   {
      return(false);
   }

   // Extract nested order object
   string orderJson = JsonExtractSubObject(response, "order");
   if(StringLen(orderJson) == 0)
   {
      return(false);
   }

   order.signalId       = JsonGetString(orderJson, "signalId");
   order.snapshotId     = JsonGetString(orderJson, "snapshotId");
   order.accountId      = JsonGetString(orderJson, "accountId");
   order.symbol         = JsonGetString(orderJson, "symbol");
   order.side           = JsonGetString(orderJson, "side");
   order.orderType      = JsonGetString(orderJson, "orderType", "MARKET");
   order.lot            = JsonGetDouble(orderJson, "lot");
   order.entryPrice     = JsonGetDouble(orderJson, "entryPrice");
   order.stopLoss       = JsonGetDouble(orderJson, "stopLoss");
   order.takeProfit1    = JsonGetDouble(orderJson, "takeProfit1");
   order.takeProfit2    = JsonGetDouble(orderJson, "takeProfit2", 0.0);
   order.riskPercent    = JsonGetDouble(orderJson, "riskPercent");
   order.estimatedLoss  = JsonGetDouble(orderJson, "estimatedLoss");
   order.status         = JsonGetString(orderJson, "status");
   order.riskValidation = JsonGetString(orderJson, "riskValidation");

   return(StringLen(order.signalId) > 0);
}

//+------------------------------------------------------------------+
//| 3. Notify Backend: Transition to PROCESSING State                |
//+------------------------------------------------------------------+
bool NotifyProcessingState(const string signalId)
{
   string body = "{\"signalId\":\"" + signalId + "\",\"claimedBy\":\"" + InpWorkerId + "\"}";
   string response = "";
   int httpStatus = 0;

   bool res = HttpSend("/api/trade/processing", "POST", body, response, httpStatus);
   if(res && httpStatus == 200)
   {
      Print("[SPILLA EXECUTOR] Signal ", signalId, " transitioned to PROCESSING on backend.");
      return(true);
   }
   return(false);
}

//+------------------------------------------------------------------+
//| 4. Record Final Execution or Rejection Result                    |
//+------------------------------------------------------------------+
bool SendExecutionResult(const string signalId, const string status, const string ticket, const double fillPrice, const double executedLot, const string errorCode = "", const string errorMessage = "")
{
   string body = "{\"signalId\":\"" + signalId + "\",\"status\":\"" + status + "\"";

   if(status == "EXECUTED")
   {
      body += ",\"mt5Ticket\":\"" + ticket + "\"";
      body += ",\"fillPrice\":" + DoubleToString(fillPrice, 2);
      body += ",\"executedLot\":" + DoubleToString(executedLot, 2);
   }
   else
   {
      body += ",\"errorCode\":\"" + errorCode + "\"";
      body += ",\"errorMessage\":\"" + JsonEscape(errorMessage) + "\"";
   }
   body += "}";

   string response = "";
   int httpStatus = 0;
   bool ok = HttpSend("/api/trade/result", "POST", body, response, httpStatus);

   if(ok && httpStatus == 200)
   {
      Print("[SPILLA EXECUTOR] Result synchronized with backend for ", signalId, " -> Status: ", status);
      return(true);
   }
   else
   {
      Print("[SPILLA EXECUTOR] WARNING: Failed to synchronize result for ", signalId, ". HTTP: ", httpStatus);
      return(false);
   }
}

//+------------------------------------------------------------------+
//| 5. Core Processing & Safety Validation Routine                   |
//+------------------------------------------------------------------+
void ProcessClaimedOrder(const SPILLA_Order &order)
{
   // Step A: Immediately transition backend lifecycle to PROCESSING
   NotifyProcessingState(order.signalId);

   // Step B: Account Validation
   long currentAccount = AccountInfoInteger(ACCOUNT_LOGIN);
   if(InpExpectedAccountLogin > 0 && currentAccount != InpExpectedAccountLogin)
   {
      string err = "ACCOUNT_MISMATCH: Connected MT5 account #" + IntegerToString(currentAccount) + " does not match expected #" + IntegerToString(InpExpectedAccountLogin);
      Print("[VALIDATION FAILED] ", err);
      SendExecutionResult(order.signalId, "REJECTED", "", 0, 0, "ACCOUNT_MISMATCH", err);
      return;
   }

   // Step C: Symbol Validation
   string tradeSymbol = (order.symbol == "") ? InpAllowedSymbol : order.symbol;
   if(tradeSymbol != InpAllowedSymbol)
   {
      string err = "INVALID_SYMBOL: Order symbol '" + tradeSymbol + "' differs from allowed symbol '" + InpAllowedSymbol + "'";
      Print("[VALIDATION FAILED] ", err);
      SendExecutionResult(order.signalId, "REJECTED", "", 0, 0, "INVALID_SYMBOL", err);
      return;
   }

   if(!SymbolSelect(tradeSymbol, true))
   {
      string err = "SYMBOL_UNAVAILABLE: Broker cannot select symbol " + tradeSymbol;
      Print("[VALIDATION FAILED] ", err);
      SendExecutionResult(order.signalId, "REJECTED", "", 0, 0, "SYMBOL_UNAVAILABLE", err);
      return;
   }

   // Step D: Duplicate Execution Protection
   if(IsSignalAlreadyExecuted(order.signalId))
   {
      string err = "DUPLICATE_SIGNAL: SignalId " + order.signalId + " was already executed or exists in trade history.";
      Print("[VALIDATION FAILED] ", err);
      SendExecutionResult(order.signalId, "REJECTED", "", 0, 0, "DUPLICATE_EXECUTION", err);
      return;
   }

   // Step E: Market Quotes & Spread Validation
   MqlTick tick;
   if(!SymbolInfoTick(tradeSymbol, tick))
   {
      string err = "NO_MARKET_TICK: Failed to fetch live tick data for " + tradeSymbol;
      Print("[VALIDATION FAILED] ", err);
      SendExecutionResult(order.signalId, "REJECTED", "", 0, 0, "NO_MARKET_TICK", err);
      return;
   }

   double point = SymbolInfoDouble(tradeSymbol, SYMBOL_POINT);
   if(point <= 0) point = 0.01;

   int currentSpreadPoints = (int)MathRound((tick.ask - tick.bid) / point);
   if(currentSpreadPoints > InpMaxSpreadPoints)
   {
      string err = "SPREAD_TOO_HIGH: Current spread (" + IntegerToString(currentSpreadPoints) + " pts) exceeds max limit (" + IntegerToString(InpMaxSpreadPoints) + " pts)";
      Print("[VALIDATION FAILED] ", err);
      SendExecutionResult(order.signalId, "REJECTED", "", 0, 0, "SPREAD_TOO_HIGH", err);
      return;
   }

   // Step F: Volume (Lot) Normalization & Validation
   double minLot  = SymbolInfoDouble(tradeSymbol, SYMBOL_VOLUME_MIN);
   double maxLot  = SymbolInfoDouble(tradeSymbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(tradeSymbol, SYMBOL_VOLUME_STEP);

   if(minLot <= 0)  minLot  = 0.01;
   if(maxLot <= 0)  maxLot  = 100.0;
   if(lotStep <= 0) lotStep = 0.01;

   double requestedLot = order.lot;
   if(requestedLot <= 0 || requestedLot > InpMaxLot || requestedLot < minLot || requestedLot > maxLot)
   {
      string err = "INVALID_VOLUME: Requested lot " + DoubleToString(requestedLot, 2) + " is outside limits (Min: " + DoubleToString(minLot, 2) + ", Max: " + DoubleToString(InpMaxLot, 2) + ")";
      Print("[VALIDATION FAILED] ", err);
      SendExecutionResult(order.signalId, "REJECTED", "", 0, 0, "INVALID_VOLUME", err);
      return;
   }

   // Step G: Normalize Lot to Step
   int steps = (int)MathRound((requestedLot - minLot) / lotStep);
   double normalizedLot = minLot + (steps * lotStep);
   normalizedLot = NormalizeDouble(normalizedLot, 2);

   // Step H: Price, Stop Loss, and Take Profit Distance Validation
   int stopsLevel = (int)SymbolInfoInteger(tradeSymbol, SYMBOL_TRADE_STOPS_LEVEL);
   double stopsDistance = stopsLevel * point;

   if(order.side == "BUY")
   {
      if(order.stopLoss >= tick.bid || order.stopLoss <= 0)
      {
         string err = "INVALID_STOPS: For BUY, Stop Loss (" + DoubleToString(order.stopLoss, 2) + ") must be below Bid (" + DoubleToString(tick.bid, 2) + ")";
         Print("[VALIDATION FAILED] ", err);
         SendExecutionResult(order.signalId, "REJECTED", "", 0, 0, "INVALID_BUY_SL", err);
         return;
      }
      if(order.takeProfit1 <= tick.ask)
      {
         string err = "INVALID_STOPS: For BUY, TP1 (" + DoubleToString(order.takeProfit1, 2) + ") must be above Ask (" + DoubleToString(tick.ask, 2) + ")";
         Print("[VALIDATION FAILED] ", err);
         SendExecutionResult(order.signalId, "REJECTED", "", 0, 0, "INVALID_BUY_TP", err);
         return;
      }
      if(stopsDistance > 0 && (tick.bid - order.stopLoss) < stopsDistance)
      {
         string err = "INVALID_STOPS: Stop Loss is within broker minimum stop distance (" + IntegerToString(stopsLevel) + " points)";
         Print("[VALIDATION FAILED] ", err);
         SendExecutionResult(order.signalId, "REJECTED", "", 0, 0, "STOPS_TOO_CLOSE", err);
         return;
      }
   }
   else if(order.side == "SELL")
   {
      if(order.stopLoss <= tick.ask || order.stopLoss <= 0)
      {
         string err = "INVALID_STOPS: For SELL, Stop Loss (" + DoubleToString(order.stopLoss, 2) + ") must be above Ask (" + DoubleToString(tick.ask, 2) + ")";
         Print("[VALIDATION FAILED] ", err);
         SendExecutionResult(order.signalId, "REJECTED", "", 0, 0, "INVALID_SELL_SL", err);
         return;
      }
      if(order.takeProfit1 >= tick.bid)
      {
         string err = "INVALID_STOPS: For SELL, TP1 (" + DoubleToString(order.takeProfit1, 2) + ") must be below Bid (" + DoubleToString(tick.bid, 2) + ")";
         Print("[VALIDATION FAILED] ", err);
         SendExecutionResult(order.signalId, "REJECTED", "", 0, 0, "INVALID_SELL_TP", err);
         return;
      }
      if(stopsDistance > 0 && (order.stopLoss - tick.ask) < stopsDistance)
      {
         string err = "INVALID_STOPS: Stop Loss is within broker minimum stop distance (" + IntegerToString(stopsLevel) + " points)";
         Print("[VALIDATION FAILED] ", err);
         SendExecutionResult(order.signalId, "REJECTED", "", 0, 0, "STOPS_TOO_CLOSE", err);
         return;
      }
   }
   else
   {
      string err = "UNSUPPORTED_SIDE: Order side '" + order.side + "' is not supported.";
      Print("[VALIDATION FAILED] ", err);
      SendExecutionResult(order.signalId, "REJECTED", "", 0, 0, "UNSUPPORTED_SIDE", err);
      return;
   }

   // Step I: DRY-RUN Safeguard Check
   if(!InpEnableExecution)
   {
      Print("====================================================================");
      Print("[DRY-RUN MODE] Order validation PASSED successfully!");
      Print("[DRY-RUN MODE] SignalId: ", order.signalId);
      Print("[DRY-RUN MODE] Side: ", order.side, " | Lot: ", DoubleToString(normalizedLot, 2), " | Symbol: ", tradeSymbol);
      Print("[DRY-RUN MODE] SL: ", DoubleToString(order.stopLoss, 2), " | TP1: ", DoubleToString(order.takeProfit1, 2));
      Print("[DRY-RUN MODE] ENABLE_EXECUTION=false -> Live order was NOT placed.");
      Print("====================================================================");
      SendExecutionResult(order.signalId, "REJECTED", "", 0, 0, "DRY_RUN_SAFEGUARD", "Validation PASSED. Real order skipped because ENABLE_EXECUTION is set to false.");
      return;
   }

   // Step J: MT5 Market Order Execution via CTrade
   string orderComment = "SPILLA:" + order.signalId;
   bool orderSuccess = false;

   Print("[EXECUTING ORDER] Sending ", order.side, " ", DoubleToString(normalizedLot, 2), " ", tradeSymbol, " SL=", DoubleToString(order.stopLoss, 2), " TP=", DoubleToString(order.takeProfit1, 2), " Comment=", orderComment);

   if(order.side == "BUY")
   {
      orderSuccess = g_trade.Buy(normalizedLot, tradeSymbol, 0, order.stopLoss, order.takeProfit1, orderComment);
   }
   else if(order.side == "SELL")
   {
      orderSuccess = g_trade.Sell(normalizedLot, tradeSymbol, 0, order.stopLoss, order.takeProfit1, orderComment);
   }

   uint retcode = g_trade.ResultRetcode();
   Print("[MT5 EXECUTION RESULT] Retcode: ", retcode, " (", g_trade.ResultRetcodeDescription(), ")");

   if(orderSuccess && (retcode == TRADE_RETCODE_DONE || retcode == TRADE_RETCODE_PLACED))
   {
      ulong ticket = g_trade.ResultOrder();
      if(ticket == 0) ticket = g_trade.ResultDeal();

      double fillPrice = g_trade.ResultPrice();
      if(fillPrice <= 0) fillPrice = (order.side == "BUY") ? tick.ask : tick.bid;

      double executedLot = g_trade.ResultVolume();
      if(executedLot <= 0) executedLot = normalizedLot;

      Print("====================================================================");
      Print("[EXECUTION SUCCESS] Order EXECUTED successfully in MT5!");
      Print("Ticket: #", ticket, " | Fill: $", DoubleToString(fillPrice, 2), " | Lot: ", DoubleToString(executedLot, 2));
      Print("====================================================================");

      // Register local duplicate tracking
      RegisterExecutedSignal(order.signalId);

      // Notify backend of EXECUTED status
      SendExecutionResult(order.signalId, "EXECUTED", IntegerToString(ticket), fillPrice, executedLot);
   }
   else
   {
      string retCodeStr = IntegerToString(retcode);
      string retDesc = g_trade.ResultRetcodeDescription();
      Print("[EXECUTION FAILED] Broker rejected order. RetCode: ", retCodeStr, " - ", retDesc);

      SendExecutionResult(order.signalId, "REJECTED", "", 0, 0, retCodeStr, retDesc);
   }
}

//+------------------------------------------------------------------+
//| Duplicate Signal Check Helper                                    |
//+------------------------------------------------------------------+
bool IsSignalAlreadyExecuted(const string signalId)
{
   if(StringLen(signalId) == 0) return(false);

   // 1. Check in-memory list
   int size = ArraySize(g_executedSignals);
   for(int i = 0; i < size; i++)
   {
      if(g_executedSignals[i] == signalId) return(true);
   }

   // 2. Check open positions comments
   int totalPositions = PositionsTotal();
   for(int p = 0; p < totalPositions; p++)
   {
      ulong ticket = PositionGetTicket(p);
      if(ticket > 0)
      {
         string comment = PositionGetString(POSITION_COMMENT);
         if(StringFind(comment, "SPILLA:" + signalId) >= 0) return(true);
      }
   }

   // 3. Check historical deals (last 24 hours)
   datetime fromTime = TimeCurrent() - 86400;
   datetime toTime   = TimeCurrent();
   if(HistorySelect(fromTime, toTime))
   {
      int totalDeals = HistoryDealsTotal();
      for(int d = 0; d < totalDeals; d++)
      {
         ulong dealTicket = HistoryDealGetTicket(d);
         if(dealTicket > 0)
         {
            string dealComment = HistoryDealGetString(dealTicket, DEAL_COMMENT);
            if(StringFind(dealComment, "SPILLA:" + signalId) >= 0) return(true);
         }
      }
   }

   return(false);
}

void RegisterExecutedSignal(const string signalId)
{
   int size = ArraySize(g_executedSignals);
   ArrayResize(g_executedSignals, size + 1);
   g_executedSignals[size] = signalId;
}

//+------------------------------------------------------------------+
//| LIGHTWEIGHT JSON PARSER (Zero Dependency MQL5 Implementation)    |
//+------------------------------------------------------------------+
string JsonGetString(const string json, const string key, string defaultValue = "")
{
   string pattern = "\"" + key + "\"";
   int keyPos = StringFind(json, pattern);
   if(keyPos < 0) return(defaultValue);

   int colonPos = StringFind(json, ":", keyPos + StringLen(pattern));
   if(colonPos < 0) return(defaultValue);

   int firstQuote = StringFind(json, "\"", colonPos + 1);
   if(firstQuote < 0) return(defaultValue);

   int secondQuote = StringFind(json, "\"", firstQuote + 1);
   if(secondQuote < 0) return(defaultValue);

   return(StringSubstr(json, firstQuote + 1, secondQuote - firstQuote - 1));
}

double JsonGetDouble(const string json, const string key, double defaultValue = 0.0)
{
   string pattern = "\"" + key + "\"";
   int keyPos = StringFind(json, pattern);
   if(keyPos < 0) return(defaultValue);

   int colonPos = StringFind(json, ":", keyPos + StringLen(pattern));
   if(colonPos < 0) return(defaultValue);

   int start = colonPos + 1;
   while(start < StringLen(json) && (StringGetCharacter(json, start) == ' ' || StringGetCharacter(json, start) == '\t'))
   {
      start++;
   }

   int end = start;
   while(end < StringLen(json))
   {
      ushort ch = StringGetCharacter(json, end);
      if(ch == ',' || ch == '}' || ch == ']' || ch == '\n' || ch == '\r' || ch == ' ') break;
      end++;
   }

   string valStr = StringSubstr(json, start, end - start);
   return(StringToDouble(valStr));
}

bool JsonGetBool(const string json, const string key, bool defaultValue = false)
{
   string pattern = "\"" + key + "\"";
   int keyPos = StringFind(json, pattern);
   if(keyPos < 0) return(defaultValue);

   int colonPos = StringFind(json, ":", keyPos + StringLen(pattern));
   if(colonPos < 0) return(defaultValue);

   int truePos  = StringFind(json, "true", colonPos);
   int falsePos = StringFind(json, "false", colonPos);

   if(truePos >= 0 && (falsePos < 0 || truePos < falsePos))
   {
      if(truePos - colonPos < 10) return(true);
   }
   if(falsePos >= 0 && (truePos < 0 || falsePos < truePos))
   {
      if(falsePos - colonPos < 10) return(false);
   }
   return(defaultValue);
}

string JsonExtractSubObject(const string json, const string key)
{
   string pattern = "\"" + key + "\"";
   int keyPos = StringFind(json, pattern);
   if(keyPos < 0) return("");

   int colonPos = StringFind(json, ":", keyPos + StringLen(pattern));
   if(colonPos < 0) return("");

   int openBrace = StringFind(json, "{", colonPos);
   if(openBrace < 0) return("");

   int depth = 0;
   int closeBrace = -1;
   for(int i = openBrace; i < StringLen(json); i++)
   {
      ushort ch = StringGetCharacter(json, i);
      if(ch == '{') depth++;
      else if(ch == '}')
      {
         depth--;
         if(depth == 0)
         {
            closeBrace = i;
            break;
         }
      }
   }

   if(closeBrace > openBrace)
   {
      return(StringSubstr(json, openBrace, closeBrace - openBrace + 1));
   }
   return("");
}

string JsonEscape(const string sourceText)
{
   string result = sourceText;
   StringReplace(result, "\\", "\\\\");
   StringReplace(result, "\"", "\\\"");
   StringReplace(result, "\r", "");
   StringReplace(result, "\n", " ");
   return(result);
}
//+------------------------------------------------------------------+
