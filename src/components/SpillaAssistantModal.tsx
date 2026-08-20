import React, { useState, useEffect, useRef } from 'react';
import spillaLogo from '../assets/images/spilla_gold_logo_1786418245382.jpg';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Lock,
  Server,
  User,
  Hash,
  ArrowRight,
  Bot,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  TrendingUp,
  Cpu,
  Globe,
  Code,
  Zap,
} from 'lucide-react';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  time: string;
  showVerificationForm?: boolean;
  sources?: string[];
}

interface SpillaAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenVerificationForm?: () => void;
}

export const SpillaAssistantModal: React.FC<SpillaAssistantModalProps> = ({
  isOpen,
  onClose,
  onOpenVerificationForm,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: `Halo! Saya **SPILLA AI** ⚡\n\nSaya adalah asisten cerdas serbaguna yang siap menjawab **segala jenis pertanyaan Anda**:\n• **Analisis Pasar & Trading**: XAUUSD (Emas), Forex, SMC, Order Block, Liquidity, Indikator Teknikal.\n• **Makroekonomi & Berita**: FOMC, CPI, NFP, Kebijakan The Fed, DXY, Analisis Fundamental.\n• **Ekosistem Spilla Gold**: Master CopyTrade (Spilla Infinity $1,000+), Telegram Report: https://t.me/xauusdreport.\n• **Algoritma & Coding**: Pine Script v5, MQL5 EA, kalkulasi posisi & risk management.\n• **Pertanyaan Umum / General Q&A**: Sains, matematika, bisnis, bahasa, dan apapun yang ingin Anda ketahui!\n\nAda yang bisa saya bantu hari ini?`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showTraderModal, setShowTraderModal] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  // Trader Form State
  const [traderForm, setTraderForm] = useState({
    fullName: '',
    mt5Account: '',
    investorPassword: '',
    brokerServer: 'AIMS-Live',
  });
  const [formSubmitted, setFormSubmitted] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  if (!isOpen) return null;

  const handleClearHistory = () => {
    setMessages([
      {
        id: Date.now().toString(),
        sender: 'bot',
        text: `Riwayat percakapan telah dibersihkan. Saya **SPILLA AI** siap membantu menjawab pertanyaan baru Anda! 🚀`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setIsTyping(true);

    try {
      // Build history for backend API
      const historyPayload = messages.map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('model' as const),
        text: m.text,
      }));

      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: historyPayload }),
      });

      const data = await res.json();

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: data.reply || 'Maaf, terjadi kendala saat memproses jawaban. Silakan coba beberapa saat lagi.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        showVerificationForm: data.showVerificationForm,
        sources: data.sources,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: `Halo! Saya SPILLA AI. Maaf terjadi gangguan jaringan ke server. Anda tetap dapat bergabung ke ekosistem **Spilla Gold Master Copy** atau bertanya kembali setelah koneksi stabil.\n\nOfficial Telegram: https://t.me/xauusdreport`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          showVerificationForm: true,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleTraderFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitted(true);
    setTimeout(() => {
      // Redirect to Master CopyTrade Follower link
      window.open('https://social.aimsxchange.com/portal/registration/subscription/82123/SpillaSeribu', '_blank');
      setShowTraderModal(false);
      setFormSubmitted(false);
    }, 1200);
  };

  const renderFormattedText = (txt: string) => {
    // Check for code blocks
    const codeBlockRegex = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(txt)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: txt.substring(lastIndex, match.index),
        });
      }
      parts.push({
        type: 'code',
        language: match[1] || 'code',
        code: match[2],
      });
      lastIndex = codeBlockRegex.lastIndex;
    }

    if (lastIndex < txt.length) {
      parts.push({
        type: 'text',
        content: txt.substring(lastIndex),
      });
    }

    return parts.map((part, pIdx) => {
      if (part.type === 'code') {
        return (
          <div key={pIdx} className="my-2.5 rounded-lg bg-[#07090E] border border-gray-800 overflow-hidden font-mono text-[11px]">
            <div className="bg-[#121620] px-3 py-1.5 flex items-center justify-between text-gray-400 border-b border-gray-800">
              <span className="text-[10px] uppercase font-bold text-amber-400">{part.language}</span>
              <button
                onClick={() => handleCopyText(part.code || '', `code-${pIdx}`)}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition-colors"
              >
                {copiedIndex === `code-${pIdx}` ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 overflow-x-auto text-emerald-300 leading-relaxed">
              <code>{part.code}</code>
            </pre>
          </div>
        );
      }

      // Render regular text with lines and markdown
      const lines = part.content?.split('\n') || [];
      return (
        <div key={pIdx} className="space-y-1">
          {lines.map((line, idx) => {
            const content = line;

            // Telegram Link
            if (content.includes('https://t.me/xauusdreport')) {
              return (
                <p key={idx} className="my-1.5">
                  <a
                    href="https://t.me/xauusdreport"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#E5B842]/20 hover:bg-[#E5B842]/30 text-[#E5B842] border border-[#E5B842]/40 rounded-lg text-xs font-bold transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Channel Telegram Resmi (@xauusdreport)</span>
                  </a>
                </p>
              );
            }

            // Headings
            if (content.startsWith('### ')) {
              return (
                <h4 key={idx} className="text-xs font-black text-amber-300 tracking-wide mt-2 mb-1 uppercase">
                  {content.replace('### ', '')}
                </h4>
              );
            }
            if (content.startsWith('## ')) {
              return (
                <h3 key={idx} className="text-sm font-black text-amber-400 tracking-wide mt-2.5 mb-1 uppercase">
                  {content.replace('## ', '')}
                </h3>
              );
            }

            // Bold & inline code formatting
            const subParts = content.split(/(\*\*.*?\*\*|`.*?`)/g);
            return (
              <p key={idx} className="min-h-[1.2rem] leading-relaxed my-0.5">
                {subParts.map((sp, i) => {
                  if (sp.startsWith('**') && sp.endsWith('**')) {
                    return (
                      <strong key={i} className="text-amber-300 font-extrabold">
                        {sp.slice(2, -2)}
                      </strong>
                    );
                  }
                  if (sp.startsWith('`') && sp.endsWith('`')) {
                    return (
                      <code key={i} className="px-1.5 py-0.5 rounded bg-gray-800 text-amber-200 font-mono text-[11px] border border-gray-700">
                        {sp.slice(1, -1)}
                      </code>
                    );
                  }
                  return sp;
                })}
              </p>
            );
          })}
        </div>
      );
    });
  };

  return (
    <>
      {/* Floating Modal Backdrop & Chat Window */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/85 backdrop-blur-md animate-fade-in font-sans">
        <div className="bg-[#0B0D14] border-2 border-[#E5B842]/50 rounded-2xl w-full max-w-3xl h-[90vh] max-h-[750px] shadow-2xl flex flex-col overflow-hidden relative">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#121622] via-[#0F121C] to-[#121622] p-3.5 sm:p-4 border-b border-gray-800/90 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={spillaLogo}
                  alt="SPILLA GOLD Logo"
                  className="w-10 h-10 rounded-xl object-cover border border-[#E5B842]/60 shadow-lg shadow-amber-500/20 shrink-0"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute -bottom-1 -right-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full p-0.5 border border-black shadow">
                  <Sparkles className="w-2.5 h-2.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-black text-white tracking-wider uppercase flex items-center gap-1.5">
                    <span>SPILLA AI</span>
                    <span className="text-[#E5B842] text-[10px] font-normal tracking-normal uppercase bg-[#E5B842]/10 px-1.5 py-0.5 rounded border border-[#E5B842]/30">
                      Assistant
                    </span>
                  </h3>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    <span>General & Quant AI</span>
                  </span>
                </div>
                <p className="text-[10px] text-gray-400">
                  Universal Intelligence • Quantitative Trading • Live Market Search
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleClearHistory}
                className="p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-gray-800/80 transition-all cursor-pointer"
                title="Bersihkan Percakapan"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800/80 transition-all cursor-pointer"
                title="Tutup Chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Subheader Information & CopyTrade Trigger */}
          <div className="bg-[#121622] px-4 py-2 border-b border-gray-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-gray-300 font-medium flex items-center gap-1.5 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Official Telegram: </span>
              <a
                href="https://t.me/xauusdreport"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#E5B842] font-bold hover:underline flex items-center gap-1"
              >
                t.me/xauusdreport
                <ExternalLink className="w-3 h-3" />
              </a>
            </span>

            <button
              onClick={() => setShowTraderModal(true)}
              className="px-2.5 py-1 rounded-lg bg-[#E5B842] hover:bg-amber-400 text-black font-extrabold text-[10px] tracking-wider uppercase transition-all shadow-md cursor-pointer flex items-center gap-1"
            >
              <UserCheck className="w-3 h-3" />
              <span>Form Verifikasi Akun Trader</span>
            </button>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#080A10] text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[85%] p-3.5 rounded-2xl shadow-md space-y-2 ${
                    m.sender === 'user'
                      ? 'bg-gradient-to-r from-[#E5B842] to-amber-400 text-black font-medium rounded-tr-none shadow-amber-500/10'
                      : 'bg-[#121622] text-gray-200 border border-gray-800/90 rounded-tl-none'
                  }`}
                >
                  {/* Bot header icon */}
                  {m.sender === 'bot' && (
                    <div className="flex items-center justify-between pb-1 mb-1 border-b border-gray-800 text-[10px] text-gray-400">
                      <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                        <Sparkles className="w-3 h-3 text-[#E5B842]" />
                        <span>SPILLA AI</span>
                      </div>
                      <button
                        onClick={() => handleCopyText(m.text, m.id)}
                        className="text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
                        title="Salin Pesan"
                      >
                        {copiedIndex === m.id ? (
                          <span className="text-emerald-400 font-bold">Tersalin!</span>
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  )}

                  <div className="text-xs leading-relaxed">{renderFormattedText(m.text)}</div>

                  {/* Sources grounding if available */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="pt-2 border-t border-gray-800/80 mt-2 space-y-1">
                      <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1">
                        <Globe className="w-3 h-3 text-blue-400" />
                        <span>Sumber Web (Grounding):</span>
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {m.sources.map((src, sIdx) => (
                          <a
                            key={sIdx}
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-blue-400 hover:underline truncate max-w-[200px] bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20"
                          >
                            {new URL(src).hostname}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {m.showVerificationForm && m.sender === 'bot' && (
                    <div className="pt-2 border-t border-gray-700/60 mt-2">
                      <button
                        onClick={() => setShowTraderModal(true)}
                        className="w-full py-2.5 px-3 rounded-xl bg-[#E5B842] hover:bg-amber-400 text-black font-black text-xs transition-all shadow-lg flex items-center justify-center gap-1.5 uppercase tracking-wider cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>VERIFIKASI AKUN TRADER SEKARANG</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <span
                    className={`text-[9px] block text-right font-mono mt-1 ${
                      m.sender === 'user' ? 'text-black/70' : 'text-gray-500'
                    }`}
                  >
                    {m.time}
                  </span>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-xs text-amber-300 font-medium bg-[#121622] p-3 rounded-2xl border border-gray-800 w-max shadow-md">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#E5B842]" />
                <span>SPILLA AI sedang berpikir dan merangkai jawaban...</span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Versatile Suggestion Chips */}
          <div className="bg-[#121622] px-3 py-2 border-t border-gray-800/80 flex items-center gap-2 overflow-x-auto text-[11px] scrollbar-none shrink-0">
            <button
              onClick={() => handleSendMessage('Analisis teknikal XAUUSD dan level kunci emas hari ini')}
              className="px-2.5 py-1 rounded-full bg-gray-800 hover:bg-gray-700 text-amber-300 border border-amber-500/30 whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
            >
              <TrendingUp className="w-3 h-3 text-amber-400" />
              <span>Analisis XAUUSD Hari Ini</span>
            </button>
            <button
              onClick={() => handleSendMessage('Jelaskan konsep Order Block & Fair Value Gap (FVG) dalam SMC')}
              className="px-2.5 py-1 rounded-full bg-gray-800 hover:bg-gray-700 text-emerald-300 border border-emerald-500/30 whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
            >
              <Zap className="w-3 h-3 text-emerald-400" />
              <span>SMC: Order Block & FVG</span>
            </button>
            <button
              onClick={() => handleSendMessage('Bagaimana cara bergabung CopyTrade Spilla Infinity $1,000?')}
              className="px-2.5 py-1 rounded-full bg-gray-800 hover:bg-gray-700 text-cyan-300 border border-cyan-500/30 whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
            >
              <UserCheck className="w-3 h-3 text-cyan-400" />
              <span>CopyTrade Spilla Infinity</span>
            </button>
            <button
              onClick={() => handleSendMessage('Buatkan contoh script indikator EMA crossover di Pine Script v5')}
              className="px-2.5 py-1 rounded-full bg-gray-800 hover:bg-gray-700 text-purple-300 border border-purple-500/30 whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
            >
              <Code className="w-3 h-3 text-purple-400" />
              <span>Buat Kode PineScript</span>
            </button>
            <button
              onClick={() => handleSendMessage('Jelaskan dampak inflasi CPI dan suku bunga The Fed terhadap harga emas')}
              className="px-2.5 py-1 rounded-full bg-gray-800 hover:bg-gray-700 text-blue-300 border border-blue-500/30 whitespace-nowrap transition-all cursor-pointer flex items-center gap-1"
            >
              <Globe className="w-3 h-3 text-blue-400" />
              <span>Dampak CPI & The Fed</span>
            </button>
          </div>

          {/* Chat Input Field */}
          <div className="p-3 bg-[#0B0D14] border-t border-gray-800 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Tanyakan apa saja (Trading, SMC, Coding, Macro, Sains, Spilla Gold)..."
              className="flex-1 bg-[#121622] border border-gray-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E5B842] transition-colors"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim()}
              className="p-2.5 rounded-xl bg-[#E5B842] hover:bg-amber-400 text-black font-bold disabled:opacity-40 transition-all cursor-pointer shrink-0"
              title="Kirim Pesan"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Trader Verification Modal Form */}
      {showTraderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in font-sans">
          <div className="bg-[#0F121A] border-2 border-[#E5B842] rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-5">
            <button
              onClick={() => setShowTraderModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-1 text-center border-b border-gray-800 pb-4">
              <span className="text-[10px] font-black text-[#E5B842] uppercase tracking-widest px-2.5 py-1 rounded-md bg-[#E5B842]/10 border border-[#E5B842]/30 inline-block mb-1">
                VERIFIKASI AKUN TRADER
              </span>
              <h3 className="text-xl font-black text-white">SPILLA GOLD - MASTER COPY</h3>
              <p className="text-xs text-gray-400">
                Lengkapi data akun MT5 Anda untuk melanjutkan ke Link CopyTrade Follower.
              </p>
            </div>

            <form onSubmit={handleTraderFormSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-gray-300 font-bold mb-1 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#E5B842]" />
                  <span>1. Nama Lengkap / Username:</span>
                </label>
                <input
                  type="text"
                  required
                  value={traderForm.fullName}
                  onChange={(e) => setTraderForm({ ...traderForm, fullName: e.target.value })}
                  placeholder="Contoh: Trader Quant"
                  className="w-full bg-[#151924] border border-gray-800 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#E5B842]"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-bold mb-1 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-[#E5B842]" />
                  <span>2. Nomor Akun Trader (MT5):</span>
                </label>
                <input
                  type="text"
                  required
                  value={traderForm.mt5Account}
                  onChange={(e) => setTraderForm({ ...traderForm, mt5Account: e.target.value })}
                  placeholder="Contoh: 88102349"
                  className="w-full bg-[#151924] border border-gray-800 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#E5B842]"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-bold mb-1 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#E5B842]" />
                  <span>3. Password Investor / Akun Trader:</span>
                </label>
                <input
                  type="password"
                  required
                  value={traderForm.investorPassword}
                  onChange={(e) => setTraderForm({ ...traderForm, investorPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-[#151924] border border-gray-800 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#E5B842]"
                />
              </div>

              <div>
                <label className="block text-gray-300 font-bold mb-1 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-[#E5B842]" />
                  <span>4. Server Broker:</span>
                </label>
                <input
                  type="text"
                  required
                  value={traderForm.brokerServer}
                  onChange={(e) => setTraderForm({ ...traderForm, brokerServer: e.target.value })}
                  placeholder="Contoh: AIMS-Live / AIMS-Demo"
                  className="w-full bg-[#151924] border border-gray-800 rounded-xl p-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#E5B842]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={formSubmitted}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#E5B842] hover:bg-amber-400 text-black font-black text-xs transition-all shadow-xl flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
                >
                  {formSubmitted ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                      <span>Memverifikasi & Redirecting...</span>
                    </>
                  ) : (
                    <>
                      <span>LANJUTKAN KE LINK COPYTRADE</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <p className="text-[10px] text-center text-gray-500">
                🔒 Data verifikasi terenkripsi aman dan diproses langsung oleh sistem SPILLA GOLD.
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

