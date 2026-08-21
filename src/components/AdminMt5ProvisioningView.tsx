import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Cpu,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Trash2,
  ExternalLink,
  Shield,
  Activity,
  Copy,
  Check,
  Building2,
  Hash,
  Layers,
  User,
  Mail,
  Info,
  DollarSign,
  Terminal,
  Zap,
  Radio,
  Eye,
  EyeOff,
  Key,
  Lock,
  Unlock,
  Loader2,
  X,
  PlayCircle,
  PauseCircle,
} from 'lucide-react';
import { AdminTradingAccountRecord, AdminMt5ProvisioningStats, Mt5ProvisioningStatus } from '../types';

interface AdminMt5ProvisioningViewProps {
  authToken: string;
}

export const AdminMt5ProvisioningView: React.FC<AdminMt5ProvisioningViewProps> = ({ authToken }) => {
  const [accounts, setAccounts] = useState<AdminTradingAccountRecord[]>([]);
  const [stats, setStats] = useState<AdminMt5ProvisioningStats>({
    total: 0,
    waitingCount: 0,
    onlineCount: 0,
    offlineCount: 0,
    processingCount: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterBroker, setFilterBroker] = useState<string>('ALL');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AdminTradingAccountRecord | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isUpdatingProcessing, setIsUpdatingProcessing] = useState<string | null>(null);

  // Credential Reveal State
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [loadingReveal, setLoadingReveal] = useState<Record<string, boolean>>({});
  const [revealError, setRevealError] = useState<Record<string, string | null>>({});

  // Fetch MT5 provisioning accounts from backend
  const fetchAccounts = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await fetch('/api/admin/mt5/accounts', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await res.json();
      if (data.success && data.accounts) {
        setAccounts(data.accounts);
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err) {
      console.error('[Admin Mt5 Provisioning Fetch Error]', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    fetchAccounts(true);
    // Poll every 4 seconds for real-time heartbeat sync
    const interval = setInterval(() => {
      fetchAccounts(false);
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchAccounts]);

  // Copy helper
  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Reveal Password Helper
  const handleRevealPassword = async (accountNumber: string) => {
    setLoadingReveal((prev) => ({ ...prev, [accountNumber]: true }));
    setRevealError((prev) => ({ ...prev, [accountNumber]: null }));
    try {
      const res = await fetch(`/api/admin/mt5/accounts/${accountNumber}/reveal-credential`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await res.json();
      if (data.success && data.tradingPassword) {
        setRevealedPasswords((prev) => ({ ...prev, [accountNumber]: data.tradingPassword }));
      } else {
        setRevealError((prev) => ({
          ...prev,
          [accountNumber]: data.message || 'Kredensial terenkripsi tidak ditemukan.',
        }));
      }
    } catch (err: any) {
      setRevealError((prev) => ({
        ...prev,
        [accountNumber]: err?.message || 'Gagal menghubungi server untuk membuka kredensial.',
      }));
    } finally {
      setLoadingReveal((prev) => ({ ...prev, [accountNumber]: false }));
    }
  };

  const handleHidePassword = (accountNumber: string) => {
    setRevealedPasswords((prev) => {
      const next = { ...prev };
      delete next[accountNumber];
      return next;
    });
  };

  // Toggle Processing status
  const handleToggleProcessing = async (accountNumber: string, currentStatus: string) => {
    setIsUpdatingProcessing(accountNumber);
    const isCurrentlyProcessing = currentStatus === 'PROCESSING';
    try {
      const res = await fetch(`/api/admin/mt5/accounts/${accountNumber}/processing`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ isProcessing: !isCurrentlyProcessing }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(data.message);
        fetchAccounts(false);
      } else {
        alert(data.message || 'Gagal mengubah status processing.');
      }
    } catch (err) {
      alert('Terjadi kesalahan saat memperbarui status processing.');
    } finally {
      setIsUpdatingProcessing(null);
    }
  };

  // Delete / Disconnect Account
  const handleDeleteAccount = async (accountNumber: string, broker: string) => {
    if (
      !window.confirm(
        `PERINGATAN ADMIN: Apakah Anda yakin ingin menghapus akun MT5 ${accountNumber} (${broker})?\n\nTindakan ini akan mencabut pendaftaran akun dan kredensial terenkripsi dari database SPILLA.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/mt5/accounts/${accountNumber}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(data.message);
        if (selectedAccount?.accountNumber === accountNumber) {
          setSelectedAccount(null);
        }
        fetchAccounts(false);
      } else {
        alert(data.message || 'Gagal menghapus akun MT5.');
      }
    } catch (err) {
      alert('Terjadi kesalahan saat menghapus akun MT5.');
    }
  };

  // Filter Accounts
  const filteredAccounts = accounts.filter((acc) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      acc.accountNumber.toLowerCase().includes(query) ||
      acc.userName.toLowerCase().includes(query) ||
      acc.userEmail.toLowerCase().includes(query) ||
      acc.broker.toLowerCase().includes(query) ||
      acc.brokerServer.toLowerCase().includes(query) ||
      (acc.workerId && acc.workerId.toLowerCase().includes(query));

    const matchesStatus = filterStatus === 'ALL' || acc.status === filterStatus;
    const matchesBroker = filterBroker === 'ALL' || acc.broker === filterBroker;

    return matchesSearch && matchesStatus && matchesBroker;
  });

  const uniqueBrokers = Array.from(new Set(accounts.map((a) => a.broker).filter(Boolean)));

  return (
    <div className="space-y-6">
      {/* Top Banner / Provisioning Overview */}
      <div className="p-6 rounded-2xl bg-[#111622] border border-gray-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-[#E5B842] p-0.5 shadow-lg shadow-amber-500/20 shrink-0 mt-0.5">
              <div className="w-full h-full bg-[#0B0E14] rounded-[10px] flex items-center justify-center">
                <Terminal className="w-6 h-6 text-[#E5B842]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-black text-white tracking-wide uppercase">
                  MT5 ACCOUNT PROVISIONING QUEUE
                </h2>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-[#E5B842] border border-amber-500/40">
                  CENTRAL LAPTOP ROUTING
                </span>
                {stats.waitingCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/40 animate-pulse flex items-center gap-1">
                    <Radio className="w-3 h-3" />
                    {stats.waitingCount} AKUN WAITING FOR MT5
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-1 max-w-3xl leading-relaxed">
                Antrean registrasi akun MT5 dari member. Operator membuka terminal MT5 di laptop pusat, login dengan
                kredensial trader, dan memasang EA <strong className="text-white">SPILLA Executor v2.30</strong>. Sistem
                secara otomatis mendeteksi detak (heartbeat) dan mengubah status menjadi <strong className="text-emerald-400">ONLINE</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-center">
            <button
              onClick={() => fetchAccounts(true)}
              className="px-3.5 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs font-bold text-gray-300 hover:text-white transition-colors flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#E5B842]' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        {/* Security Assurance Banner */}
        <div className="mt-4 p-3 bg-blue-950/20 border border-blue-500/30 rounded-xl flex items-center gap-2.5 text-xs text-blue-300">
          <Shield className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-[11px] leading-relaxed text-gray-300">
            <strong className="text-blue-400">Security Architecture (AES-256-GCM):</strong> Kredensial akun MT5 trader
            dienkripsi menggunakan AES-256-GCM. Operator SPILLA dapat membuka kata sandi secara aman untuk menghubungkan akun
            ke terminal MT5 pusat di laptop.
          </span>
        </div>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionMessage}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-gray-400 hover:text-white text-xs">
            Tutup
          </button>
        </div>
      )}

      {/* STATS TILES (5 Metric Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total */}
        <div
          onClick={() => setFilterStatus('ALL')}
          className={`p-4 rounded-2xl bg-[#111622] border transition-all cursor-pointer ${
            filterStatus === 'ALL'
              ? 'border-[#E5B842] shadow-lg shadow-[#E5B842]/10 bg-[#141a29]'
              : 'border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-gray-400 uppercase">Total Akun</span>
            <div className="p-1.5 rounded-lg bg-gray-800 text-gray-300">
              <Layers className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-white">{stats.total}</div>
          <p className="text-[10px] text-gray-500 mt-0.5">Semua akun terdaftar</p>
        </div>

        {/* WAITING FOR MT5 (Prominent) */}
        <div
          onClick={() => setFilterStatus('WAITING FOR MT5')}
          className={`p-4 rounded-2xl bg-[#111622] border transition-all cursor-pointer ${
            filterStatus === 'WAITING FOR MT5'
              ? 'border-blue-500 shadow-lg shadow-blue-500/20 bg-blue-950/20'
              : stats.waitingCount > 0
              ? 'border-blue-500/40 bg-blue-950/10'
              : 'border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-black text-blue-400 uppercase flex items-center gap-1">
              {stats.waitingCount > 0 && <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />}
              WAITING FOR MT5
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-400">{stats.waitingCount}</div>
          <p className="text-[10px] text-gray-400 mt-0.5">Menunggu login di MT5 pusat</p>
        </div>

        {/* PROCESSING */}
        <div
          onClick={() => setFilterStatus('PROCESSING')}
          className={`p-4 rounded-2xl bg-[#111622] border transition-all cursor-pointer ${
            filterStatus === 'PROCESSING'
              ? 'border-purple-500 shadow-lg shadow-purple-500/20 bg-purple-950/20'
              : 'border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-purple-400 uppercase">PROCESSING</span>
            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-400">{stats.processingCount}</div>
          <p className="text-[10px] text-gray-500 mt-0.5">Sedang disetup admin</p>
        </div>

        {/* ONLINE */}
        <div
          onClick={() => setFilterStatus('ONLINE')}
          className={`p-4 rounded-2xl bg-[#111622] border transition-all cursor-pointer ${
            filterStatus === 'ONLINE'
              ? 'border-emerald-500 shadow-lg shadow-emerald-500/20 bg-emerald-950/20'
              : 'border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-emerald-400 uppercase">ONLINE</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400">{stats.onlineCount}</div>
          <p className="text-[10px] text-gray-500 mt-0.5">Heartbeat aktif (≤ 30s)</p>
        </div>

        {/* OFFLINE */}
        <div
          onClick={() => setFilterStatus('OFFLINE')}
          className={`p-4 rounded-2xl bg-[#111622] border transition-all cursor-pointer ${
            filterStatus === 'OFFLINE'
              ? 'border-rose-500 shadow-lg shadow-rose-500/20 bg-rose-950/20'
              : 'border-gray-800 hover:border-gray-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold text-rose-400 uppercase">OFFLINE</span>
            <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-400">{stats.offlineCount}</div>
          <p className="text-[10px] text-gray-500 mt-0.5">Heartbeat kedaluwarsa (&gt; 30s)</p>
        </div>
      </div>

      {/* TABLE / QUEUE CONTAINER */}
      <div className="rounded-2xl bg-[#111622] border border-gray-800 overflow-hidden shadow-xl">
        {/* Table Toolbar */}
        <div className="p-5 border-b border-gray-800/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Daftar Antrean Akun MT5</span>
              <span className="text-xs font-normal text-gray-400">({filteredAccounts.length} akun ditampilkan)</span>
            </h3>
            <p className="text-xs text-gray-400">
              Pilih akun untuk melihat detail login broker dan panduan provisioning.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari akun / user / broker / server..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-gray-900 border border-gray-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E5B842] w-48 sm:w-60"
              />
            </div>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#E5B842]"
            >
              <option value="ALL">Semua Status</option>
              <option value="WAITING FOR MT5">WAITING FOR MT5</option>
              <option value="PROCESSING">PROCESSING</option>
              <option value="ONLINE">ONLINE</option>
              <option value="OFFLINE">OFFLINE</option>
            </select>

            {/* Broker Filter */}
            <select
              value={filterBroker}
              onChange={(e) => setFilterBroker(e.target.value)}
              className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#E5B842]"
            >
              <option value="ALL">Semua Broker</option>
              {uniqueBrokers.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            {/* Refresh */}
            <button
              onClick={() => fetchAccounts(true)}
              className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#E5B842]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900/60 border-b border-gray-800 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Pengguna / Member</th>
                <th className="py-3.5 px-4">Broker & Server</th>
                <th className="py-3.5 px-4">No. Akun MT5</th>
                <th className="py-3.5 px-4">Worker ID & Heartbeat</th>
                <th className="py-3.5 px-4">Status Provisioning</th>
                <th className="py-3.5 px-4">Eksekusi</th>
                <th className="py-3.5 px-4">Balance / Equity</th>
                <th className="py-3.5 px-4">Tgl Registrasi</th>
                <th className="py-3.5 px-4 text-right">Aksi Operator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-[#E5B842] border-t-transparent rounded-full animate-spin" />
                      <span>Memuat antrean provisioning akun MT5...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Terminal className="w-8 h-8 text-gray-600" />
                      <p>Tidak ada akun MT5 yang cocok dengan kriteria filter.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((acc) => {
                  const isOnline = acc.status === 'ONLINE';
                  const isWaiting = acc.status === 'WAITING FOR MT5';
                  const isProcessing = acc.status === 'PROCESSING';

                  return (
                    <tr
                      key={acc.id}
                      className={`hover:bg-gray-900/40 transition-colors ${
                        isWaiting ? 'bg-blue-950/5' : isProcessing ? 'bg-purple-950/5' : ''
                      }`}
                    >
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <User className="w-3 h-3 text-[#E5B842]" />
                          <span>{acc.userName}</span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono flex items-center gap-1 mt-0.5">
                          <Mail className="w-2.5 h-2.5 text-gray-500" />
                          <span>{acc.userEmail}</span>
                        </div>
                        <div className="text-[9px] text-gray-500 mt-0.5">{acc.userAccountType}</div>
                      </td>

                      {/* Broker & Server */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-amber-300 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-amber-400" />
                          <span>{acc.broker}</span>
                        </div>
                        <div className="text-[10px] text-cyan-400 font-mono mt-0.5">
                          {acc.brokerServer}
                        </div>
                      </td>

                      {/* Account Number */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-white font-extrabold text-sm">{acc.accountNumber}</span>
                          <button
                            onClick={() => handleCopy(acc.accountNumber, `acc-${acc.accountNumber}`)}
                            className="p-1 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                            title="Salin No. Akun"
                          >
                            {copiedField === `acc-${acc.accountNumber}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <span className="text-[10px] text-gray-500">{acc.accountType} • {acc.currency}</span>
                      </td>

                      {/* Worker ID & Heartbeat */}
                      <td className="py-3.5 px-4 font-mono">
                        {acc.workerId ? (
                          <>
                            <div className="text-[#E5B842] font-bold text-xs flex items-center gap-1">
                              <Cpu className="w-3 h-3" />
                              <span>{acc.workerId}</span>
                            </div>
                            <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {acc.lastHeartbeatAgeSeconds !== null ? (
                                <span className={acc.lastHeartbeatAgeSeconds <= 30 ? 'text-emerald-400' : 'text-rose-400'}>
                                  {acc.lastHeartbeatAgeSeconds}s lalu
                                </span>
                              ) : (
                                <span>-</span>
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-500 text-[10px] italic">Belum terpasang EA</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isOnline && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            ONLINE
                          </span>
                        )}
                        {isWaiting && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black bg-blue-500/15 text-blue-400 border border-blue-500/30 animate-pulse">
                            <Clock className="w-3 h-3" />
                            WAITING FOR MT5
                          </span>
                        )}
                        {isProcessing && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black bg-purple-500/15 text-purple-400 border border-purple-500/30">
                            <Activity className="w-3 h-3 animate-spin" />
                            PROCESSING
                          </span>
                        )}
                        {acc.status === 'OFFLINE' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <AlertTriangle className="w-3 h-3" />
                            OFFLINE
                          </span>
                        )}
                      </td>

                      {/* Execution Switch */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            acc.executionEnabled
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-gray-800 text-gray-400 border border-gray-700'
                          }`}
                        >
                          <Shield className="w-2.5 h-2.5" />
                          {acc.executionEnabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </td>

                      {/* Balance & Equity */}
                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-extrabold text-emerald-400">
                          ${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">
                          Eq: ${acc.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                      </td>

                      {/* Registered Date */}
                      <td className="py-3.5 px-4 text-[11px] text-gray-400">
                        {new Date(acc.createdAt).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                        <div className="text-[9px] text-gray-500 font-mono">
                          {new Date(acc.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View Details Button */}
                          <button
                            onClick={() => setSelectedAccount(acc)}
                            className="px-2.5 py-1 rounded-lg bg-[#E5B842]/10 hover:bg-[#E5B842]/20 border border-[#E5B842]/30 text-[#E5B842] text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Buka detail provisioning"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Detail</span>
                          </button>

                          {/* Toggle Processing Button */}
                          {!isOnline && (
                            <button
                              onClick={() => handleToggleProcessing(acc.accountNumber, acc.status)}
                              disabled={isUpdatingProcessing === acc.accountNumber}
                              className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                                isProcessing
                                  ? 'bg-gray-800 border-gray-700 text-gray-300 hover:text-white'
                                  : 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30 text-purple-400'
                              }`}
                              title={isProcessing ? 'Batalkan status processing' : 'Tandai sedang diproses di MT5 pusat'}
                            >
                              {isProcessing ? 'Set Pending' : 'Set Processing'}
                            </button>
                          )}

                          {/* Delete / Disconnect Account */}
                          <button
                            onClick={() => handleDeleteAccount(acc.accountNumber, acc.broker)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer"
                            title="Hapus akun dari sistem"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: DETAIL & PROVISIONING STEP-BY-STEP GUIDE */}
      {selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-mono">
          <div className="bg-[#0F1115] border border-gray-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-[#141822] px-6 py-4 border-b border-gray-800 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#E5B842]/15 border border-[#E5B842]/30 flex items-center justify-center text-[#E5B842]">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white tracking-wide uppercase">
                    MT5 PROVISIONING DETAILS
                  </h2>
                  <p className="text-[11px] text-gray-400 font-sans">
                    Panduan Operator MT5 Pusat & Metadata Akun
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAccount(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Status Header Tile */}
              <div className="p-4 bg-[#141822] border border-gray-800 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase block font-sans">Status Operasional</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`text-sm font-black uppercase ${
                        selectedAccount.status === 'ONLINE'
                          ? 'text-emerald-400'
                          : selectedAccount.status === 'WAITING FOR MT5'
                          ? 'text-blue-400'
                          : selectedAccount.status === 'PROCESSING'
                          ? 'text-purple-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {selectedAccount.status}
                    </span>
                    {selectedAccount.status === 'ONLINE' && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-gray-500 uppercase block font-sans">Detak Terakhir</span>
                  <span className="text-gray-300 font-mono">
                    {selectedAccount.lastHeartbeatAgeSeconds !== null
                      ? `${selectedAccount.lastHeartbeatAgeSeconds} detik lalu`
                      : 'Belum pernah detak'}
                  </span>
                </div>
              </div>

              {/* Quick Copy Credentials for Operator */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-gray-300 uppercase flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#E5B842]" />
                    Kredensial Login MT5 (Salin Cepat)
                  </span>
                  <span className="text-[10px] text-gray-500 font-sans">Klik tombol untuk menyalin</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {/* Account Number */}
                  <div className="p-3 bg-[#0B0E14] border border-gray-800 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-gray-500 block uppercase">No. Akun</span>
                      <span className="text-sm font-extrabold text-white">{selectedAccount.accountNumber}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(selectedAccount.accountNumber, 'modal-acc')}
                      className="p-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 hover:text-white transition-colors"
                      title="Salin No. Akun"
                    >
                      {copiedField === 'modal-acc' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Broker Server */}
                  <div className="p-3 bg-[#0B0E14] border border-gray-800 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-gray-500 block uppercase">Broker Server</span>
                      <span className="text-xs font-extrabold text-cyan-400 truncate max-w-[130px] block">
                        {selectedAccount.brokerServer}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopy(selectedAccount.brokerServer, 'modal-srv')}
                      className="p-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 hover:text-white transition-colors"
                      title="Salin Broker Server"
                    >
                      {copiedField === 'modal-srv' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Broker Name */}
                  <div className="p-3 bg-[#0B0E14] border border-gray-800 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="text-[9px] text-gray-500 block uppercase">Nama Broker</span>
                      <span className="text-xs font-extrabold text-amber-400">{selectedAccount.broker}</span>
                    </div>
                    <button
                      onClick={() => handleCopy(selectedAccount.broker, 'modal-brk')}
                      className="p-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 hover:text-white transition-colors"
                      title="Salin Broker"
                    >
                      {copiedField === 'modal-brk' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* MT5 Trading Password (AES-256-GCM Secure Decryption Card) */}
                <div className="p-3.5 bg-[#0B0E14] border border-amber-500/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-[#E5B842]" />
                      <span className="text-[10px] font-bold text-[#E5B842] uppercase tracking-wide">
                        MT5 TRADING PASSWORD (AES-256-GCM)
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-xs">
                      {revealedPasswords[selectedAccount.accountNumber] ? (
                        <span className="text-white font-black bg-[#141822] px-2.5 py-1 rounded border border-gray-700 select-all">
                          {revealedPasswords[selectedAccount.accountNumber]}
                        </span>
                      ) : (
                        <span className="text-gray-500 tracking-widest">••••••••••••••••</span>
                      )}
                    </div>
                    {revealError[selectedAccount.accountNumber] && (
                      <p className="text-[10px] text-rose-400 mt-1 font-sans">
                        {revealError[selectedAccount.accountNumber]}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {revealedPasswords[selectedAccount.accountNumber] ? (
                      <>
                        <button
                          onClick={() =>
                            handleCopy(revealedPasswords[selectedAccount.accountNumber], 'modal-pwd')
                          }
                          className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          {copiedField === 'modal-pwd' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Tersalin!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Salin Password</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleHidePassword(selectedAccount.accountNumber)}
                          className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white transition-colors"
                          title="Sembunyikan Password"
                        >
                          <EyeOff className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleRevealPassword(selectedAccount.accountNumber)}
                        disabled={loadingReveal[selectedAccount.accountNumber]}
                        className="px-3.5 py-2 rounded-xl bg-[#E5B842] hover:bg-[#d4a737] active:scale-[0.99] text-black font-extrabold text-[11px] uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-[#E5B842]/20 disabled:opacity-50"
                      >
                        {loadingReveal[selectedAccount.accountNumber] ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                            <span>DECRYPTING...</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3.5 h-3.5 text-black" />
                            <span>REVEAL TRADING PASSWORD</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Step by Step Operator Instructions */}
              <div className="p-4 bg-[#141822] border border-gray-800 rounded-xl space-y-3 font-sans">
                <h4 className="text-xs font-bold text-white uppercase flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-[#E5B842]" />
                  Langkah-Langkah Provisioning Operator (Laptop Pusat)
                </h4>
                <ol className="space-y-2 text-xs text-gray-300 list-decimal list-inside leading-relaxed">
                  <li>
                    Buka instance <strong className="text-white">MetaTrader 5</strong> di laptop pusat SPILLA.
                  </li>
                  <li>
                    Pilih menu <strong className="text-white">File → Login to Trade Account</strong>.
                  </li>
                  <li>
                    Masukkan <strong className="text-amber-400">Login: {selectedAccount.accountNumber}</strong>,{' '}
                    <strong className="text-[#E5B842]">Password: [Klik tombol REVEAL di atas]</strong>, dan{' '}
                    <strong className="text-cyan-400">Server: {selectedAccount.brokerServer}</strong>.
                  </li>
                  <li>
                    Buka chart <strong className="text-white">{selectedAccount.symbol || 'XAUUSD'}</strong> (M15 / H1).
                  </li>
                  <li>
                    Attach Expert Advisor <strong className="text-[#E5B842]">SPILLA_Executor_v230.mq5</strong>.
                  </li>
                  <li>
                    Pastikan tombol <strong className="text-emerald-400">Algo Trading</strong> di MT5 aktif.
                  </li>
                  <li>
                    EA akan otomatis mengirim heartbeat dengan Worker ID, dan status akun di halaman ini otomatis berubah menjadi{' '}
                    <strong className="text-emerald-400">ONLINE</strong>!
                  </li>
                </ol>
              </div>

              {/* Member Profile */}
              <div className="p-4 bg-[#0B0E14] border border-gray-800 rounded-xl space-y-2 text-xs font-sans">
                <span className="text-[10px] text-gray-500 uppercase block font-bold">Informasi Member</span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Nama Lengkap:</span>
                    <span className="text-white font-bold">{selectedAccount.userName}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Email Akun:</span>
                    <span className="text-white font-mono">{selectedAccount.userEmail}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Tipe Akun SPILLA:</span>
                    <span className="text-gray-300">{selectedAccount.userAccountType}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Tgl Mendaftar:</span>
                    <span className="text-gray-300 font-mono">
                      {new Date(selectedAccount.createdAt).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-[#141822] px-6 py-4 border-t border-gray-800 flex items-center justify-between shrink-0">
              <button
                onClick={() => handleToggleProcessing(selectedAccount.accountNumber, selectedAccount.status)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedAccount.status === 'PROCESSING'
                    ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30'
                }`}
              >
                {selectedAccount.status === 'PROCESSING' ? 'Batalkan Processing' : 'Tandai Sedang Diproses'}
              </button>

              <button
                onClick={() => setSelectedAccount(null)}
                className="px-5 py-2 rounded-xl bg-[#E5B842] hover:bg-[#d4a737] text-black font-extrabold text-xs transition-all cursor-pointer"
              >
                Selesai / Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
