import React, { useState } from 'react';
import {
  X,
  Lock,
  User,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Hash,
  Server,
} from 'lucide-react';
import spillaLogo from '../assets/images/spilla_gold_logo_1786418245382.jpg';

interface MasterPackageInfo {
  id: string;
  name: string;
  ctaUrl: string;
}

interface TraderLoginModalProps {
  isOpen: boolean;
  selectedMaster: MasterPackageInfo | null;
  onClose: () => void;
}

export const TraderLoginModal: React.FC<TraderLoginModalProps> = ({
  isOpen,
  selectedMaster,
  onClose,
}) => {
  const [identifier, setIdentifier] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [brokerServer, setBrokerServer] = useState<string>('AIMS-Live');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen || !selectedMaster) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!identifier.trim()) {
      setErrorMessage('Silakan masukkan Username / Nama akun trader Anda.');
      return;
    }

    if (!accountNumber.trim()) {
      setErrorMessage('Silakan masukkan Nomor Akun Trader (MT5/MT4).');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Silakan masukkan Password akun trader Anda.');
      return;
    }

    if (!brokerServer.trim()) {
      setErrorMessage('Silakan masukkan Server Broker Anda.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/copytrade/trader-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: identifier.trim(),
          accountNumber: accountNumber.trim(),
          password: password.trim(),
          brokerServer: brokerServer.trim(),
          masterName: selectedMaster.name,
          redirectUrl: selectedMaster.ctaUrl,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage('Login berhasil! Mengalihkan ke link Copy Trade Master...');
        
        // Wait briefly so user sees the success state, then redirect and close modal
        setTimeout(() => {
          const targetUrl = data.redirectUrl || selectedMaster.ctaUrl;
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
          setLoading(false);
          setIdentifier('');
          setAccountNumber('');
          setPassword('');
          setBrokerServer('AIMS-Live');
          setSuccessMessage(null);
          onClose();
        }, 800);
      } else {
        setErrorMessage(data.message || 'Gagal memproses login trader.');
        setLoading(false);
      }
    } catch (err) {
      console.error('[Trader Login Error]', err);
      setErrorMessage('Terjadi kesalahan koneksi. Silakan coba lagi.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn font-sans">
      <div className="bg-[#0F121A] border-2 border-[#E5B842]/50 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative text-gray-100 flex flex-col my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#151924] via-[#0F121A] to-[#151924] p-5 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={spillaLogo}
              alt="SPILLA GOLD Logo"
              className="w-10 h-10 rounded-xl object-cover border border-[#E5B842]/50 shadow-md shrink-0"
              referrerPolicy="no-referrer"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold text-[#E5B842] uppercase tracking-wider">
                  SPILLA GOLD
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                  COPY TRADE
                </span>
              </div>
              <h2 className="text-base font-black text-white tracking-wide uppercase">
                LOGIN AKUN TRADER
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-gray-900/80 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Selected Master Badge Notice */}
          <div className="bg-[#151924] border border-[#E5B842]/40 p-3.5 rounded-xl flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                MASTER YANG DIPILIH:
              </span>
              <span className="text-sm font-black text-[#E5B842] flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#E5B842]" />
                {selectedMaster.name}
              </span>
            </div>
            <span className="text-[10px] font-extrabold px-2.5 py-1 rounded bg-[#E5B842]/10 text-amber-300 border border-[#E5B842]/30 uppercase">
              STEP 2 OF 2
            </span>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed">
            Silakan login akun trader Copy Trade Anda untuk melanjutkan pendaftaran resmi ke link Master{' '}
            <strong className="text-amber-300">{selectedMaster.name}</strong>.
          </p>

          {/* Alert Messages */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 animate-pulse">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5 font-mono">
            {/* Field 1: Username / Nama */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#E5B842]" />
                <span>Username / Nama</span>
              </label>
              <input
                type="text"
                required
                placeholder="Masukkan username atau nama trader"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
                className="w-full bg-gray-900/90 border border-gray-700 focus:border-[#E5B842] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Field 2: Nomor Akun Trader */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-[#E5B842]" />
                <span>Nomor Akun Trader (MT5/MT4)</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: 88201923"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                disabled={loading}
                className="w-full bg-gray-900/90 border border-gray-700 focus:border-[#E5B842] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Field 3: Password Akun Trader */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#E5B842]" />
                <span>Password Akun Trader</span>
              </label>
              <input
                type="password"
                required
                placeholder="Masukkan password akun trader"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full bg-gray-900/90 border border-gray-700 focus:border-[#E5B842] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Field 4: Server Broker */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-[#E5B842]" />
                <span>Server Broker</span>
              </label>
              <input
                type="text"
                required
                placeholder="Contoh: AIMS-Live / AIMS-Server"
                value={brokerServer}
                onChange={(e) => setBrokerServer(e.target.value)}
                disabled={loading}
                className="w-full bg-gray-900/90 border border-gray-700 focus:border-[#E5B842] rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl font-black text-xs bg-gradient-to-r from-[#E5B842] via-amber-400 to-[#E5B842] text-black hover:opacity-95 transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer border border-amber-300 disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>MEMPROSES LOGIN...</span>
                  </div>
                ) : (
                  <>
                    <span>LOGIN & LANJUTKAN</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <p className="text-[10px] text-gray-500 text-center leading-normal">
            🔒 Keamanan terjamin. Data login dicatat secara terenkripsi untuk verifikasi otentikasi Copy Trade.
          </p>
        </div>
      </div>
    </div>
  );
};
