import React, { useState } from 'react';
import spillaLogo from '../assets/images/spilla_gold_logo_1786418245382.jpg';
import {
  Globe,
  LineChart,
  Gauge,
  SmilePlus,
  CalendarDays,
  Newspaper,
  Bot,
  History,
  Sliders,
  Users,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Coins,
} from 'lucide-react';

export type ViewTab =
  | 'market_overview'
  | 'live_analysis'
  | 'fundamental'
  | 'technical'
  | 'sentiment'
  | 'calendar'
  | 'news'
  | 'ai_recommendation'
  | 'follow_master_ai'
  | 'history'
  | 'credit_wallet'
  | 'engine_settings';

interface NavigationProps {
  activeTab: ViewTab;
  onTabChange: (tab: ViewTab) => void;
  recommendationSignal?: string;
  isAdmin?: boolean;
  onNavigateToAdmin?: () => void;
  creditBalance?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  recommendationSignal,
  isAdmin,
  onNavigateToAdmin,
  creditBalance,
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const dashboardItems: {
    id: ViewTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: string;
  }[] = [
    { id: 'market_overview', label: 'Market Overview', icon: Globe },
  ];

  const terminalItems: {
    id: ViewTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: string;
  }[] = [
    { id: 'live_analysis', label: 'Live AI Analysis (MT5)', icon: LineChart, badge: 'MT5 CONNECTED' },
    { id: 'follow_master_ai', label: 'Follow Master AI', icon: Users, badge: 'COPY TRADE' },
    { id: 'fundamental', label: 'Fundamental Analysis', icon: Globe },
    { id: 'technical', label: 'Technical Analysis', icon: Gauge },
    { id: 'sentiment', label: 'Market Sentiment', icon: SmilePlus },
    { id: 'calendar', label: 'Economic Calendar', icon: CalendarDays },
    { id: 'news', label: 'Market News', icon: Newspaper },
    {
      id: 'ai_recommendation',
      label: 'AI Recommendation',
      icon: Bot,
      badge: recommendationSignal || 'STRONG BUY',
    },
    { id: 'history', label: 'Analysis History', icon: History },
    {
      id: 'credit_wallet',
      label: 'SPILLA AI Credit',
      icon: Coins,
      badge: creditBalance !== undefined ? `${creditBalance.toLocaleString('id-ID')} Cr` : 'TOP UP',
    },
    { id: 'engine_settings', label: 'Engine Settings', icon: Sliders },
  ];

  const renderNavButton = (item: {
    id: ViewTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: string;
  }) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onTabChange(item.id)}
        title={isCollapsed ? item.label : undefined}
        className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
          isActive
            ? 'bg-[#E5B842]/10 text-[#E5B842] border border-[#E5B842]/30 shadow-md'
            : 'text-gray-400 hover:text-white hover:bg-[#121620]'
        }`}
      >
        <div className="flex items-center space-x-2.5 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#E5B842]' : 'text-gray-400'}`} />
          {!isCollapsed && <span className="truncate">{item.label}</span>}
        </div>

        {!isCollapsed && item.badge && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 ml-1">
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <aside
      className={`bg-[#0F1115] border-r border-gray-800/90 p-2.5 shrink-0 transition-all duration-300 font-mono flex flex-col justify-between ${
        isCollapsed ? 'w-16' : 'w-full md:w-64'
      }`}
    >
      <div className="space-y-3">
        {/* Header & Collapse Toggle */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-gray-800/80">
          {!isCollapsed && (
            <span className="text-[10px] tracking-wider text-gray-400 uppercase font-bold">
              NAVIGATION
            </span>
          )}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded bg-[#121620] hover:bg-gray-800 text-gray-400 hover:text-white cursor-pointer transition-colors ml-auto"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Section 1: DASHBOARD / OVERVIEW */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-2 pt-1 pb-0.5 text-[9px] font-black text-gray-500 uppercase tracking-widest">
              DASHBOARD / OVERVIEW
            </div>
          )}
          {dashboardItems.map(renderNavButton)}
        </div>

        {/* Section 2: TERMINAL MODULES */}
        <div className="space-y-1">
          {!isCollapsed && (
            <div className="px-2 pt-2 pb-0.5 text-[9px] font-black text-[#E5B842] uppercase tracking-widest">
              TERMINAL MODULES
            </div>
          )}
          {terminalItems.map(renderNavButton)}
        </div>

        {/* Section 3: SYSTEM & MANAGEMENT */}
        {isAdmin && onNavigateToAdmin && (
          <div className="space-y-1 pt-1">
            {!isCollapsed && (
              <div className="px-2 pt-1 pb-0.5 text-[9px] font-black text-amber-500 uppercase tracking-widest">
                SYSTEM & MANAGEMENT
              </div>
            )}
            <button
              onClick={onNavigateToAdmin}
              title={isCollapsed ? 'Admin Control Panel' : undefined}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer"
            >
              <div className="flex items-center space-x-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                {!isCollapsed && <span>Admin Control Panel</span>}
              </div>
              {!isCollapsed && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  ADMIN
                </span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Institutional Footer Info */}
      {!isCollapsed && (
        <div className="mt-4 p-2.5 rounded-lg bg-[#121620] border border-gray-800 text-[10px] flex items-center gap-2.5">
          <img
            src={spillaLogo}
            alt="SPILLA GOLD Logo"
            className="w-7 h-7 rounded object-cover border border-[#E5B842]/40 shrink-0"
            referrerPolicy="no-referrer"
          />
          <div>
            <div className="font-bold text-gray-200 leading-tight flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>SPILLA GOLD CORE</span>
            </div>
            <p className="text-gray-400 text-[9px] leading-snug">
              Institutional Analysis Engine • Gemini 3.6
            </p>
          </div>
        </div>
      )}
    </aside>
  );
};
