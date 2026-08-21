import React, { useState } from 'react';
import { X, ShieldCheck, Server, Hash, Building2, AlertCircle, CheckCircle2, Loader2, Link2, Key, Eye, EyeOff, Info } from 'lucide-react';

interface ConnectTradingAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountConnected: (account: any) => void;
  authToken?: string | null;
}

export const ConnectTradingAccountModal: React.FC<ConnectTradingAccountModalProps> = ({
  isOpen,
  onClose,
  onAccountConnected,
  authToken,
}) => {
  const [brokerSelect, setBrokerSelect] = useState<'AIMS' | 'XM' | 'HFM' | 'METAQUOTES' | 'OTHER'>('AIMS');
  const [customBroker, setCustomBroker] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [tradingPassword, setTradingPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [brokerServer, setBrokerServer] = useState<string>('AIMS-Live');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBrokerChange = (val: 'AIMS' | 'XM' | 'HFM' | 'METAQUOTES' | 'OTHER') => {
    setBrokerSelect(val);
    if (val === 'AIMS') {
      setBrokerServer('AIMS-Live');
    } else if (val === 'XM') {
      setBrokerServer('XMGlobal-Real 1');
    } else if (val === 'HFM') {
      setBrokerServer('HFMarkets-Live-Server');
    } else if (val === 'METAQUOTES') {
      setBrokerServer('MetaQuotes-Demo');
    } else {
      setBrokerServer('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const effectiveBroker = brokerSelect === 'OTHER' ? customBroker.trim() : brokerSelect;
    const cleanAccount = accountNumber.trim();
    const cleanPassword = tradingPassword.trim();
    const cleanServer = brokerServer.trim();

    if (!cleanAccount) {
      setErrorMsg('Nomor Akun / Login MT5 wajib diisi.');
      return;
    }

    if (!cleanPassword) {
      setErrorMsg('MT5 Trading Password wajib diisi.');
      return;
    }

    if (!cleanServer) {
      setErrorMsg('Broker Server wajib diisi.');
      return;
    }

    if (brokerSelect === 'OTHER' && !effectiveBroker) {
      setErrorMsg('Nama Broker wajib diisi jika memilih OTHER.');
      return;
    }

    setIsLoading(true);

    try {
      const token = authToken || localStorage.getItem('spilla_token');
      const res = await fetch('/api/mt5/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          broker: effectiveBroker || 'AIMS',
          brokerName: brokerSelect === 'OTHER' ? customBroker.trim() : undefined,
          accountNumber: cleanAccount,
          brokerServer: cleanServer || 'AIMS-Live',
          tradingPassword: cleanPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.code === 'ACCOUNT_ALREADY_REGISTERED') {
          throw new Error('Akun MT5 ini sudah terdaftar di sistem. Gunakan nomor akun lain atau hubungi admin.');
        }
        throw new Error(data.message || 'Gagal mendaftarkan akun MT5.');
      }

      setSuccessMsg('Akun MT5 berhasil didaftarkan! Status akun Anda sekarang: WAITING FOR MT5.');
      onAccountConnected(data.account);

      setTimeout(() => {
        setIsLoading(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err?.message || 'Terjadi kesalahan koneksi saat mendaftarkan akun MT5.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-mono">
      <div className="bg-[#0F1115] border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
        {/* Header */}
        <div className="bg-[#141822] px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#E5B842]/15 border border-[#E5B842]/30 flex items-center justify-center text-[#E5B842]">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white tracking-wide uppercase">CONNECT TRADING ACCOUNT</h2>
              <p className="text-[10px] text-gray-400 font-sans">Hubungkan Akun MetaTrader 5 ke SPILLA Engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {/* Security & Operator Notice */}
          <div className="p-3 bg-blue-950/20 border border-blue-500/30 rounded-xl space-y-2 text-xs text-blue-300">
            <div className="flex items-start gap-2 text-[11px] leading-relaxed font-sans text-gray-300">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-blue-400">Data Terenkripsi (AES-256-GCM):</strong> Data akun digunakan oleh operator SPILLA untuk menghubungkan akun Anda ke terminal MT5 pusat.
              </span>
            </div>
            <div className="flex items-start gap-2 text-[10.5px] leading-relaxed font-sans text-amber-300/90 bg-amber-950/30 p-2 rounded-lg border border-amber-500/20">
              <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Gunakan <strong className="text-white">Trading/Master Password</strong> yang memiliki izin transaksi. Jangan gunakan Investor Password / Read-Only Password.
              </span>
            </div>
          </div>

          {/* Broker Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-300 uppercase flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#E5B842]" />
              BROKER
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {(['AIMS', 'XM', 'HFM', 'METAQUOTES', 'OTHER'] as const).map((b) => (
                <button
                  type="button"
                  key={b}
                  onClick={() => handleBrokerChange(b)}
                  className={`py-2 px-1 text-[11px] font-bold rounded-lg border transition-all text-center ${
                    brokerSelect === b
                      ? 'bg-[#E5B842] text-black border-[#E5B842] shadow-md shadow-[#E5B842]/20 font-black'
                      : 'bg-[#141822] text-gray-400 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  {b === 'METAQUOTES' ? 'METAQ' : b}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Broker Input if OTHER */}
          {brokerSelect === 'OTHER' && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="text-[10px] font-bold text-gray-400 uppercase">BROKER NAME</label>
              <input
                type="text"
                value={customBroker}
                onChange={(e) => setCustomBroker(e.target.value)}
                placeholder="Contoh: Oroku Edge Ltd, Exness, IC Markets"
                className="w-full bg-[#141822] border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-[#E5B842]"
                required
              />
            </div>
          )}

          {/* MT5 Account Number */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-300 uppercase flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-[#E5B842]" />
              MT5 ACCOUNT / LOGIN
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Contoh: 1019008"
              className="w-full bg-[#141822] border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-[#E5B842]"
              required
            />
          </div>

          {/* MT5 Trading Password */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-300 uppercase flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-[#E5B842]" />
                MT5 TRADING PASSWORD
              </span>
              <span className="text-[9px] text-gray-500 font-sans normal-case">Master Password (Bukan Read-Only)</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={tradingPassword}
                onChange={(e) => setTradingPassword(e.target.value)}
                placeholder="Masukkan Trading / Master Password MT5"
                className="w-full bg-[#141822] border border-gray-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-[#E5B842]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Broker Server */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-300 uppercase flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-[#E5B842]" />
              BROKER SERVER
            </label>
            <input
              type="text"
              value={brokerServer}
              onChange={(e) => setBrokerServer(e.target.value)}
              placeholder="Contoh: OrokuEdgeLtd-Live, AIMS-Live, XMGlobal-Real 1"
              className="w-full bg-[#141822] border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono placeholder-gray-600 focus:outline-none focus:border-[#E5B842]"
              required
            />
          </div>

          {/* Messages */}
          {errorMsg && (
            <div className="p-3 bg-rose-950/30 border border-rose-500/40 rounded-xl flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex items-start gap-2 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 rounded-xl bg-[#E5B842] hover:bg-[#d4a737] active:scale-[0.99] text-black font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#E5B842]/20 disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-black" />
                <span>CONNECTING ACCOUNT...</span>
              </>
            ) : (
              <>
                <Link2 className="w-4 h-4 text-black" />
                <span>CONNECT ACCOUNT</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

