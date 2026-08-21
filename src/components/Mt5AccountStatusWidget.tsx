import React, { useState, useEffect } from 'react';
import {
  Link2,
  Server,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Unlink,
  DollarSign,
  Shield,
  Activity,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { ConnectTradingAccountModal } from './ConnectTradingAccountModal';

export interface TradingAccountData {
  id: string;
  userId?: string | null;
  accountNumber: string;
  broker?: string;
  brokerServer: string;
  accountType?: string;
  currency?: string;
  workerId?: string | null;
  symbol?: string | null;
  executionEnabled: boolean;
  workerOnline: boolean;
  lastHeartbeat?: string | null;
  lastHeartbeatAgeSeconds?: number | null;
  balance?: number;
  equity?: number;
  freeMargin?: number;
  leverage?: number;
  isLive?: boolean;
}

interface Mt5AccountStatusWidgetProps {
  authToken?: string | null;
  onAccountUpdated?: (account: TradingAccountData | null) => void;
  compact?: boolean;
}

export const Mt5AccountStatusWidget: React.FC<Mt5AccountStatusWidgetProps> = ({
  authToken,
  onAccountUpdated,
  compact = false,
}) => {
  const [account, setAccount] = useState<TradingAccountData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDisconnecting, setIsDisconnecting] = useState<boolean>(false);

  const fetchAccountStatus = async () => {
    try {
      const token = authToken || localStorage.getItem('spilla_token');
      const res = await fetch('/api/mt5/accounts', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.accounts) && data.accounts.length > 0) {
        // Take the latest registered account
        const latest = data.accounts[data.accounts.length - 1];
        setAccount(latest);
        if (onAccountUpdated) onAccountUpdated(latest);
      } else {
        setAccount(null);
        if (onAccountUpdated) onAccountUpdated(null);
      }
    } catch (err) {
      console.warn('[Mt5AccountStatusWidget] Fetch accounts error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountStatus();
    // Poll account and worker heartbeat status every 4 seconds
    const interval = setInterval(fetchAccountStatus, 4000);
    return () => clearInterval(interval);
  }, [authToken]);

  const handleDisconnect = async () => {
    if (!account) return;
    if (!window.confirm(`Apakah Anda yakin ingin memutuskan koneksi akun MT5 ${account.accountNumber}?`)) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const token = authToken || localStorage.getItem('spilla_token');
      const res = await fetch(`/api/mt5/accounts/${account.accountNumber}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (data.success) {
        setAccount(null);
        if (onAccountUpdated) onAccountUpdated(null);
      }
    } catch (err) {
      console.error('Failed to disconnect account:', err);
    } finally {
      setIsDisconnecting(false);
    }
  };

  // 1. STATE: NOT CONNECTED
  if (!account && !isLoading) {
    return (
      <>
        <div className="bg-[#121620] border border-gray-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gray-800/80 border border-gray-700 flex items-center justify-center text-gray-400">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold text-white uppercase tracking-wider">MT5 TRADING ACCOUNT</span>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-gray-800 text-gray-400 border border-gray-700">
                  NOT CONNECTED
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-sans">
                Hubungkan nomor akun MT5 Anda untuk menerima telemetri dan status eksekusi EA.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-[#E5B842] hover:bg-[#d4a737] active:scale-95 text-black font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-[#E5B842]/10"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>CONNECT TRADING ACCOUNT</span>
          </button>
        </div>

        <ConnectTradingAccountModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            fetchAccountStatus();
          }}
          onAccountConnected={(newAcc) => {
            setAccount(newAcc);
            fetchAccountStatus();
          }}
          authToken={authToken}
        />
      </>
    );
  }

  const isOnline = Boolean(account?.workerOnline);
  const hasEverReceivedHeartbeat = Boolean(account?.lastHeartbeat);

  // Status computation:
  // - CONNECTED / ONLINE: workerOnline is true
  // - WAITING FOR MT5: never received heartbeat yet
  // - OFFLINE: received heartbeat before, but stale > 30s
  const connectionState = isOnline
    ? 'CONNECTED'
    : hasEverReceivedHeartbeat
    ? 'OFFLINE'
    : 'WAITING FOR MT5';

  return (
    <>
      <div
        className={`rounded-xl border transition-all p-4 shadow-xl ${
          isOnline
            ? 'bg-gradient-to-r from-[#121620] to-[#0d1e18] border-emerald-500/40 shadow-emerald-950/20'
            : hasEverReceivedHeartbeat
            ? 'bg-[#121620] border-amber-500/30'
            : 'bg-[#121620] border-blue-500/30'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800/80 pb-3">
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                isOnline
                  ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 shadow-md shadow-emerald-500/20'
                  : hasEverReceivedHeartbeat
                  ? 'bg-amber-500/20 border border-amber-500/50 text-amber-400'
                  : 'bg-blue-500/20 border border-blue-500/50 text-blue-400'
              }`}
            >
              <Cpu className="w-5 h-5" />
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black text-white tracking-wide uppercase">
                  {isOnline ? 'MT5 CONNECTED' : connectionState === 'WAITING FOR MT5' ? 'WAITING FOR MT5' : 'MT5 OFFLINE'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-1 ${
                    isOnline
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : hasEverReceivedHeartbeat
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-blue-500/20 text-blue-400 border border-blue-500/40 animate-pulse'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isOnline ? 'bg-emerald-400 animate-ping' : hasEverReceivedHeartbeat ? 'bg-amber-400' : 'bg-blue-400'
                    }`}
                  />
                  {isOnline ? 'ONLINE' : hasEverReceivedHeartbeat ? 'OFFLINE' : 'WAITING HEARTBEAT'}
                </span>
              </div>
              <p className="text-[10px] text-gray-400">
                Broker:{' '}
                <strong className="text-white">{account?.broker || 'AIMS'}</strong> • Server:{' '}
                <strong className="text-white">{account?.brokerServer}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchAccountStatus}
              className="p-1.5 rounded-lg bg-[#141822] hover:bg-gray-800 border border-gray-700 text-gray-300 transition-colors"
              title="Refresh Status"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold transition-colors flex items-center gap-1"
              title="Putuskan Akun"
            >
              <Unlink className="w-3 h-3" />
              <span>Disconnect</span>
            </button>
          </div>
        </div>

        {/* Telemetry Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 text-xs">
          <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-gray-800/90">
            <span className="text-[10px] text-gray-500 font-bold block uppercase">Account</span>
            <span className="text-white font-mono font-extrabold text-xs sm:text-sm">
              {account?.accountNumber}
            </span>
          </div>

          <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-gray-800/90">
            <span className="text-[10px] text-gray-500 font-bold block uppercase">Worker ID</span>
            <span className="text-[#E5B842] font-mono font-extrabold text-xs sm:text-sm truncate block">
              {account?.workerId || (connectionState === 'WAITING FOR MT5' ? 'Waiting...' : 'N/A')}
            </span>
          </div>

          <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-gray-800/90">
            <span className="text-[10px] text-gray-500 font-bold block uppercase">Balance / Equity</span>
            <span className="text-emerald-400 font-mono font-extrabold text-xs sm:text-sm">
              ${(account?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="bg-[#0B0E14] p-2.5 rounded-lg border border-gray-800/90">
            <span className="text-[10px] text-gray-500 font-bold block uppercase">Leverage / Symbol</span>
            <span className="text-gray-300 font-mono font-bold text-xs sm:text-sm">
              {account?.leverage ? `1:${account.leverage}` : '1:100'} • {account?.symbol || 'XAUUSD'}
            </span>
          </div>
        </div>

        {/* Notice for WAITING FOR MT5 */}
        {!isOnline && !hasEverReceivedHeartbeat && (
          <div className="mt-3 p-2.5 bg-blue-950/20 border border-blue-500/30 rounded-lg text-[10px] text-blue-300 flex items-start gap-2">
            <Activity className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5 animate-spin" />
            <span>
              Akun <strong className="text-white">{account?.accountNumber}</strong> terdaftar. Pasang EA{' '}
              <strong className="text-white">SPILLA Executor v2.30</strong> pada chart MT5 agar sistem otomatis mendeteksi status online.
            </span>
          </div>
        )}
      </div>

      <ConnectTradingAccountModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          fetchAccountStatus();
        }}
        onAccountConnected={(newAcc) => {
          setAccount(newAcc);
          fetchAccountStatus();
        }}
        authToken={authToken}
      />
    </>
  );
};
