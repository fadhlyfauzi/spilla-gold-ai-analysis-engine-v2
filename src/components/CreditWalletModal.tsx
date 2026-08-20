import React, { useState, useEffect } from 'react';
import {
  Coins,
  X,
  PlusCircle,
  History,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Copy,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  UserCreditWallet,
  TopUpRequest,
  CreditTransaction,
  PaymentSettings,
} from '../types/credit';

interface CreditWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  authToken: string;
  onBalanceUpdated?: () => void;
  initialTab?: 'TOPUP' | 'TRANSACTIONS' | 'TOPUP_HISTORY';
}

const PRESET_AMOUNTS = [
  { amount: 10000, credits: 10000, analysisCount: 100, label: 'Rp10.000', popular: false },
  { amount: 25000, credits: 25000, analysisCount: 250, label: 'Rp25.000', popular: true },
  { amount: 50000, credits: 50000, analysisCount: 500, label: 'Rp50.000', popular: false },
  { amount: 100000, credits: 100000, analysisCount: 1000, label: 'Rp100.000', popular: false },
  { amount: 250000, credits: 250000, analysisCount: 2500, label: 'Rp250.000', popular: false },
  { amount: 500000, credits: 500000, analysisCount: 5000, label: 'Rp500.000', popular: false },
];

export const CreditWalletModal: React.FC<CreditWalletModalProps> = ({
  isOpen,
  onClose,
  authToken,
  onBalanceUpdated,
  initialTab = 'TOPUP',
}) => {
  const [activeTab, setActiveTab] = useState<'TOPUP' | 'TRANSACTIONS' | 'TOPUP_HISTORY'>(initialTab);
  const [loading, setLoading] = useState<boolean>(true);
  const [wallet, setWallet] = useState<UserCreditWallet | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [topupHistory, setTopupHistory] = useState<TopUpRequest[]>([]);

  // Top Up Form State
  const [selectedAmount, setSelectedAmount] = useState<number>(25000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [transferNotes, setTransferNotes] = useState<string>('');
  const [isSubmittingTopup, setIsSubmittingTopup] = useState<boolean>(false);
  const [activeInvoice, setActiveInvoice] = useState<TopUpRequest | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

  const fetchWalletData = async () => {
    if (!authToken) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${authToken}` };

      // 1. Fetch Wallet & Payment Info
      const walletRes = await fetch('/api/credit/wallet', { headers });
      const walletJson = await walletRes.json();
      if (walletJson.success) {
        setWallet(walletJson.wallet);
        if (walletJson.paymentSettings) {
          setPaymentSettings(walletJson.paymentSettings);
        }
      }

      // 2. Fetch Transactions Ledger
      const txRes = await fetch('/api/credit/transactions', { headers });
      const txJson = await txRes.json();
      if (txJson.success) {
        setTransactions(txJson.transactions || []);
      }

      // 3. Fetch TopUp History
      const topupRes = await fetch('/api/credit/topup/history', { headers });
      const topupJson = await topupRes.json();
      if (topupJson.success) {
        setTopupHistory(topupJson.topups || []);
        // Check if there is an active pending topup
        const pending = (topupJson.topups || []).find((t: TopUpRequest) => t.status === 'PENDING');
        if (pending && !activeInvoice) {
          setActiveInvoice(pending);
        }
      }
    } catch (err) {
      console.error('[Credit Wallet Modal] Error fetching:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWalletData();
    }
  }, [isOpen, authToken]);

  if (!isOpen) return null;

  const currentAmountToPay = isCustom ? Number(customAmount) || 0 : selectedAmount;
  const creditsToReceive = currentAmountToPay;
  const analysisCountEstimate = Math.floor(creditsToReceive / 100);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCreateTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (currentAmountToPay < 1000) {
      setErrorMessage('Nominal Top Up minimal Rp1.000 (1.000 Credit).');
      return;
    }

    setIsSubmittingTopup(true);
    try {
      const res = await fetch('/api/credit/topup/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          amountIdr: currentAmountToPay,
          referenceNotes: transferNotes,
        }),
      });

      const json = await res.json();
      if (json.success && json.topup) {
        setActiveInvoice(json.topup);
        fetchWalletData();
        if (onBalanceUpdated) onBalanceUpdated();
      } else {
        setErrorMessage(json.message || 'Gagal membuat permintaan Top Up.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setIsSubmittingTopup(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0D1017] border border-gray-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-[#11141D]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-[#E5B842] shadow-inner">
              <Coins className="w-5 h-5 text-[#E5B842]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-wide">SPILLA AI CREDIT WALLET</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#E5B842]/20 text-amber-300 border border-[#E5B842]/30">
                  1 Credit = Rp1
                </span>
              </div>
              <p className="text-xs text-gray-400">Saldo internal untuk penggunaan fitur Live Analysis AI</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Card Banner */}
        <div className="p-6 bg-gradient-to-r from-[#121622] via-[#161B29] to-[#121622] border-b border-gray-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Saldo Credit Anda</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-white font-mono tracking-tight">
                  {(wallet?.creditBalance || 0).toLocaleString('id-ID')}
                </span>
                <span className="text-sm font-bold text-[#E5B842]">Credit</span>
                <span className="text-xs text-gray-400 font-mono">
                  (≈ Rp{(wallet?.creditBalance || 0).toLocaleString('id-ID')})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-[#0B0D13] px-4 py-2.5 rounded-xl border border-gray-800">
              <div className="text-right">
                <div className="text-[11px] text-gray-400 uppercase tracking-wider">Tersedia untuk</div>
                <div className="text-base font-bold text-emerald-400 font-mono">
                  {Math.floor((wallet?.creditBalance || 0) / 100).toLocaleString('id-ID')}x
                  <span className="text-xs text-gray-400 font-sans font-normal ml-1">Live Analysis</span>
                </div>
              </div>
              <div className="h-8 w-px bg-gray-800" />
              <div className="text-right">
                <div className="text-[11px] text-gray-400 uppercase tracking-wider">Biaya / Analysis</div>
                <div className="text-base font-bold text-[#E5B842] font-mono">
                  100 <span className="text-xs text-gray-400 font-sans font-normal">Credit (Rp100)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-800 bg-[#0B0E14] px-6">
          <button
            onClick={() => setActiveTab('TOPUP')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'TOPUP'
                ? 'border-[#E5B842] text-[#E5B842]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Top Up Saldo</span>
          </button>
          <button
            onClick={() => setActiveTab('TRANSACTIONS')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'TRANSACTIONS'
                ? 'border-[#E5B842] text-[#E5B842]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Riwayat Transaksi</span>
            {transactions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-800 text-gray-300">
                {transactions.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('TOPUP_HISTORY')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'TOPUP_HISTORY'
                ? 'border-[#E5B842] text-[#E5B842]'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>Riwayat Top Up</span>
            {topupHistory.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-800 text-gray-300">
                {topupHistory.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: TOP UP */}
          {activeTab === 'TOPUP' && (
            <div className="space-y-6">
              {/* If there is an active pending invoice, show it prominently */}
              {activeInvoice && activeInvoice.status === 'PENDING' ? (
                <div className="bg-[#121622] border-2 border-amber-500/40 rounded-2xl p-5 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                      <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
                      <div>
                        <h3 className="text-sm font-bold text-white">INSTRUKSI TRANSFER BANK</h3>
                        <p className="text-[11px] text-gray-400">ID Permintaan: <strong className="text-amber-300 font-mono">{activeInvoice.id}</strong></p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      MENUNGGU KONFIRMASI ADMIN
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bank Details */}
                    <div className="bg-[#0A0D14] p-4 rounded-xl border border-gray-800 space-y-3">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Rekening Tujuan Transfer:</span>
                      <div>
                        <div className="text-xs text-gray-400">Bank Tujuan</div>
                        <div className="text-sm font-bold text-white">{activeInvoice.bankName}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Nomor Rekening</div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <span className="text-base font-mono font-black text-amber-300">{activeInvoice.accountNumber}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(activeInvoice.accountNumber, 'accNo')}
                            className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-xs text-gray-200 flex items-center gap-1 transition-colors"
                          >
                            {copiedField === 'accNo' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedField === 'accNo' ? 'Tersalin' : 'Salin'}</span>
                          </button>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400">Atas Nama</div>
                        <div className="text-xs font-bold text-gray-200">{activeInvoice.accountName}</div>
                      </div>
                    </div>

                    {/* Nominal & Status */}
                    <div className="bg-[#0A0D14] p-4 rounded-xl border border-gray-800 space-y-3 flex flex-col justify-between">
                      <div>
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Nominal yang Harus Ditransfer:</span>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-2xl font-black text-white font-mono">
                            Rp{activeInvoice.amountIdr.toLocaleString('id-ID')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(String(activeInvoice.amountIdr), 'amount')}
                            className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-xs text-gray-200 flex items-center gap-1 transition-colors"
                          >
                            {copiedField === 'amount' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedField === 'amount' ? 'Tersalin' : 'Salin'}</span>
                          </button>
                        </div>
                        <div className="mt-2 text-xs text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mendapatkan {activeInvoice.creditRequested.toLocaleString('id-ID')} Credit ({Math.floor(activeInvoice.creditRequested / 100)}x Analisis)</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300">
                        {paymentSettings?.instructions || 'Setelah melakukan transfer, saldo Credit akan otomatis bertambah ke wallet Anda setelah diverifikasi Admin.'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => setActiveInvoice(null)}
                      className="text-xs text-gray-400 hover:text-gray-200 underline"
                    >
                      + Buat Permintaan Top Up Baru
                    </button>
                    <button
                      onClick={fetchWalletData}
                      disabled={loading}
                      className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-xs font-bold text-gray-200 flex items-center gap-2 transition-colors"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                      <span>Cek Status Saldo</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Top Up Request Form */
                <form onSubmit={handleCreateTopUp} className="space-y-6">
                  {errorMessage && (
                    <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
                      Pilih Paket Top Up SPILLA AI Credit
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {PRESET_AMOUNTS.map((preset) => {
                        const isSelected = !isCustom && selectedAmount === preset.amount;
                        return (
                          <button
                            key={preset.amount}
                            type="button"
                            onClick={() => {
                              setIsCustom(false);
                              setSelectedAmount(preset.amount);
                            }}
                            className={`p-3.5 rounded-xl border text-left transition-all relative cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/15 border-[#E5B842] shadow-lg shadow-amber-500/10'
                                : 'bg-[#121620] border-gray-800 hover:border-gray-700'
                            }`}
                          >
                            {preset.popular && (
                              <span className="absolute -top-2 right-2 px-1.5 py-0.2 rounded text-[9px] font-black bg-[#E5B842] text-black">
                                FAVORIT
                              </span>
                            )}
                            <div className="text-sm font-black text-white font-mono">{preset.label}</div>
                            <div className="text-xs text-[#E5B842] font-bold mt-0.5">
                              {preset.credits.toLocaleString('id-ID')} Credit
                            </div>
                            <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-emerald-400" />
                              <span>{preset.analysisCount}x Live Analysis</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Amount Input Option */}
                  <div className="p-4 rounded-xl bg-[#121620] border border-gray-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-300">Nominal Kustom (Rp)</label>
                      <span className="text-[11px] text-gray-500">1 Credit = Rp1</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-xs text-gray-500 font-bold">Rp</span>
                      <input
                        type="number"
                        placeholder="Contoh: 75000"
                        value={customAmount}
                        onChange={(e) => {
                          setIsCustom(true);
                          setCustomAmount(e.target.value);
                        }}
                        className="w-full bg-[#0A0D14] border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white font-mono focus:border-[#E5B842] focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Summary & Submit */}
                  <div className="bg-[#10141F] p-4 rounded-xl border border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="text-xs text-gray-400">Total yang akan diterima:</div>
                      <div className="text-lg font-black text-[#E5B842] font-mono">
                        {creditsToReceive.toLocaleString('id-ID')} SPILLA AI Credit
                      </div>
                      <div className="text-xs text-emerald-400">
                        Setara dengan {analysisCountEstimate.toLocaleString('id-ID')}x Live Analysis AI
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingTopup || currentAmountToPay < 1000}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#E5B842] to-amber-500 hover:from-[#d8a82d] hover:to-amber-600 text-black font-extrabold text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmittingTopup ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Memproses...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" />
                          <span>Lanjutkan Top Up Rp{currentAmountToPay.toLocaleString('id-ID')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: TRANSACTIONS LEDGER */}
          {activeTab === 'TRANSACTIONS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Buku Besar Mutasi Credit
                </span>
                <button
                  onClick={fetchWalletData}
                  className="text-xs text-[#E5B842] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="p-8 text-center bg-[#121620] rounded-xl border border-gray-800 text-gray-500 text-xs">
                  Belum ada catatan mutasi credit pada akun Anda.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#0C0F16]">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="bg-[#111520] text-gray-400 font-bold border-b border-gray-800">
                      <tr>
                        <th className="p-3">Waktu</th>
                        <th className="p-3">Tipe</th>
                        <th className="p-3">Keterangan</th>
                        <th className="p-3 text-right">Mutasi</th>
                        <th className="p-3 text-right">Saldo Akhir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60 font-mono">
                      {transactions.map((tx) => {
                        const isPlus = tx.creditIn > 0;
                        return (
                          <tr key={tx.id} className="hover:bg-gray-800/30">
                            <td className="p-3 text-gray-400 text-[11px] whitespace-nowrap">
                              {new Date(tx.createdAt).toLocaleString('id-ID')}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  tx.type === 'TOPUP'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : tx.type === 'ANALYSIS'
                                    ? 'bg-blue-500/20 text-blue-300'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}
                              >
                                {tx.type}
                              </span>
                            </td>
                            <td className="p-3 font-sans text-gray-300 text-xs">{tx.description}</td>
                            <td className={`p-3 text-right font-bold whitespace-nowrap ${isPlus ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {isPlus ? `+${tx.creditIn.toLocaleString('id-ID')}` : `-${tx.creditOut.toLocaleString('id-ID')}`} Credit
                            </td>
                            <td className="p-3 text-right text-gray-200 font-bold whitespace-nowrap">
                              {tx.balanceAfter.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TOP UP HISTORY */}
          {activeTab === 'TOPUP_HISTORY' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Riwayat Pengajuan Top Up
                </span>
                <button
                  onClick={fetchWalletData}
                  className="text-xs text-[#E5B842] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>

              {topupHistory.length === 0 ? (
                <div className="p-8 text-center bg-[#121620] rounded-xl border border-gray-800 text-gray-500 text-xs">
                  Belum ada pengajuan Top Up.
                </div>
              ) : (
                <div className="space-y-3">
                  {topupHistory.map((req) => (
                    <div
                      key={req.id}
                      className="p-4 rounded-xl bg-[#10141F] border border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-white">{req.id}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                              req.status === 'CONFIRMED'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : req.status === 'PENDING'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {req.bankName} • {new Date(req.createdAt).toLocaleString('id-ID')}
                        </div>
                        {req.adminNotes && (
                          <div className="text-[11px] text-gray-300 bg-gray-900/60 p-2 rounded border border-gray-800">
                            <strong>Catatan Admin:</strong> {req.adminNotes}
                          </div>
                        )}
                      </div>

                      <div className="text-right sm:self-center">
                        <div className="text-sm font-black text-white font-mono">
                          Rp{req.amountIdr.toLocaleString('id-ID')}
                        </div>
                        <div className="text-xs text-[#E5B842] font-semibold">
                          +{req.creditRequested.toLocaleString('id-ID')} Credit
                        </div>
                        {req.status === 'PENDING' && (
                          <button
                            onClick={() => {
                              setActiveInvoice(req);
                              setActiveTab('TOPUP');
                            }}
                            className="mt-2 px-3 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold transition-colors"
                          >
                            Lihat Rekening Transfer
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
