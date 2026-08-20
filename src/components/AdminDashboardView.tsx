import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  UserCheck,
  Clock,
  ShieldAlert,
  Search,
  RefreshCw,
  Trash2,
  UserPlus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Ban,
  UserCheck2,
  Crown,
  Lock,
  LogOut,
  Sparkles,
  Download,
  FileSpreadsheet,
  Layers,
  Coins,
} from 'lucide-react';
import { AuthUser, AdminStats, UserRole, UserStatus, TraderLoginRecord } from '../types';
import { AdminCreditManagementView } from './AdminCreditManagementView';

interface AdminDashboardViewProps {
  currentUser: AuthUser;
  authToken: string;
  onNavigateToEngine: () => void;
  onLogout: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  currentUser,
  authToken,
  onNavigateToEngine,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'TRADER_LOGINS' | 'AI_CREDITS'>('USERS');
  const [pendingTopUpCount, setPendingTopUpCount] = useState<number>(0);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    activeUsers: 0,
    pendingUsers: 0,
    adminCount: 0,
  });
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [traderLogins, setTraderLogins] = useState<TraderLoginRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterRole, setFilterRole] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Trader Logins Filter State
  const [traderSearchQuery, setTraderSearchQuery] = useState<string>('');
  const [traderFilterMaster, setTraderFilterMaster] = useState<string>('ALL');

  // Fetch Stats & Users list from Prisma backend
  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${authToken}` };

      // Fetch Stats
      const statsRes = await fetch('/api/admin/stats', { headers });
      const statsData = await statsRes.json();
      if (statsData.success && statsData.stats) {
        setStats(statsData.stats);
      }

      // Fetch Users
      const usersRes = await fetch('/api/admin/users', { headers });
      const usersData = await usersRes.json();
      if (usersData.success && usersData.users) {
        setUsers(usersData.users);
      }

      // Fetch Trader Logins
      const traderRes = await fetch('/api/admin/trader-logins', { headers });
      const traderData = await traderRes.json();
      if (traderData.success && traderData.traderLogins) {
        setTraderLogins(traderData.traderLogins);
      }

      // Fetch Credit Stats for Pending Badges
      const creditStatsRes = await fetch('/api/admin/credit/stats', { headers });
      const creditStatsData = await creditStatsRes.json();
      if (creditStatsData.success && creditStatsData.stats) {
        setPendingTopUpCount(creditStatsData.stats.pendingTopUpCount || 0);
      }
    } catch (err) {
      console.error('[Admin Dashboard Fetch Error]', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, [authToken]);

  // Handle Role Change
  const handleChangeRole = async (userId: string, currentRole: UserRole) => {
    const newRole: UserRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(data.message);
        fetchAdminData();
      } else {
        alert(data.message || 'Gagal mengubah role.');
      }
    } catch (err) {
      alert('Terjadi kesalahan saat mengubah role.');
    }
  };

  // Handle Status Change
  const handleChangeStatus = async (userId: string, newStatus: UserStatus) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(data.message);
        fetchAdminData();
      } else {
        alert(data.message || 'Gagal mengubah status.');
      }
    } catch (err) {
      alert('Terjadi kesalahan saat mengubah status.');
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus pengguna ${userEmail}? Tindakan ini permanen di Prisma DB.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(data.message);
        fetchAdminData();
      } else {
        alert(data.message || 'Gagal menghapus pengguna.');
      }
    } catch (err) {
      alert('Terjadi kesalahan saat menghapus pengguna.');
    }
  };

  // Filter Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = filterRole === 'ALL' || u.role === filterRole;
    const matchesStatus = filterStatus === 'ALL' || u.status === filterStatus;

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Filter Trader Logins
  const filteredTraderLogins = traderLogins.filter((t) => {
    const matchesSearch =
      t.identifier.toLowerCase().includes(traderSearchQuery.toLowerCase()) ||
      (t.accountNumber && t.accountNumber.toLowerCase().includes(traderSearchQuery.toLowerCase())) ||
      t.selectedMaster.toLowerCase().includes(traderSearchQuery.toLowerCase());
    const matchesMaster =
      traderFilterMaster === 'ALL' || t.selectedMaster === traderFilterMaster;
    return matchesSearch && matchesMaster;
  });

  // Export Trader Logins to Excel / CSV
  const handleExportExcel = () => {
    if (filteredTraderLogins.length === 0) {
      alert('Tidak ada data login trader untuk diexport.');
      return;
    }

    // CSV Header with BOM for proper Excel UTF-8 encoding
    let csv = '\uFEFF';
    csv += 'No,Username / Nama,Nomor Akun Trader,Server Broker,Tanggal Login,Jam Login,Status Login,Master Dipilih\n';

    filteredTraderLogins.forEach((item, index) => {
      const row = [
        index + 1,
        `"${item.identifier}"`,
        `"${item.accountNumber || '-'}"`,
        `"${item.brokerServer || 'AIMS-Live'}"`,
        `"${item.loginDate}"`,
        `"${item.loginTime}"`,
        `"${item.status}"`,
        `"${item.selectedMaster}"`,
      ].join(',');
      csv += row + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `SPILLA_GOLD_Trader_Logins_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-gray-100 p-4 sm:p-6 lg:p-8 font-sans selection:bg-[#E5B842]/30 selection:text-[#E5B842]">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl bg-[#111622] border border-gray-800 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-[#E5B842] p-0.5 shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-[#0B0E14] rounded-[10px] flex items-center justify-center">
                <Crown className="w-6 h-6 text-[#E5B842]" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white tracking-wide">SPILLA GOLD Admin Management</h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  Prisma DB Active
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Panel Kontrol Pengguna, Role Permissions, & User Status Dashboard.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Shortcut Button to Engine */}
            <button
              onClick={onNavigateToEngine}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#E5B842] to-[#F0B90B] text-black hover:opacity-95 transition-all shadow-md shadow-[#E5B842]/20 flex items-center gap-2"
            >
              <span>Lanjut ke SPILLA Analysis Engine</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="p-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-400 hover:text-white transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Alert Banner */}
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

        {/* 1. STATISTIK PENGGUNA (4 Stat Cards) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-[#111622] border border-gray-800 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-400">Total Pengguna</span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white">{stats.totalUsers}</div>
            <p className="text-[10px] text-gray-500 mt-1">Terdaftar di Prisma Database</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#111622] border border-gray-800 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-400">Active Users</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <UserCheck2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-400">{stats.activeUsers}</div>
            <p className="text-[10px] text-gray-500 mt-1">Status AKTIFF & Berizin</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#111622] border border-gray-800 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-400">Pending Approval</span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-400">{stats.pendingUsers}</div>
            <p className="text-[10px] text-gray-500 mt-1">Menunggu persetujuan Admin</p>
          </div>

          <div className="p-5 rounded-2xl bg-[#111622] border border-gray-800 relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-400">Jumlah Admin</span>
              <div className="p-2 rounded-lg bg-[#E5B842]/10 text-[#E5B842]">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-[#E5B842]">{stats.adminCount}</div>
            <p className="text-[10px] text-gray-500 mt-1">Akses Penuh Manajemen System</p>
          </div>
        </div>

        {/* 2. NAVIGATION TABS */}
        <div className="flex border-b border-gray-800 gap-2 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('USERS')}
            className={`px-5 py-3 text-xs font-black rounded-t-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'USERS'
                ? 'bg-[#111622] text-[#E5B842] border-t-2 border-x border-[#E5B842]'
                : 'text-gray-400 hover:text-white bg-gray-900/50 border border-transparent'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>USER MANAGEMENT</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-800 text-gray-300">
              {users.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TRADER_LOGINS')}
            className={`px-5 py-3 text-xs font-black rounded-t-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'TRADER_LOGINS'
                ? 'bg-[#111622] text-[#E5B842] border-t-2 border-x border-[#E5B842]'
                : 'text-gray-400 hover:text-white bg-gray-900/50 border border-transparent'
            }`}
          >
            <Layers className="w-4 h-4 text-[#E5B842]" />
            <span>LOGIN AKUN TRADER</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
              {traderLogins.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('AI_CREDITS')}
            className={`px-5 py-3 text-xs font-black rounded-t-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'AI_CREDITS'
                ? 'bg-[#111622] text-[#E5B842] border-t-2 border-x border-[#E5B842]'
                : 'text-gray-400 hover:text-white bg-gray-900/50 border border-transparent'
            }`}
          >
            <Coins className="w-4 h-4 text-[#E5B842]" />
            <span>AI CREDIT MANAGEMENT</span>
            {pendingTopUpCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-600 text-white font-extrabold animate-pulse">
                {pendingTopUpCount} Pending
              </span>
            )}
          </button>
        </div>

        {/* 3. TAB 1: TABEL USER MANAGEMENT */}
        {activeTab === 'USERS' && (
          <div className="rounded-b-2xl rounded-tr-2xl bg-[#111622] border border-gray-800 overflow-hidden shadow-xl">
            {/* Table Toolbar / Controls */}
          <div className="p-5 border-b border-gray-800/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                User Management Table
                <span className="text-xs font-normal text-gray-400">({filteredUsers.length} pengguna)</span>
              </h3>
              <p className="text-xs text-gray-400">Kelola role, status akses, dan penghapusan pengguna.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama / email / ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-gray-900 border border-gray-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E5B842] w-48 sm:w-60"
                />
              </div>

              {/* Role Filter */}
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#E5B842]"
              >
                <option value="ALL">Semua Role</option>
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#E5B842]"
              >
                <option value="ALL">Semua Status</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PENDING">PENDING</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>

              {/* Refresh Button */}
              <button
                onClick={fetchAdminData}
                className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white transition-colors"
                title="Refresh Table"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#E5B842]' : ''}`} />
              </button>
            </div>
          </div>

          {/* User Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-900/60 border-b border-gray-800 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4">User ID & Nama</th>
                  <th className="py-3.5 px-4">Alamat Email</th>
                  <th className="py-3.5 px-4">Tipe Akun</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Tanggal Daftar</th>
                  <th className="py-3.5 px-4 text-right">Aksi Admin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-xs">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-6 h-6 border-2 border-[#E5B842] border-t-transparent rounded-full animate-spin" />
                        <span>Memuat data pengguna dari Prisma DB...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      Tidak ada data pengguna yang cocok dengan kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const isSelf = user.id === currentUser.id;
                    return (
                      <tr key={user.id} className="hover:bg-gray-900/40 transition-colors">
                        {/* ID & Name */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            {user.fullName}
                            {isSelf && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                Anda
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono">{user.id.slice(0, 8)}...</div>
                        </td>

                        {/* Email */}
                        <td className="py-3.5 px-4 text-gray-300 font-medium">{user.email}</td>

                        {/* Account Type */}
                        <td className="py-3.5 px-4 text-gray-400">{user.accountType || 'Trader Individu'}</td>

                        {/* Role Badge */}
                        <td className="py-3.5 px-4">
                          {user.role === 'ADMIN' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              <ShieldCheck className="w-3 h-3" /> ADMIN
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-medium bg-gray-800 text-gray-300 border border-gray-700">
                              <Users className="w-3 h-3" /> USER
                            </span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3.5 px-4">
                          {user.status === 'ACTIVE' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3" /> ACTIVE
                            </span>
                          )}
                          {user.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                              <Clock className="w-3 h-3" /> PENDING
                            </span>
                          )}
                          {user.status === 'SUSPENDED' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
                              <Ban className="w-3 h-3" /> SUSPENDED
                            </span>
                          )}
                        </td>

                        {/* Date Registered */}
                        <td className="py-3.5 px-4 text-gray-400 text-[11px]">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }) : '-'}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Toggle Role Button */}
                            <button
                              onClick={() => handleChangeRole(user.id, user.role)}
                              disabled={isSelf}
                              className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-[10px] font-semibold text-gray-300 hover:text-white transition-colors disabled:opacity-40"
                              title="Ubah Role"
                            >
                              {user.role === 'ADMIN' ? 'Set USER' : 'Set ADMIN'}
                            </button>

                            {/* Toggle Status Buttons */}
                            {user.status === 'ACTIVE' ? (
                              <button
                                onClick={() => handleChangeStatus(user.id, 'SUSPENDED')}
                                disabled={isSelf}
                                className="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-[10px] font-semibold text-red-400 transition-colors disabled:opacity-40"
                                title="Banned/Suspend"
                              >
                                Ban
                              </button>
                            ) : (
                              <button
                                onClick={() => handleChangeStatus(user.id, 'ACTIVE')}
                                className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-semibold text-emerald-400 transition-colors"
                                title="Aktifkan User"
                              >
                                Aktifkan
                              </button>
                            )}

                            {/* Delete User Button */}
                            <button
                              onClick={() => handleDeleteUser(user.id, user.email)}
                              disabled={isSelf}
                              className="p-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors disabled:opacity-40"
                              title="Hapus Pengguna"
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
        )}

        {/* 4. TAB 2: TABEL LOGIN AKUN TRADER */}
        {activeTab === 'TRADER_LOGINS' && (
          <div className="rounded-b-2xl rounded-tr-2xl bg-[#111622] border border-gray-800 overflow-hidden shadow-xl">
            {/* Toolbar */}
            <div className="p-5 border-b border-gray-800/80 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Aktivitas Login Akun Trader Copy Trade</span>
                  <span className="text-xs font-normal text-gray-400">({filteredTraderLogins.length} entri)</span>
                </h3>
                <p className="text-xs text-gray-400">Log riwayat login akun trader saat memilih paket Copy Trade Master SPILLA GOLD.</p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Cari email / username..."
                    value={traderSearchQuery}
                    onChange={(e) => setTraderSearchQuery(e.target.value)}
                    className="bg-gray-900 border border-gray-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#E5B842] w-48 sm:w-56"
                  />
                </div>

                {/* Master Filter */}
                <select
                  value={traderFilterMaster}
                  onChange={(e) => setTraderFilterMaster(e.target.value)}
                  className="bg-gray-900 border border-gray-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#E5B842]"
                >
                  <option value="ALL">Semua Master</option>
                  <option value="SPILLA INFINITY">SPILLA INFINITY</option>
                  <option value="SPILLA SCOUT">SPILLA SCOUT</option>
                  <option value="SPILLA ELITE">SPILLA ELITE</option>
                  <option value="SPILLA HUNTER">SPILLA HUNTER</option>
                  <option value="SPILLA STRIKER">SPILLA STRIKER</option>
                </select>

                {/* Refresh */}
                <button
                  onClick={fetchAdminData}
                  className="p-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-gray-300 hover:text-white transition-colors cursor-pointer"
                  title="Refresh Table"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#E5B842]' : ''}`} />
                </button>

                {/* EXPORT EXCEL Button */}
                <button
                  onClick={handleExportExcel}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-900/30 flex items-center gap-2 cursor-pointer uppercase tracking-wider"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>EXPORT EXCEL</span>
                </button>
              </div>
            </div>

            {/* Trader Logins Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-900/60 border-b border-gray-800 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-12">No</th>
                    <th className="py-3.5 px-4">Username / Nama</th>
                    <th className="py-3.5 px-4">No. Akun Trader</th>
                    <th className="py-3.5 px-4">Server Broker</th>
                    <th className="py-3.5 px-4">Tanggal Login</th>
                    <th className="py-3.5 px-4">Jam Login</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Master yang Dipilih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60 text-xs">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <div className="w-6 h-6 border-2 border-[#E5B842] border-t-transparent rounded-full animate-spin text-[#E5B842]" />
                          <span>Memuat aktivitas login trader...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredTraderLogins.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-gray-500">
                        Belum ada data login akun trader.
                      </td>
                    </tr>
                  ) : (
                    filteredTraderLogins.map((item, index) => (
                      <tr key={item.id} className="hover:bg-gray-900/40 transition-colors">
                        <td className="py-3.5 px-4 text-gray-400 font-mono font-bold">
                          {index + 1}
                        </td>
                        <td className="py-3.5 px-4 text-white font-medium font-mono">
                          {item.identifier}
                        </td>
                        <td className="py-3.5 px-4 text-amber-300 font-bold font-mono">
                          {item.accountNumber || '-'}
                        </td>
                        <td className="py-3.5 px-4 text-cyan-400 font-mono">
                          {item.brokerServer || 'AIMS-Live'}
                        </td>
                        <td className="py-3.5 px-4 text-gray-300 font-mono">
                          {item.loginDate}
                        </td>
                        <td className="py-3.5 px-4 text-gray-300 font-mono">
                          {item.loginTime}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3 h-3" /> {item.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-extrabold bg-[#E5B842]/10 text-[#E5B842] border border-[#E5B842]/30">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#E5B842]" />
                            {item.selectedMaster}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 5. TAB 3: AI CREDIT MANAGEMENT */}
        {activeTab === 'AI_CREDITS' && (
          <div className="rounded-b-2xl rounded-tr-2xl bg-[#111622] border border-gray-800 p-6 shadow-xl">
            <AdminCreditManagementView authToken={authToken} />
          </div>
        )}
      </div>
    </div>
  );
};
