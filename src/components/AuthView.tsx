import React, { useState, useEffect } from 'react';
import spillaLogo from '../assets/images/spilla_gold_logo_1786418245382.jpg';
import {
  ShieldCheck,
  Lock,
  Mail,
  User,
  Zap,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Cpu,
  BarChart2,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { AuthUser } from '../types';

interface AuthViewProps {
  onLoginSuccess: (user: AuthUser, token: string) => void;
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({
  onLoginSuccess,
  currentPath = window.location.pathname,
  onNavigate,
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(currentPath === '/register');
  const [isAdminMode, setIsAdminMode] = useState<boolean>(currentPath === '/admin/login');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);
  const [showForgotPassword, setShowForgotPassword] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  // Sync state with currentPath
  useEffect(() => {
    if (currentPath === '/admin/login') {
      setIsAdminMode(true);
      setIsRegisterMode(false);
    } else if (currentPath === '/register') {
      setIsRegisterMode(true);
      setIsAdminMode(false);
    } else if (currentPath === '/login' || currentPath === '/') {
      setIsAdminMode(false);
      setIsRegisterMode(false);
    }
  }, [currentPath]);

  // Form Fields
  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [accountType, setAccountType] = useState<string>('Trader Individu');

  // Status & Notifications
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const navigateTo = (path: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (onNavigate) {
      onNavigate(path);
    } else if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    if (path === '/admin/login') {
      setIsAdminMode(true);
      setIsRegisterMode(false);
    } else if (path === '/register') {
      setIsRegisterMode(true);
      setIsAdminMode(false);
    } else {
      setIsAdminMode(false);
      setIsRegisterMode(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (isRegisterMode) {
      // Validate Register
      if (!fullName.trim() || !email.trim() || !password) {
        setErrorMessage('Mohon lengkapi seluruh kolom yang diwajibkan.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('Password minimal harus 6 karakter.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Konfirmasi password tidak cocok dengan password.');
        return;
      }
      if (!agreeTerms) {
        setErrorMessage('Anda harus menyetujui Syarat & Ketentuan SPILLA GOLD.');
        return;
      }

      setLoading(true);
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName,
            email,
            password,
            confirmPassword,
            accountType,
            role: 'USER',
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Gagal mendaftar.');
        }

        setSuccessMessage(data.message || 'Pendaftaran berhasil! Mengalihkan ke Engine...');
        if (data.token && data.user) {
          if (rememberMe) {
            localStorage.setItem('spilla_token', data.token);
            localStorage.setItem('spilla_user', JSON.stringify(data.user));
          }
          setTimeout(() => {
            onLoginSuccess(data.user, data.token);
          }, 1200);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Terjadi kesalahan saat mendaftar.');
      } finally {
        setLoading(false);
      }
    } else {
      // Validate Login
      if (!email.trim() || !password) {
        setErrorMessage('Email dan password wajib diisi.');
        return;
      }

      setLoading(true);
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Email atau password salah.');
        }

        // Strict role validation for Admin Login
        if (isAdminMode) {
          const userRole = data.user?.role;
          if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
            setErrorMessage('Anda tidak memiliki akses administrator.');
            setLoading(false);
            return;
          }
        }

        setSuccessMessage(data.message || 'Login berhasil!');
        if (data.token && data.user) {
          if (rememberMe) {
            localStorage.setItem('spilla_token', data.token);
            localStorage.setItem('spilla_user', JSON.stringify(data.user));
          }
          setTimeout(() => {
            onLoginSuccess(data.user, data.token);
          }, 800);
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'Email atau password salah.');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleForgotPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotMessage(`Instruksi reset password telah dikirim ke ${forgotEmail}. Silakan periksa email Anda.`);
    setTimeout(() => {
      setShowForgotPassword(false);
      setForgotMessage(null);
      setForgotEmail('');
    }, 3500);
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-gray-100 flex items-center justify-center p-4 sm:p-6 lg:p-10 font-sans selection:bg-[#E5B842]/30 selection:text-[#E5B842]">
      {/* Background Decorative Glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-[#E5B842]/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#0B0E14]/80 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-gray-800/80 bg-[#111622]/90 backdrop-blur-xl shadow-2xl shadow-black/80 overflow-hidden">
        {/* LEFT COLUMN: Mini Preview & Highlights */}
        <div className="lg:col-span-6 p-8 lg:p-12 bg-gradient-to-br from-[#0B0E14] via-[#111622] to-[#181F30] border-b lg:border-b-0 lg:border-r border-gray-800/80 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Grid Overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(#E5B842_1px,transparent_1px)] [background-size:24px_24px] opacity-5 pointer-events-none" />

          <div>
            {/* Branding Header */}
            <div className="flex items-center gap-3 mb-8">
              <img
                src={spillaLogo}
                alt="SPILLA GOLD Logo"
                className="w-12 h-12 rounded-xl object-cover border border-[#E5B842]/50 shadow-lg shadow-[#E5B842]/20 shrink-0"
                referrerPolicy="no-referrer"
              />
              <div>
                <h1 className="text-xl font-black tracking-wider text-white flex items-center gap-2">
                  SPILLA GOLD <span className="text-xs px-2 py-0.5 rounded bg-[#E5B842]/10 text-[#E5B842] font-semibold border border-[#E5B842]/30">QUANT V4</span>
                </h1>
                <p className="text-xs text-gray-400 font-medium">Institutional XAUUSD Quantitative Workstation</p>
              </div>
            </div>

            {/* Main Headline */}
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mb-4">
              Akses Engine Analisis Presisi Institutional & Signal <span className="text-[#E5B842]">XAUUSD Live</span>
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed mb-8">
              Sistem AI & Quantitative Engine terpadu dengan 14+ Data Collectors (FRED, CFTC COT, CME FedWatch, MetaTrader 5 Bridge) untuk menghasilkan sinyal presisi tinggi.
            </p>

            {/* Feature Highlights Grid */}
            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-gray-900/60 border border-gray-800/80 hover:border-[#E5B842]/30 transition-all">
                <div className="p-2 rounded-lg bg-[#E5B842]/10 text-[#E5B842] shrink-0">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-200">AI 3.6 Flash & Multi-Model Confluence</h4>
                  <p className="text-xs text-gray-400">Sintesis AI narrative & kuantitatif realtime berakurasi tinggi.</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-gray-900/60 border border-gray-800/80 hover:border-emerald-500/30 transition-all">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-200">MetaTrader 5 (MT5) EA Direct API</h4>
                  <p className="text-xs text-gray-400">Integrasi otomatis via <code className="text-[#E5B842] bg-black/40 px-1 py-0.5 rounded text-[10px]">GET /api/ea/signal</code> untuk MQL5 Expert Advisors.</p>
                </div>
              </div>

              <div className="flex items-start gap-3.5 p-3.5 rounded-xl bg-gray-900/60 border border-gray-800/80 hover:border-blue-500/30 transition-all">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-200">100% Price Sync Guarantee</h4>
                  <p className="text-xs text-gray-400">Sinkronisasi mutlak antara Header, LightWeight Chart, Dashboard, dan Signal Entry.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Authentication Form */}
        <div className="lg:col-span-6 p-8 lg:p-12 flex flex-col justify-center bg-[#0D111A]">
          <div className="max-w-md mx-auto w-full">
            {/* Header / Mode Indicator */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-widest text-[#E5B842] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  {isRegisterMode ? 'Form Pendaftaran Baru' : isAdminMode ? 'Autentikasi Mode Admin' : 'Autentikasi Pengguna'}
                </span>
                {isAdminMode && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                    ADMIN
                  </span>
                )}
              </div>
              <h3 className="text-2xl font-bold text-white">
                {isRegisterMode
                  ? 'Buat Akun SPILLA GOLD'
                  : isAdminMode
                  ? 'SPILLA GOLD ADMIN LOGIN'
                  : 'Masuk ke Engine Analisis'}
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                {isRegisterMode
                  ? 'Isi formulir di bawah ini untuk mengakses dashboard kuantitatif XAUUSD.'
                  : isAdminMode
                  ? 'Masukkan kredensial administrator terdaftar untuk mengakses kontrol sistem.'
                  : 'Masukkan email & password terdaftar untuk memulai sesi analisis.'}
              </p>
            </div>

            {/* Error Alert */}
            {errorMessage && (
              <div className="mb-6 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-300">Autentikasi Gagal</p>
                  <p className="mt-0.5 leading-relaxed">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Success Alert */}
            {successMessage && (
              <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-start gap-2.5 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-emerald-300">Berhasil</p>
                  <p className="mt-0.5 leading-relaxed">{successMessage}</p>
                </div>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name field (Register Mode Only) */}
              {isRegisterMode && (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">Nama Lengkap</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Contoh: John Trader"
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E5B842] focus:ring-1 focus:ring-[#E5B842] transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Email field */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E5B842] focus:ring-1 focus:ring-[#E5B842] transition-colors"
                  />
                </div>
              </div>

              {/* Account Type Field (Register Mode Only) */}
              {isRegisterMode && (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">Tipe Akun Trader</label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#E5B842] focus:ring-1 focus:ring-[#E5B842] transition-colors"
                  >
                    <option value="Trader Individu">Trader Individu (Spot Gold / Forex)</option>
                    <option value="Institutional Quantitative">Institutional / Quant Fund Trader</option>
                    <option value="Expert Advisor Developer">Expert Advisor (MQL5) Developer</option>
                  </select>
                </div>
              )}

              {/* Password field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-gray-300">Password</label>
                  {!isRegisterMode && (
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-[11px] text-[#E5B842] hover:underline"
                    >
                      Lupa Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E5B842] focus:ring-1 focus:ring-[#E5B842] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password field (Register Mode Only) */}
              {isRegisterMode && (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">Konfirmasi Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E5B842] focus:ring-1 focus:ring-[#E5B842] transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Remember Me / Terms Checkboxes */}
              {!isRegisterMode ? (
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 text-gray-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-gray-800 bg-gray-900 text-[#E5B842] focus:ring-[#E5B842]"
                    />
                    <span>Ingat Saya (Simpan Sesi)</span>
                  </label>
                </div>
              ) : (
                <div className="pt-1">
                  <label className="flex items-start gap-2 text-xs text-gray-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 rounded border-gray-800 bg-gray-900 text-[#E5B842] focus:ring-[#E5B842]"
                    />
                    <span>
                      Saya menyetujui <span className="text-[#E5B842]">Syarat & Ketentuan Penggunaan SPILLA GOLD Engine</span> serta kebijakan privasi data.
                    </span>
                  </label>
                </div>
              )}

              {/* Main Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-xs bg-gradient-to-r from-[#E5B842] via-[#F0B90B] to-[#D4A32A] text-black hover:opacity-95 active:scale-[0.99] transition-all shadow-lg shadow-[#E5B842]/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Memproses Autentikasi...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-black" />
                    <span>
                      {isRegisterMode
                        ? 'Daftar Sekarang'
                        : isAdminMode
                        ? '[ LOGIN ADMIN ]'
                        : 'LOGIN'}
                    </span>
                  </>
                )}
              </button>
            </form>

            {/* Mode Switchers */}
            <div className="mt-6 pt-6 border-t border-gray-800/80 space-y-3 text-center">
              <div>
                {!isRegisterMode ? (
                  <p className="text-xs text-gray-400">
                    Belum punya akun?{' '}
                    <button
                      type="button"
                      onClick={() => navigateTo('/register')}
                      className="font-bold text-[#E5B842] hover:underline"
                    >
                      Daftar Sekarang
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-gray-400">
                    Sudah punya akun?{' '}
                    <button
                      type="button"
                      onClick={() => navigateTo('/login')}
                      className="font-bold text-[#E5B842] hover:underline"
                    >
                      Login di sini
                    </button>
                  </p>
                )}
              </div>

              {/* Secondary Admin / Trader Navigation Toggle */}
              <div>
                {isAdminMode ? (
                  <button
                    type="button"
                    onClick={() => navigateTo('/login')}
                    className="text-xs text-gray-400 hover:text-white font-medium flex items-center justify-center gap-1.5 mx-auto hover:underline"
                  >
                    ← Kembali ke Login Trader
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigateTo('/admin/login')}
                    className="text-xs text-amber-400/80 hover:text-amber-300 font-medium flex items-center justify-center gap-1.5 mx-auto hover:underline"
                  >
                    Login sebagai Admin <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#111622] border border-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fadeIn">
            <h4 className="text-lg font-bold text-white mb-2">Lupa Password Akun</h4>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              Masukkan alamat email terdaftar Anda. Kami akan mengirimkan pesan pemulihan password ke email tersebut.
            </p>

            {forgotMessage && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                {forgotMessage}
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Email Terdaftar</label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E5B842]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white bg-gray-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-black bg-[#E5B842] hover:bg-[#F0B90B]"
                >
                  Kirim Instruksi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

