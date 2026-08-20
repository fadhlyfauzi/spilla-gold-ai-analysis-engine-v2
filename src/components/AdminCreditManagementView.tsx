import React, { useState, useEffect } from 'react';
import {
  Coins,
  CreditCard,
  History,
  Settings,
  Users,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  Eye,
  Building,
  Check,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
} from 'lucide-react';
import {
  AdminCreditStats,
  UserWalletWithProfile,
  TopUpRequest,
  CreditTransaction,
  PaymentSettings,
} from '../types/credit';

interface AdminCreditManagementViewProps {
  authToken: string;
}

export const AdminCreditManagementView: React.FC<AdminCreditManagementViewProps> = ({
  authToken,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'TOPUPS' | 'USERS' | 'TRANSACTIONS' | 'SETTINGS'>('TOPUPS');
  const [loading, setLoading] = useState<boolean>(true);
  const [stats, setStats] = useState<AdminCreditStats>({
    totalCreditSoldIdr: 0,
    creditInUserWallets: 0,
    totalCreditUsed: 0,
    totalAiAnalysis: 0,
    pendingTopUpCount: 0,
    pendingTopUpAmountIdr: 0,
  });

  const [topups, setTopups] = useState<TopUpRequest[]>([]);
  const [wallets, setWallets] = useState<UserWalletWithProfile[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    bankName: '',
    accountNumber: '',
    accountName: '',
    instructions: '',
    isActive: true,
    updatedAt: '',
  });

  // Filters & Search
  const [topupStatusFilter, setTopupStatusFilter] = useState<string>('PENDING');
  const [topupSearch, setTopupSearch] = useState<string>('');
  const [userSearch, setUserSearch] = useState<string>('');
  const [txTypeFilter, setTxTypeFilter] = useState<string>('ALL');
  const [txSearch, setTxSearch] = useState<string>('');

  // Selected Topup Detail Modal
  const [selectedTopup, setSelectedTopup] = useState<TopUpRequest | null>(null);
  const [adminNoteInput, setAdminNoteInput] = useState<string>('');
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);
  const [actionAlert, setActionAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Adjust Credit Modal
  const [adjustModalUser, setAdjustModalUser] = useState<UserWalletWithProfile | null>(null);
  const [adjustType, setAdjustType] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('');

  // Payment Settings Form
  const [bankForm, setBankForm] = useState<Partial<PaymentSettings>>({});
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  const fetchAdminCreditData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${authToken}` };

      // 1. Stats
      const statsRes = await fetch('/api/admin/credit/stats', { headers });
      const statsJson = await statsRes.json();
      if (statsJson.success && statsJson.stats) {
        setStats(statsJson.stats);
      }

      // 2. Topups
      const topupRes = await fetch(`/api/admin/credit/topups?status=${topupStatusFilter}&search=${encodeURIComponent(topupSearch)}`, { headers });
      const topupJson = await topupRes.json();
      if (topupJson.success && topupJson.topups) {
        setTopups(topupJson.topups);
      }

      // 3. User Wallets
      const walletsRes = await fetch(`/api/admin/credit/wallets?search=${encodeURIComponent(userSearch)}`, { headers });
      const walletsJson = await walletsRes.json();
      if (walletsJson.success && walletsJson.wallets) {
        setWallets(walletsJson.wallets);
      }

      // 4. Transactions Ledger
      const txRes = await fetch(`/api/admin/credit/transactions?type=${txTypeFilter}&search=${encodeURIComponent(txSearch)}`, { headers });
      const txJson = await txRes.json();
      if (txJson.success && txJson.transactions) {
        setTransactions(txJson.transactions);
      }

      // 5. Payment Settings
      const setRes = await fetch('/api/admin/credit/payment-settings', { headers });
      const setJson = await setRes.json();
      if (setJson.success && setJson.paymentSettings) {
        setPaymentSettings(setJson.paymentSettings);
        setBankForm(setJson.paymentSettings);
      }
    } catch (err) {
      console.error('[Admin Credit Management] Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminCreditData();
  }, [authToken, topupStatusFilter, topupSearch, userSearch, txTypeFilter, txSearch]);

  // Handle Confirm Payment
  const handleConfirmTopUp = async (topupId: string) => {
    if (!window.confirm(`Konfirmasi pembayaran dan tambahkan Credit ke akun pengguna?`)) return;

    setIsProcessingAction(true);
    setActionAlert(null);
    try {
      const res = await fetch(`/api/admin/credit/topup/${topupId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ adminNotes: adminNoteInput }),
      });
      const data = await res.json();
      if (data.success) {
        setActionAlert({ type: 'success', message: data.message });
        setSelectedTopup(null);
        setAdminNoteInput('');
        fetchAdminCreditData();
      } else {
        setActionAlert({ type: 'error', message: data.message || 'Gagal mengonfirmasi pembayaran.' });
      }
    } catch (err: any) {
      setActionAlert({ type: 'error', message: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Reject Payment
  const handleRejectTopUp = async (topupId: string) => {
    if (!adminNoteInput || adminNoteInput.trim().length < 3) {
      alert('Alasan penolakan (Admin Notes) wajib diisi.');
      return;
    }
    if (!window.confirm(`Tolak pengajuan Top Up ini?`)) return;

    setIsProcessingAction(true);
    setActionAlert(null);
    try {
      const res = await fetch(`/api/admin/credit/topup/${topupId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ adminNotes: adminNoteInput }),
      });
      const data = await res.json();
      if (data.success) {
        setActionAlert({ type: 'success', message: data.message });
        setSelectedTopup(null);
        setAdminNoteInput('');
        fetchAdminCreditData();
      } else {
        setActionAlert({ type: 'error', message: data.message || 'Gagal menolak Top Up.' });
      }
    } catch (err: any) {
      setActionAlert({ type: 'error', message: err.message || 'Terjadi kesalahan sistem.' });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Adjust Credit
  const handleAdjustCreditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalUser) return;

    const amount = Number(adjustAmount);
    if (!amount || amount <= 0) {
      alert('Nominal penyesuaian harus lebih dari 0.');
      return;
    }
    if (!adjustReason || adjustReason.trim().length < 3) {
      alert('Alasan penyesuaian wajib diisi minimal 3 karakter.');
      return;
    }

    setIsProcessingAction(true);
    try {
      const res = await fetch('/api/admin/credit/adjust', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          targetUserId: adjustModalUser.userId,
          type: adjustType,
          amount,
          reason: adjustReason,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionAlert({ type: 'success', message: data.message });
        setAdjustModalUser(null);
        setAdjustAmount('');
        setAdjustReason('');
        fetchAdminCreditData();
      } else {
        alert(data.message || 'Gagal menyesuaikan saldo.');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan.');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Handle Save Payment Settings
  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/admin/credit/payment-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(bankForm),
      });

      const data = await res.json();
      if (data.success) {
        setActionAlert({ type: 'success', message: 'Pengaturan rekening pembayaran berhasil diperbarui!' });
        fetchAdminCreditData();
      } else {
        alert(data.message || 'Gagal menyimpan pengaturan.');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert banner */}
      {actionAlert && (
        <div
          className={`p-4 rounded-xl text-xs font-bold flex items-center justify-between ${
            actionAlert.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
              : 'bg-red-500/15 border border-red-500/30 text-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionAlert.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
            <span>{actionAlert.message}</span>
          </div>
          <button onClick={() => setActionAlert(null)} className="text-xs hover:underline opacity-80">
            Tutup
          </button>
        </div>
      )}

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Sold */}
        <div className="bg-[#121620] border border-gray-800 p-4 rounded-xl">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Terjual (Rp)</div>
          <div className="text-lg font-black text-white font-mono mt-1">
            Rp{stats.totalCreditSoldIdr.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-emerald-400 mt-0.5">Pendapatan Top Up</div>
        </div>

        {/* User Wallets */}
        <div className="bg-[#121620] border border-gray-800 p-4 rounded-xl">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Saldo di Wallet</div>
          <div className="text-lg font-black text-[#E5B842] font-mono mt-1">
            {stats.creditInUserWallets.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">Credit siap pakai</div>
        </div>

        {/* Total Credit Used */}
        <div className="bg-[#121620] border border-gray-800 p-4 rounded-xl">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Credit Terpakai</div>
          <div className="text-lg font-black text-blue-400 font-mono mt-1">
            {stats.totalCreditUsed.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-blue-300 mt-0.5">Dari fitur AI</div>
        </div>

        {/* Total AI Analysis */}
        <div className="bg-[#121620] border border-gray-800 p-4 rounded-xl">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total AI Analysis</div>
          <div className="text-lg font-black text-emerald-400 font-mono mt-1">
            {stats.totalAiAnalysis.toLocaleString('id-ID')}x
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">Sesi Sukses</div>
        </div>

        {/* Pending Topups */}
        <div className="bg-[#121620] border-2 border-amber-500/40 p-4 rounded-xl bg-amber-500/5">
          <div className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center justify-between">
            <span>Pending Top Up</span>
            {stats.pendingTopUpCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </div>
          <div className="text-lg font-black text-white font-mono mt-1">
            {stats.pendingTopUpCount} <span className="text-xs text-amber-300 font-sans">Permintaan</span>
          </div>
          <div className="text-[10px] text-amber-400 mt-0.5">Perlu konfirmasi</div>
        </div>

        {/* Pending Amount */}
        <div className="bg-[#121620] border border-gray-800 p-4 rounded-xl">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Nominal Pending</div>
          <div className="text-lg font-black text-amber-300 font-mono mt-1">
            Rp{stats.pendingTopUpAmountIdr.toLocaleString('id-ID')}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">Belum masuk saldo</div>
        </div>
      </div>

      {/* Sub Navigation Bar */}
      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-3">
        <button
          onClick={() => setActiveSubTab('TOPUPS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'TOPUPS'
              ? 'bg-[#E5B842] text-black shadow-md shadow-amber-500/10'
              : 'bg-[#121620] text-gray-300 hover:bg-gray-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Konfirmasi Pembayaran</span>
          {stats.pendingTopUpCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-red-600 text-white">
              {stats.pendingTopUpCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('USERS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'USERS'
              ? 'bg-[#E5B842] text-black shadow-md shadow-amber-500/10'
              : 'bg-[#121620] text-gray-300 hover:bg-gray-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Saldo Pengguna ({wallets.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('TRANSACTIONS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'TRANSACTIONS'
              ? 'bg-[#E5B842] text-black shadow-md shadow-amber-500/10'
              : 'bg-[#121620] text-gray-300 hover:bg-gray-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Buku Besar Mutasi</span>
        </button>

        <button
          onClick={() => setActiveSubTab('SETTINGS')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
            activeSubTab === 'SETTINGS'
              ? 'bg-[#E5B842] text-black shadow-md shadow-amber-500/10'
              : 'bg-[#121620] text-gray-300 hover:bg-gray-800'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Pengaturan Rekening Transfer</span>
        </button>

        <div className="ml-auto">
          <button
            onClick={fetchAdminCreditData}
            disabled={loading}
            className="p-2 rounded-xl bg-[#121620] hover:bg-gray-800 text-gray-300 border border-gray-800 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ==================================================== */}
      {/* SUBTAB 1: KONFIRMASI PEMBAYARAN (TOPUP REQUESTS)     */}
      {/* ==================================================== */}
      {activeSubTab === 'TOPUPS' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
              <input
                type="text"
                placeholder="Cari ID Top Up, nama user, email..."
                value={topupSearch}
                onChange={(e) => setTopupSearch(e.target.value)}
                className="w-full bg-[#121620] border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[#E5B842]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Status:</span>
              <select
                value={topupStatusFilter}
                onChange={(e) => setTopupStatusFilter(e.target.value)}
                className="bg-[#121620] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="ALL">Semua Status</option>
                <option value="PENDING">PENDING (Menunggu Konfirmasi)</option>
                <option value="CONFIRMED">CONFIRMED (Sudah Diterima)</option>
                <option value="REJECTED">REJECTED (Ditolak)</option>
              </select>
            </div>
          </div>

          {/* Topups Table */}
          {topups.length === 0 ? (
            <div className="p-12 text-center bg-[#121620] border border-gray-800 rounded-2xl text-gray-500 text-xs">
              Tidak ada data pengajuan Top Up yang sesuai filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#0C0F16]">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-[#111520] text-gray-400 font-bold border-b border-gray-800">
                  <tr>
                    <th className="p-3">ID Top Up</th>
                    <th className="p-3">Pengguna</th>
                    <th className="p-3 text-right">Nominal Transfer</th>
                    <th className="p-3 text-right">Credit Ditambahkan</th>
                    <th className="p-3">Tanggal</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 font-mono">
                  {topups.map((req) => (
                    <tr key={req.id} className="hover:bg-gray-800/30">
                      <td className="p-3 font-bold text-amber-300 whitespace-nowrap">{req.id}</td>
                      <td className="p-3 font-sans whitespace-nowrap">
                        <div className="font-bold text-white">{req.userName}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{req.email}</div>
                      </td>
                      <td className="p-3 text-right font-black text-white whitespace-nowrap">
                        Rp{req.amountIdr.toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 text-right font-bold text-[#E5B842] whitespace-nowrap">
                        +{req.creditRequested.toLocaleString('id-ID')} Credit
                      </td>
                      <td className="p-3 text-gray-400 text-[11px] whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            req.status === 'CONFIRMED'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : req.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-red-500/20 text-red-400 border border-red-500/30'
                          }`}
                        >
                          {req.status}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => {
                            setSelectedTopup(req);
                            setAdminNoteInput(req.adminNotes || '');
                          }}
                          className="px-3 py-1 rounded-lg bg-gray-800 hover:bg-[#E5B842] hover:text-black text-gray-200 text-[11px] font-bold transition-colors flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Detail</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* SUBTAB 2: SALDO PENGGUNA (USER WALLETS & ADJUSTMENT) */}
      {/* ==================================================== */}
      {activeSubTab === 'USERS' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
            <input
              type="text"
              placeholder="Cari user berdasarkan nama, email, user ID..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full bg-[#121620] border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[#E5B842]"
            />
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#0C0F16]">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#111520] text-gray-400 font-bold border-b border-gray-800">
                <tr>
                  <th className="p-3">Pengguna</th>
                  <th className="p-3">Role</th>
                  <th className="p-3 text-right">Saldo Credit Saat Ini</th>
                  <th className="p-3 text-right">Total Top Up</th>
                  <th className="p-3 text-right">Total Digunakan</th>
                  <th className="p-3 text-right">Total AI Analisis</th>
                  <th className="p-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 font-mono">
                {wallets.map((w) => (
                  <tr key={w.userId} className="hover:bg-gray-800/30">
                    <td className="p-3 font-sans whitespace-nowrap">
                      <div className="font-bold text-white">{w.userName}</div>
                      <div className="text-[11px] text-gray-400 font-mono">{w.email}</div>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          w.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-300' : 'bg-gray-800 text-gray-300'
                        }`}
                      >
                        {w.role}
                      </span>
                    </td>
                    <td className="p-3 text-right font-black text-[#E5B842] whitespace-nowrap text-sm">
                      {w.creditBalance.toLocaleString('id-ID')} Credit
                    </td>
                    <td className="p-3 text-right text-emerald-400 whitespace-nowrap">
                      +{w.totalCreditPurchased.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-right text-rose-400 whitespace-nowrap">
                      -{w.totalCreditUsed.toLocaleString('id-ID')}
                    </td>
                    <td className="p-3 text-right text-white font-bold whitespace-nowrap">
                      {w.totalAnalysis}x
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => {
                          setAdjustModalUser(w);
                          setAdjustType('ADD');
                          setAdjustAmount('');
                          setAdjustReason('');
                        }}
                        className="px-3 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Sesuaikan Saldo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* SUBTAB 3: BUKU BESAR MUTASI (CREDIT LEDGER)          */}
      {/* ==================================================== */}
      {activeSubTab === 'TRANSACTIONS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
              <input
                type="text"
                placeholder="Cari ID transaksi, deskripsi, user..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="w-full bg-[#121620] border border-gray-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-[#E5B842]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Tipe:</span>
              <select
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value)}
                className="bg-[#121620] border border-gray-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="ALL">Semua Tipe</option>
                <option value="TOPUP">TOPUP</option>
                <option value="ANALYSIS">ANALYSIS</option>
                <option value="ADMIN_ADD">ADMIN_ADD</option>
                <option value="ADMIN_DEDUCT">ADMIN_DEDUCT</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-800 bg-[#0C0F16]">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-[#111520] text-gray-400 font-bold border-b border-gray-800">
                <tr>
                  <th className="p-3">Waktu</th>
                  <th className="p-3">Pengguna</th>
                  <th className="p-3">Tipe</th>
                  <th className="p-3">Keterangan</th>
                  <th className="p-3 text-right">Mutasi</th>
                  <th className="p-3 text-right">Saldo Sebelum</th>
                  <th className="p-3 text-right">Saldo Sesudah</th>
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
                      <td className="p-3 font-sans whitespace-nowrap">
                        <div className="font-bold text-white">{tx.userName || 'User'}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{tx.email}</div>
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
                      <td className="p-3 text-right text-gray-400 whitespace-nowrap">
                        {tx.balanceBefore.toLocaleString('id-ID')}
                      </td>
                      <td className="p-3 text-right text-white font-bold whitespace-nowrap">
                        {tx.balanceAfter.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* SUBTAB 4: PENGATURAN REKENING TRANSFER BANK         */}
      {/* ==================================================== */}
      {activeSubTab === 'SETTINGS' && (
        <form onSubmit={handleSavePaymentSettings} className="bg-[#121620] border border-gray-800 rounded-2xl p-6 space-y-6 max-w-2xl">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Building className="w-4 h-4 text-[#E5B842]" />
              <span>Pengaturan Rekening Transfer Bank (Manual Top Up)</span>
            </h3>
            <p className="text-xs text-gray-400 mt-1">
              Rekening ini akan ditampilkan kepada seluruh pengguna saat melakukan permintaan Top Up SPILLA AI Credit.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">Nama Bank</label>
              <input
                type="text"
                value={bankForm.bankName || ''}
                onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                placeholder="Contoh: BCA (Bank Central Asia)"
                required
                className="w-full bg-[#0A0D14] border border-gray-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#E5B842]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">Nomor Rekening</label>
              <input
                type="text"
                value={bankForm.accountNumber || ''}
                onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                placeholder="Contoh: 8830-1928-3921"
                required
                className="w-full bg-[#0A0D14] border border-gray-700 rounded-xl px-4 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#E5B842]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">Atas Nama Rekening</label>
              <input
                type="text"
                value={bankForm.accountName || ''}
                onChange={(e) => setBankForm({ ...bankForm, accountName: e.target.value })}
                placeholder="Contoh: PT SPILLA GOLD INSTITUTIONAL"
                required
                className="w-full bg-[#0A0D14] border border-gray-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#E5B842]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">Petunjuk Transfer untuk Pengguna</label>
              <textarea
                rows={3}
                value={bankForm.instructions || ''}
                onChange={(e) => setBankForm({ ...bankForm, instructions: e.target.value })}
                placeholder="Petunjuk tambahan saat user melakukan transfer..."
                className="w-full bg-[#0A0D14] border border-gray-700 rounded-xl p-4 text-xs text-white focus:outline-none focus:border-[#E5B842]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSavingSettings}
            className="px-6 py-2.5 rounded-xl bg-[#E5B842] hover:bg-[#c99e28] text-black font-extrabold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{isSavingSettings ? 'Menyimpan...' : 'Simpan Pengaturan Rekening'}</span>
          </button>
        </form>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: DETAIL & KONFIRMASI PEMBAYARAN TOP UP      */}
      {/* ==================================================== */}
      {selectedTopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0E121A] border-2 border-gray-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#E5B842]" />
                <h3 className="text-sm font-extrabold text-white">DETAIL PENGAJUAN TOP UP</h3>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  selectedTopup.status === 'CONFIRMED'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : selectedTopup.status === 'PENDING'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                {selectedTopup.status}
              </span>
            </div>

            {/* Details Grid */}
            <div className="bg-[#0A0D14] p-4 rounded-xl border border-gray-800 space-y-3 font-sans text-xs">
              <div className="flex justify-between py-1 border-b border-gray-800/60">
                <span className="text-gray-400">ID Top Up</span>
                <span className="font-mono font-bold text-amber-300">{selectedTopup.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/60">
                <span className="text-gray-400">Nama Pengguna</span>
                <span className="font-bold text-white">{selectedTopup.userName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/60">
                <span className="text-gray-400">Email</span>
                <span className="font-mono text-gray-300">{selectedTopup.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/60">
                <span className="text-gray-400">Nominal Transfer</span>
                <span className="font-mono font-black text-emerald-400 text-sm">
                  Rp{selectedTopup.amountIdr.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-800/60">
                <span className="text-gray-400">Credit yang Ditambahkan</span>
                <span className="font-mono font-bold text-[#E5B842]">
                  +{selectedTopup.creditRequested.toLocaleString('id-ID')} Credit
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-400">Waktu Pengajuan</span>
                <span className="text-gray-300">{new Date(selectedTopup.createdAt).toLocaleString('id-ID')}</span>
              </div>
            </div>

            {/* Admin Notes Input */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Catatan Admin (Wajib jika ditolak / opsional jika dikonfirmasi):
              </label>
              <input
                type="text"
                placeholder="Contoh: Bukti transfer mutasi rekening terverifikasi"
                value={adminNoteInput}
                onChange={(e) => setAdminNoteInput(e.target.value)}
                disabled={selectedTopup.status !== 'PENDING'}
                className="w-full bg-[#0A0D14] border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E5B842]"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2">
              {selectedTopup.status === 'PENDING' ? (
                <>
                  <button
                    onClick={() => handleConfirmTopUp(selectedTopup.id)}
                    disabled={isProcessingAction}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>KONFIRMASI & TAMBAH SALDO</span>
                  </button>
                  <button
                    onClick={() => handleRejectTopUp(selectedTopup.id)}
                    disabled={isProcessingAction}
                    className="px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold text-xs border border-red-500/40 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    TOLAK
                  </button>
                </>
              ) : (
                <div className="w-full text-center text-xs text-gray-500 py-1">
                  Permintaan ini sudah diproses ({selectedTopup.status}) pada{' '}
                  {selectedTopup.confirmedAt ? new Date(selectedTopup.confirmedAt).toLocaleString('id-ID') : '-'}
                </div>
              )}
              <button
                onClick={() => setSelectedTopup(null)}
                className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: SESUAIKAN SALDO MANUAL (ADMIN ADJUST)       */}
      {/* ==================================================== */}
      {adjustModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleAdjustCreditSubmit}
            className="bg-[#0E121A] border-2 border-amber-500/40 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#E5B842]" />
                <h3 className="text-sm font-extrabold text-white">PENYESUAIAN SALDO PENGGUNA</h3>
              </div>
              <button
                type="button"
                onClick={() => setAdjustModalUser(null)}
                className="p-1 rounded bg-gray-800 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Target User Info */}
            <div className="bg-[#0A0D14] p-3.5 rounded-xl border border-gray-800 text-xs space-y-1">
              <div className="text-gray-400">Pengguna: <strong className="text-white">{adjustModalUser.userName}</strong></div>
              <div className="text-gray-400">Email: <span className="font-mono text-gray-300">{adjustModalUser.email}</span></div>
              <div className="text-gray-400">Saldo Saat Ini: <strong className="text-[#E5B842] font-mono">{adjustModalUser.creditBalance.toLocaleString('id-ID')} Credit</strong></div>
            </div>

            {/* Type selector: ADD / DEDUCT */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustType('ADD')}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  adjustType === 'ADD'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-[#0A0D14] border-gray-800 text-gray-400'
                }`}
              >
                <PlusCircle className="w-4 h-4" />
                <span>Tambah Saldo (+)</span>
              </button>
              <button
                type="button"
                onClick={() => setAdjustType('DEDUCT')}
                className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                  adjustType === 'DEDUCT'
                    ? 'bg-red-500/20 border-red-500 text-red-300'
                    : 'bg-[#0A0D14] border-gray-800 text-gray-400'
                }`}
              >
                <MinusCircle className="w-4 h-4" />
                <span>Kurangi Saldo (-)</span>
              </button>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Nominal Credit</label>
              <input
                type="number"
                placeholder="Contoh: 10000"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                required
                className="w-full bg-[#0A0D14] border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#E5B842]"
              />
            </div>

            {/* Reason */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Alasan Penyesuaian <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="Contoh: Bonus Registrasi / Koreksi Sistem / Promo"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                required
                className="w-full bg-[#0A0D14] border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#E5B842]"
              />
            </div>

            {/* Submit */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={isProcessingAction}
                className="flex-1 py-2.5 rounded-xl bg-[#E5B842] hover:bg-[#c99e28] text-black font-extrabold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isProcessingAction ? 'Menyimpan...' : 'Simpan Penyesuaian'}
              </button>
              <button
                type="button"
                onClick={() => setAdjustModalUser(null)}
                className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition-colors"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
