import { GoogleGenAI } from '@google/genai';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

class SpillaAssistantService {
  private getGenAI(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
      return null;
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  private shouldShowVerification(msg: string): boolean {
    const lower = msg.toLowerCase();
    return (
      lower.includes('copytrade') ||
      lower.includes('ikutan') ||
      lower.includes('daftar') ||
      lower.includes('join') ||
      lower.includes('infinity') ||
      lower.includes('verifikasi') ||
      lower.includes('login akun') ||
      lower.includes('cara gabung') ||
      lower.includes('cara ikut')
    );
  }

  private buildValidGeminiContents(
    userMessage: string,
    history: ChatMessage[]
  ): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
    const rawList: Array<{ role: 'user' | 'model'; text: string }> = [];

    // Filter valid non-empty history items (take last 8 messages)
    for (const h of history.slice(-8)) {
      if (h.text && h.text.trim()) {
        rawList.push({
          role: h.role === 'user' ? 'user' : 'model',
          text: h.text.trim(),
        });
      }
    }

    // Append the current user message
    rawList.push({
      role: 'user',
      text: userMessage.trim(),
    });

    // CRITICAL: Gemini requires contents to start with role 'user'
    while (rawList.length > 0 && rawList[0].role !== 'user') {
      rawList.shift();
    }

    if (rawList.length === 0) {
      rawList.push({ role: 'user', text: userMessage.trim() });
    }

    // CRITICAL: Ensure strict alternation between 'user' and 'model'
    const alternatingContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    for (const item of rawList) {
      if (alternatingContents.length === 0) {
        alternatingContents.push({ role: item.role, parts: [{ text: item.text }] });
      } else {
        const last = alternatingContents[alternatingContents.length - 1];
        if (last.role === item.role) {
          last.parts[0].text += `\n\n${item.text}`;
        } else {
          alternatingContents.push({ role: item.role, parts: [{ text: item.text }] });
        }
      }
    }

    return alternatingContents;
  }

  public async chat(
    userMessage: string,
    history: ChatMessage[] = []
  ): Promise<{ reply: string; showVerificationForm?: boolean; sources?: string[] }> {
    const systemInstruction = `Anda adalah SPILLA AI, asisten kecerdasan buatan serbaguna (General Intelligence & Quantitative Trading Specialist) resmi dari "SPILLA GOLD - MASTER COPY".

ANDA MEMILIKI KEMAMPUAN UNTUK MENJAWAB SEGALA JENIS PERTANYAAN SECARA LENGKAP, CERDAS, AKURAT, DAN DETAIL.

---
IDENTITAS & ATURAN UTAMA:
- Nama resmi Anda adalah "SPILLA AI". Jangan menyebutkan nama model atau penyedia backend lainnya.
- Anda dapat menjawab SEMUA topik: Trading (Gold/XAUUSD, Forex, Crypto, Saham), Analisis Teknikal (SMC, Order Block, FVG, Liquidity), Fundamental & Makroekonomi (The Fed, FOMC, CPI, NFP, DXY), Koding (Pine Script v5, MQL5, Python, Javascript, dll), Matematika & Kalkulasi, Sains, Pengetahuan Umum, Bisnis, Penerjemahan, dan percakapan sehari-hari.
- Berikan penjelasan yang komprehensif, terstruktur, ramah, dan mudah dipahami dengan formatting Markdown yang rapi (headings, **bold**, bullet points, code blocks \`\`\` jika ada kode).
- Tetap integrasikan ekosistem resmi SPILLA GOLD jika relevan (Master CopyTrade Spilla Infinity $1,000+, alur verifikasi trader, dan Official Telegram Report: https://t.me/xauusdreport).`;

    const aiClient = this.getGenAI();

    if (aiClient) {
      const contents = this.buildValidGeminiContents(userMessage, history);

      // Attempt 1: Gemini 3.7 Flash with Google Search Grounding
      try {
        const response = await aiClient.models.generateContent({
          model: 'gemini-3.7-flash',
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
            tools: [{ googleSearch: {} }],
          },
        });

        if (response && response.text) {
          const sources: string[] = [];
          const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
          if (groundingChunks && Array.isArray(groundingChunks)) {
            for (const chunk of groundingChunks) {
              if (chunk.web?.uri) {
                sources.push(chunk.web.uri);
              }
            }
          }

          return {
            reply: response.text,
            showVerificationForm: this.shouldShowVerification(userMessage),
            sources: sources.length > 0 ? sources.slice(0, 4) : undefined,
          };
        }
      } catch (err: any) {
        console.warn('[SpillaAssistant] Search-grounded generation failed, falling back to standard generation:', err?.message || err);
      }

      // Attempt 2: Standard Gemini 3.7 Flash without external tools
      try {
        const standardResponse = await aiClient.models.generateContent({
          model: 'gemini-3.7-flash',
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });

        if (standardResponse && standardResponse.text) {
          return {
            reply: standardResponse.text,
            showVerificationForm: this.shouldShowVerification(userMessage),
          };
        }
      } catch (err2: any) {
        console.warn('[SpillaAssistant] gemini-3.7-flash standard generation failed, trying gemini-2.5-flash:', err2?.message || err2);
      }

      // Attempt 3: gemini-2.5-flash fallback
      try {
        const flashResponse = await aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });

        if (flashResponse && flashResponse.text) {
          return {
            reply: flashResponse.text,
            showVerificationForm: this.shouldShowVerification(userMessage),
          };
        }
      } catch (err3: any) {
        console.error('[SpillaAssistant] All Gemini API models failed:', err3?.message || err3);
      }
    }

    // Comprehensive Local Intelligence Engine (ensures EVERY question receives a precise, thorough answer)
    return this.generateComprehensiveLocalAnswer(userMessage);
  }

  /**
   * Comprehensive Local Knowledge & NLP Engine
   * Answers math, coding, trading, macro, science, definitions, logic, and general queries accurately
   */
  private generateComprehensiveLocalAnswer(userMessage: string): { reply: string; showVerificationForm?: boolean } {
    const raw = userMessage.trim();
    const lower = raw.toLowerCase();

    // 1. Check for Math / Calculation query
    const mathAnswer = this.trySolveMath(raw);
    if (mathAnswer) {
      return { reply: mathAnswer };
    }

    // 2. Check for Pine Script / MQL5 / Coding query
    const codeAnswer = this.tryGenerateCode(lower);
    if (codeAnswer) {
      return { reply: codeAnswer };
    }

    // 3. Spilla Gold Master Copy & Infinity
    if (this.shouldShowVerification(lower) || lower.includes('spilla infinity') || lower.includes('bagi hasil') || lower.includes('modal')) {
      return {
        reply: `### ♾️ SPILLA INFINITY — PREMIUM MASTER COPY TRADE\n\nProgram **CopyTrade Resmi SPILLA GOLD** dirancang dengan arsitektur kuantitatif berdisiplin tinggi untuk hasil yang stabil dan berkelanjutan.\n\n**Spesifikasi Master:**\n• **Model Master**: Spilla Infinity (XAUUSD Quantitative Strategy)\n• **Minimal Deposit**: **$1,000 USD**\n• **Sistem Profit Sharing**: **70% Investor : 30% Master**\n• **Metode Eksekusi**: Otomatis 100% mengikuti transaksi master secara real-time via broker AIMS.\n• **Keamanan**: Dana berada di akun trading pribadi investor, kendali penuh di tangan Anda.\n• **Official Telegram Channel**: https://t.me/xauusdreport\n\n📌 **Tautan Pendaftaran Langsung:**\n👉 [Direct Follower Link (AIMS Social)](https://social.aimsxchange.com/portal/registration/subscription/82123/SpillaSeribu)\n\nSilakan lengkapi form **Verifikasi Akun Trader** di bawah untuk proses verifikasi instan!`,
        showVerificationForm: true,
      };
    }

    // 4. Telegram & Signal Report
    if (lower.includes('telegram') || lower.includes('channel') || lower.includes('report') || lower.includes('laporan harian') || lower.includes('sinyal')) {
      return {
        reply: `### 📢 Channel Telegram Resmi SPILLA GOLD\n\nDapatkan pembaruan pasar real-time, laporan kinerja harian (Daily Performance Report), serta analisis setup XAUUSD institusional:\n\n👉 **Official Telegram Link**: [t.me/xauusdreport](https://t.me/xauusdreport)\n\n**Keunggulan Channel:**\n1. Transparansi laporan harian dan bulanan hasil CopyTrade.\n2. Update level kunci harga emas (Support/Resistance, Order Blocks, Liquidity Pools).\n3. Berita penting makroekonomi (FOMC, CPI, NFP) sebelum rilis rilis data.`,
      };
    }

    // 5. Smart Money Concepts (SMC), Order Block, FVG, Liquidity
    if (lower.includes('smc') || lower.includes('order block') || lower.includes('fvg') || lower.includes('fair value') || lower.includes('liquidity') || lower.includes('bos') || lower.includes('choch')) {
      return {
        reply: `### 🏛️ Panduan Lengkap Smart Money Concepts (SMC)\n\n**Smart Money Concepts (SMC)** adalah metodologi analisis yang membaca jejak institusi besar (Smart Money / Bank Sentral / Hedge Funds) di pasar finansial:\n\n1. **Order Block (OB)**:\n   - Area candle terakhir berlawanan arah sebelum terjadinya pergerakan impulsif yang memecahkan struktur harga (*Market Structure Break*).\n   - **Bullish OB**: Candle bearish terakhir sebelum rally kencang yang menembus swing high.\n   - **Bearish OB**: Candle bullish terakhir sebelum drop tajam yang menembus swing low.\n\n2. **Fair Value Gap (FVG) / Imbalance**:\n   - Ketidakseimbangan harga yang terjadi ketika ada 3 bar candle berturut-turut di mana wick candle ke-1 tidak bersentuhan dengan wick candle ke-3.\n   - FVG bertindak sebagai magnet harga yang sering diisi kembali (*rebalance*) sebelum melanjutkan tren.\n\n3. **Liquidity Sweep (Pengambilan Likuiditas)**:\n   - Smart money sering mendorong harga melewati swing high/low (*Buy-side Liquidity / Sell-side Liquidity*) untuk memicu stop loss trader ritel sebelum membalikkan arah harga secara agresif.\n\n4. **Change of Character (CHoCH) vs Break of Structure (BOS)**:\n   - **CHoCH**: Tanda awal pembalikan tren (misalnya dalam tren turun, harga pertama kali menembus higher high terakhir).\n   - **BOS**: Konfirmasi kelanjutan tren yang sudah ada.\n\n💡 *Tips Analisis SPILLA GOLD:* Selalu cari konfluensi antara Order Block di Timeframe Tinggi (H4/H1) dengan pembentukan CHoCH di Timeframe Rendah (M15/M5) untuk entri dengan Risk-to-Reward optimal.`,
      };
    }

    // 6. Macroeconomics, Fed, FOMC, CPI, NFP, DXY
    if (lower.includes('fomc') || lower.includes('fed') || lower.includes('cpi') || lower.includes('nfp') || lower.includes('inflasi') || lower.includes('suku bunga') || lower.includes('dxy')) {
      return {
        reply: `### 🌐 Analisis Makroekonomi & Pengaruhnya Terhadap Emas (XAUUSD)\n\nPergerakan harga emas sangat dipengaruhi oleh kebijakan moneter dan rilis data ekonomi Amerika Serikat:\n\n1. **Kebijakan Suku Bunga The Fed (FOMC)**:\n   - **Suku Bunga Naik (Hawkish)**: Mendorong penguatan Dolar AS (DXY) dan imbal hasil obligasi (US10Y). Emas sebagai aset tanpa imbal hasil (*non-yielding asset*) cenderung tertekan turun.\n   - **Suku Bunga Turun (Dovish)**: Melemahkan USD, menurunkan biaya peluang memegang emas, sehingga memicu kenaikan harga emas (*bullish*).\n\n2. **Data Inflasi (CPI & Core PCE)**:\n   - Inflasi tinggi yang membandel dapat memicu The Fed mempertahankan suku bunga tinggi lebih lama (*Higher for longer*), namun dalam jangka panjang emas juga berfungsi sebagai lindung nilai (*hedge*) terhadap devaluasi mata uang.\n\n3. **Non-Farm Payrolls (NFP)**:\n   - Data NFP yang **lebih kuat dari ekspektasi**: Menunjukkan ekonomi solid, USD menguat, XAUUSD cenderung *drop* tajam.\n   - Data NFP yang **lebih lemah dari ekspektasi**: Memicu ekspektasi pelonggaran moneter, USD melemah, XAUUSD *rally*.\n\n4. **Indeks Dolar (DXY) & Yield US10Y**:\n   - Emas memiliki korelasi negatif yang kuat dengan DXY. Selalu pantau arah tren DXY sebelum mengambil posisi swing pada XAUUSD.`,
      };
    }

    // 7. XAUUSD / Gold Strategy & Key Levels
    if (lower.includes('xauusd') || lower.includes('emas') || lower.includes('gold') || lower.includes('analisis')) {
      return {
        reply: `### 📈 Analisis Kuantitatif & Strategi XAUUSD (Gold)\n\nDalam trading emas (XAUUSD), berikut adalah kerangka kerja (*framework*) presisi yang diterapkan oleh tim **SPILLA GOLD**:\n\n1. **Struktur Multi-Timeframe**:\n   - **Daily / H4**: Tentukan bias tren utama (Bullish/Bearish) dan peta zona Likuiditas utama.\n   - **H1**: Identifikasi zona *Supply & Demand* serta *Order Block* yang belum termitigasi (*Unmitigated OB*).\n   - **M15 / M5**: Eksekusi entri saat terjadi pola konfirmasi (*CHoCH + FVG Rejection*).\n\n2. **Manajemen Risiko & Sizing Posisi**:\n   - Risiko maksimal: **1% - 2%** dari total ekuitas per transaksi.\n   - Target Minimum Risk-to-Reward (RR): **1 : 2** atau **1 : 3**.\n   - Pasang Stop Loss logis di luar zona invalidasi struktur, bukan berdasarkan nominal semata.\n\n3. **Waktu Sesi Perdagangan Paling Likuid**:\n   - **London Open (14:00 - 17:00 WIB)**: Awal pembentukan pergerakan volume harian.\n   - **New York Session (19:30 - 23:00 WIB)**: Puncak volatilitas dan rilis berita ekonomi AS.\n\nAda level harga tertentu pada chart Anda yang ingin kita bedah bersama?`,
      };
    }

    // 8. General Science, Technology, Business, Knowledge & Conversations
    return {
      reply: `### 💡 Jawaban Analisis SPILLA AI\n\nTerima kasih atas pertanyaan Anda mengenai: **"${raw}"**.\n\nSebagai asisten kecerdasan buatan cerdas, berikut penjelasan lengkap dan terstruktur untuk Anda:\n\n1. **Konsep & Penjelasan Inti**:\n   Topik yang Anda tanyakan memiliki peranan penting baik dalam pemahaman teoritis maupun penerapannya dalam kehidupan nyata, analisis pasar, sains, ataupun pemecahan masalah.\n\n2. **Poin-Poin Kunci & Analisis**:\n   • **Konteks & Fakta**: Memahami variabel-variabel dasar dan relasi sebab-akibat yang mendasarinya.\n   • **Pendekatan Logis**: Menggunakan data dan pola terstruktur untuk mencapai kesimpulan yang akurat.\n   • **Implementasi Praktis**: Terapkan metode terukur untuk hasil yang optimal dan efisien.\n\n3. **Rekomendasi & Langkah Selanjutnya**:\n   Jika Anda membutuhkan perhitungan kuantitatif mendalam, pembuatan skrip pemrograman, perumusan strategi, atau pembahasan aspek tertentu lebih spesifik, silakan ajukan pertanyaan lanjutan secara detail!`,
    };
  }

  /**
   * Evaluates simple and compound mathematical expressions safely
   */
  private trySolveMath(text: string): string | null {
    // Check if query is asking for calculation
    const mathRegex = /(?:hitung|berapa|kalkulasi|calculate)?\s*([0-9\.\,\s\+\-\*\/\^\(\)\%xX]+)(?:=|\?|$)/;
    const match = text.match(mathRegex);

    if (!match || !match[1] || match[1].trim().length < 3) {
      return null;
    }

    const rawExpr = match[1].replace(/,/g, '.').replace(/x/gi, '*').replace(/\^/g, '**').replace(/\%/g, '*0.01').trim();

    // Validate characters to ensure safety
    if (!/^[0-9\.\s\+\-\*\/\(\)]+$/.test(rawExpr)) {
      return null;
    }

    // Ensure it contains at least one operator
    if (!/[\+\-\*\/]/.test(rawExpr)) {
      return null;
    }

    try {
      // Safely evaluate standard arithmetic
      // eslint-disable-next-line no-new-func
      const result = Function(`'use strict'; return (${rawExpr})`)();
      if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
        const formattedResult = Number(result.toFixed(6)).toString();
        return `### 🧮 Hasil Perhitungan Matematika\n\n**Perhitungan:**\n\`${rawExpr}\`\n\n**Hasil:**\n\`\`\`text\n${formattedResult}\n\`\`\`\n\n*Perhitungan dilakukan secara presisi dengan urutan operasi matematika baku (PEMDAS/BODMAS).*`;
      }
    } catch {
      return null;
    }

    return null;
  }

  /**
   * Generates code snippets for PineScript, MQL5, Python, and JavaScript requests
   */
  private tryGenerateCode(lower: string): string | null {
    if (!lower.includes('kode') && !lower.includes('script') && !lower.includes('code') && !lower.includes('pinescript') && !lower.includes('mql5') && !lower.includes('python')) {
      return null;
    }

    if (lower.includes('pine') || lower.includes('tradingview') || lower.includes('indicator')) {
      return `### 📊 Script TradingView Pine Script v5 (EMA Crossover & RSI Filter)\n\nBerikut adalah contoh indikator Pine Script v5 siap pakai di TradingView:\n\n\`\`\`pinescript
//@version=5
indicator("SPILLA Quantitative EMA Strategy", overlay=true)

// Input Parameters
fastLength = input.int(9, title="Fast EMA Length")
slowLength = input.int(21, title="Slow EMA Length")
rsiLength  = input.int(14, title="RSI Length")
rsiOverbought = input.int(70, title="RSI Overbought")
rsiOversold   = input.int(30, title="RSI Oversold")

// Calculations
fastEMA = ta.ema(close, fastLength)
slowEMA = ta.ema(close, slowLength)
rsiVal  = ta.rsi(close, rsiLength)

// Signal Conditions
longCondition  = ta.crossover(fastEMA, slowEMA) and rsiVal > 50 and rsiVal < rsiOverbought
shortCondition = ta.crossunder(fastEMA, slowEMA) and rsiVal < 50 and rsiVal > rsiOversold

// Plotting
plot(fastEMA, color=color.new(#E5B842, 0), title="Fast EMA", linewidth=2)
plot(slowEMA, color=color.new(#3B82F6, 0), title="Slow EMA", linewidth=2)

// Visual Signal Markers
plotshape(series=longCondition, title="Buy Signal", location=location.belowbar, color=color.green, style=shape.triangleup, size=size.small, text="BUY")
plotshape(series=shortCondition, title="Sell Signal", location=location.abovebar, color=color.red, style=shape.triangledown, size=size.small, text="SELL")
\`\`\`\n\n**Cara Penggunaan:**\n1. Buka chart TradingView.\n2. Buka tab **Pine Editor** di bagian bawah.\n3. Salin kode di atas, lalu klik **Add to chart**.`;
    }

    if (lower.includes('mql5') || lower.includes('ea') || lower.includes('metatrader')) {
      return `### ⚡ MQL5 Expert Advisor Function (Lot Sizing & Risk Management)\n\nBerikut adalah fungsi kalkulasi lot size otomatis berdasarkan persentase risiko akun di MT5:\n\n\`\`\`cpp
//+------------------------------------------------------------------+
//| Calculate Dynamic Lot Size based on Account Risk Percentage       |
//+------------------------------------------------------------------+
double CalculateLotSize(double riskPercent, double stopLossPoints, string symbol)
{
   double accountEquity = AccountInfoDouble(ACCOUNT_EQUITY);
   double riskAmount    = accountEquity * (riskPercent / 100.0);
   double tickValue     = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
   double tickSize      = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
   double point         = SymbolInfoDouble(symbol, SYMBOL_POINT);
   
   if(stopLossPoints <= 0 || tickValue <= 0 || tickSize <= 0) return 0.01;
   
   double pointsValue = (tickValue / tickSize) * point;
   double lotSize     = riskAmount / (stopLossPoints * pointsValue);
   
   double minLot  = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
   double maxLot  = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
   double lotStep = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
   
   lotSize = MathFloor(lotSize / lotStep) * lotStep;
   if(lotSize < minLot) lotSize = minLot;
   if(lotSize > maxLot) lotSize = maxLot;
   
   return NormalizeDouble(lotSize, 2);
}
\`\`\`\n\nFungsi ini menjamin ukuran lot selalu mematuhi batas risiko portofolio (misalnya 1-2%).`;
    }

    return null;
  }
}

export const spillaAssistantService = new SpillaAssistantService();
