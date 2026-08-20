import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, Bell, Settings, ShieldCheck, User, ShieldAlert, LogOut, Bot, Sparkles, Coins, PlusCircle } from 'lucide-react';
import { MarketPrice, AuthUser } from '../types';
import { normalizeCentPrice, formatSymbolLabel } from '../utils/priceUtils';
import spillaLogo from '../assets/images/spilla_gold_logo_1786418245382.jpg';

interface HeaderProps {
  marketPrice: MarketPrice | null;
  lastUpdated: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  onNavigateTo?: (tab: string) => void;
  currentUser?: AuthUser | null;
  onNavigateToAdmin?: () => void;
  onLogout?: () => void;
  onOpenAssistant?: () => void;
  creditBalance?: number;
  onOpenCreditWallet?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  marketPrice,
  lastUpdated,
  onRefresh,
  isRefreshing,
  onNavigateTo,
  currentUser,
  onNavigateToAdmin,
  onLogout,
  onOpenAssistant,
  creditBalance = 0,
  onOpenCreditWallet,
}) => {
  const [utcTime, setUtcTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().replace('GMT', 'UTC').split(' ').slice(4, 5)[0]);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const isPositive = (marketPrice?.change24h || 0) >= 0;
  const session = marketPrice?.session || 'LONDON_NY_OVERLAP';

  return (
    <header className="bg-[#0F1115] border-b border-gray-800/90 px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-50 shadow-md font-mono">
      {/* Brand Logo & Name */}
      <div className="flex items-center space-x-3">
        <img
          src={spillaLogo}
          alt="SPILLA GOLD Logo"
          className="w-9 h-9 rounded-lg object-cover border border-[#E5B842]/40 shadow-md shadow-[#E5B842]/20 shrink-0"
          referrerPolicy="no-referrer"
        />
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-sm lg:text-base font-extrabold tracking-wider text-white uppercase flex items-center gap-1.5">
              <span>SPILLA GOLD</span>
              <span className="text-[#E5B842] text-[10px] font-normal tracking-normal lowercase bg-[#E5B842]/10 px-1.5 py-0.5 rounded border border-[#E5B842]/20">
                Analysis Engine
              </span>
            </h1>
          </div>
          <p className="text-[10px] text-gray-400">Institutional XAUUSD Quantitative Workstation</p>
        </div>
      </div>

      {/* User Profile & Actions */}
      <div className="flex items-center space-x-3">
        {/* Logged in User Profile Info */}
        {currentUser && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#121620] border border-gray-800 text-xs">
            <div className="w-6 h-6 rounded-full bg-[#E5B842]/20 border border-[#E5B842]/40 flex items-center justify-center text-[#E5B842] font-bold">
              {currentUser.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <div className="font-bold text-white leading-tight flex items-center gap-1.5">
                <span>{currentUser.fullName}</span>
                {currentUser.role === 'ADMIN' && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    ADMIN
                  </span>
                )}
              </div>
              <p className="text-[9px] text-gray-400">{currentUser.accountType || 'Trader Individu'}</p>
            </div>

            {/* Admin Panel Button Shortcut */}
            {currentUser.role === 'ADMIN' && onNavigateToAdmin && (
              <button
                onClick={onNavigateToAdmin}
                className="ml-1 px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-[10px] font-bold flex items-center gap-1 transition-colors"
                title="Panel Kontrol Admin"
              >
                <ShieldAlert className="w-3 h-3" />
                <span className="hidden lg:inline">Admin Panel</span>
              </button>
            )}
          </div>
        )}

        {/* SPILLA AI Credit Pill Button */}
        {currentUser && onOpenCreditWallet && (
          <button
            onClick={onOpenCreditWallet}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/15 to-yellow-500/10 border border-[#E5B842]/40 hover:border-[#E5B842] text-xs transition-all shadow-sm cursor-pointer group"
            title="Buka SPILLA AI Credit Wallet & Top Up"
          >
            <div className="flex items-center gap-1.5 font-mono">
              <Coins className="w-3.5 h-3.5 text-[#E5B842]" />
              <span className="font-black text-[#E5B842]">
                {creditBalance.toLocaleString('id-ID')}
              </span>
              <span className="text-[10px] text-gray-400 font-sans hidden md:inline">Credit</span>
            </div>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-[#E5B842] text-black flex items-center gap-0.5 group-hover:bg-amber-400">
              <PlusCircle className="w-2.5 h-2.5" />
              <span>Top Up</span>
            </span>
          </button>
        )}

        <div className="hidden sm:flex flex-col text-right text-[10px] text-gray-400 border-r border-gray-800 pr-3">
          <div className="flex items-center gap-1 font-bold text-white">
            <Clock className="w-3 h-3 text-[#E5B842]" />
            <span>UTC: {utcTime || '12:00:00'}</span>
          </div>
          <span className="text-[9px] text-gray-500">Sync: {new Date(lastUpdated).toLocaleTimeString()}</span>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-[#E5B842] hover:bg-[#c49f27] text-black font-extrabold text-xs transition-colors shadow-md shadow-[#E5B842]/10 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Sync Engine'}</span>
        </button>

        <button
          onClick={() => onNavigateTo && onNavigateTo('engine_settings' as any)}
          className="p-1.5 rounded bg-[#121620] hover:bg-gray-800 text-gray-300 border border-gray-800 cursor-pointer"
          title="Engine Settings"
        >
          <Settings className="w-4 h-4 text-gray-300" />
        </button>

        {/* Logout Button */}
        {onLogout && (
          <button
            onClick={onLogout}
            className="p-1.5 rounded bg-gray-900 hover:bg-red-500/20 text-gray-400 hover:text-red-400 border border-gray-800 transition-colors"
            title="Keluar / Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
