import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Navigation, ViewTab } from './components/Navigation';
import { MarketOverviewView } from './components/MarketOverviewView';
import { LiveAnalysisView } from './components/LiveAnalysisView';
import { DashboardView } from './components/DashboardView';
import { FundamentalView } from './components/FundamentalView';
import { TechnicalView } from './components/TechnicalView';
import { SentimentView } from './components/SentimentView';
import { CalendarView } from './components/CalendarView';
import { NewsView } from './components/NewsView';
import { AiRecommendationView } from './components/AiRecommendationView';
import { FollowMasterAiView } from './components/FollowMasterAiView';
import { HistoryView } from './components/HistoryView';
import { SettingsView } from './components/SettingsView';
import { AuthView } from './components/AuthView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { SpillaAssistantModal } from './components/SpillaAssistantModal';
import { CreditWalletModal } from './components/CreditWalletModal';
import spillaLogo from './assets/images/spilla_gold_logo_1786418245382.jpg';
import { RecommendationResponse, MarketPrice, AuthUser } from './types';
import { Bot, MessageSquare } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState<boolean>(false);
  const [isAdminViewActive, setIsAdminViewActive] = useState<boolean>(false);
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  const [activeTab, setActiveTab] = useState<ViewTab>('market_overview');
  const [recommendationData, setRecommendationData] = useState<RecommendationResponse | null>(null);
  const [marketPrice, setMarketPrice] = useState<MarketPrice | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState<boolean>(false);
  const [creditBalance, setCreditBalance] = useState<number>(25000);
  const [isCreditWalletOpen, setIsCreditWalletOpen] = useState<boolean>(false);

  const fetchUserCreditBalance = async (tokenToUse?: string) => {
    const token = tokenToUse || authToken || localStorage.getItem('spilla_token');
    if (!token) return;
    try {
      const res = await fetch('/api/credit/wallet', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.wallet) {
        setCreditBalance(data.wallet.creditBalance);
      }
    } catch (err) {
      console.error('[App] Error fetching credit wallet:', err);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (currentPath === '/dashboard/follow-master-ai') {
      setActiveTab('follow_master_ai');
    }
  }, [currentPath]);

  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
  };

  // Validate session token on mount
  useEffect(() => {
    const checkSession = async () => {
      const savedToken = localStorage.getItem('spilla_token');
      if (savedToken) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${savedToken}` },
          });
          const data = await res.json();
          if (data.success && data.user) {
            setCurrentUser(data.user);
            setAuthToken(savedToken);
            fetchUserCreditBalance(savedToken);

            // Handle path authorization for logged-in user
            const path = window.location.pathname;
            if (data.user.role === 'ADMIN') {
              if (path === '/admin/login' || path === '/admin' || path === '/admin/dashboard') {
                setIsAdminViewActive(true);
                if (path === '/admin/login') navigateTo('/admin/dashboard');
              }
            } else {
              setIsAdminViewActive(false);
              if (path.startsWith('/admin')) navigateTo('/');
            }
          } else {
            localStorage.removeItem('spilla_token');
            localStorage.removeItem('spilla_user');
          }
        } catch (err) {
          console.error('[Session Verify Error]', err);
        }
      }
      setIsAuthLoaded(true);
    };

    checkSession();
  }, []);

  const handleLoginSuccess = (user: AuthUser, token: string) => {
    setCurrentUser(user);
    setAuthToken(token);
    localStorage.setItem('spilla_token', token);
    localStorage.setItem('spilla_user', JSON.stringify(user));
    fetchUserCreditBalance(token);

    if (user.role === 'ADMIN') {
      setIsAdminViewActive(true);
      navigateTo('/admin/dashboard');
    } else {
      setIsAdminViewActive(false);
      navigateTo('/');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthToken(null);
    setIsAdminViewActive(false);
    localStorage.removeItem('spilla_token');
    localStorage.removeItem('spilla_user');
    navigateTo('/login');
  };

  const fetchFullAnalysis = async () => {
    setIsRefreshing(true);
    try {
      const recRes = await fetch('/api/recommendation?save=true');
      const recJson: RecommendationResponse = await recRes.json();
      setRecommendationData(recJson);

      const mktRes = await fetch('/api/market/current');
      const mktJson: MarketPrice = await mktRes.json();
      setMarketPrice(mktJson);

      setLastUpdated(new Date().toISOString());
    } catch (err) {
      console.error('Error fetching SPILLA GOLD analysis:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchFullAnalysis();
      const timer = setInterval(() => {
        fetch('/api/market/current')
          .then((res) => res.json())
          .then((mkt) => setMarketPrice(mkt))
          .catch(() => {});
      }, 10000);

      return () => clearInterval(timer);
    }
  }, [currentUser]);

  if (!isAuthLoaded) {
    return (
      <div className="min-h-screen bg-[#0B0E14] text-white flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#E5B842] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-gray-400">Verifikasi Sesi SPILLA GOLD Engine...</span>
        </div>
      </div>
    );
  }

  // Render Auth Screen if not logged in
  if (!currentUser || !authToken) {
    return (
      <AuthView
        onLoginSuccess={handleLoginSuccess}
        currentPath={currentPath}
        onNavigate={navigateTo}
      />
    );
  }

  // Render Admin Dashboard View if Admin View is explicitly toggled
  if (isAdminViewActive && currentUser.role === 'ADMIN') {
    return (
      <AdminDashboardView
        currentUser={currentUser}
        authToken={authToken}
        onNavigateToEngine={() => setIsAdminViewActive(false)}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#08090C] text-gray-300 flex flex-col font-sans selection:bg-[#E5B842]/30 selection:text-amber-200">
      {/* Top Header */}
      <Header
        marketPrice={marketPrice}
        lastUpdated={lastUpdated}
        onRefresh={fetchFullAnalysis}
        isRefreshing={isRefreshing}
        onNavigateTo={(tab) => {
          setIsAdminViewActive(false);
          if (tab === 'credit_wallet') {
            setIsCreditWalletOpen(true);
          } else {
            setActiveTab(tab as ViewTab);
          }
        }}
        currentUser={currentUser}
        onNavigateToAdmin={() => setIsAdminViewActive(true)}
        onLogout={handleLogout}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        creditBalance={creditBalance}
        onOpenCreditWallet={() => setIsCreditWalletOpen(true)}
      />

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Terminal Sidebar Navigation */}
        <Navigation
          activeTab={activeTab}
          onTabChange={(tab) => {
            setIsAdminViewActive(false);
            if (tab === 'credit_wallet') {
              setIsCreditWalletOpen(true);
              return;
            }
            setActiveTab(tab);
            if (tab === 'follow_master_ai') {
              navigateTo('/dashboard/follow-master-ai');
            } else if (window.location.pathname === '/dashboard/follow-master-ai') {
              navigateTo('/');
            }
          }}
          recommendationSignal={recommendationData?.recommendation}
          isAdmin={currentUser.role === 'ADMIN'}
          onNavigateToAdmin={() => setIsAdminViewActive(true)}
          creditBalance={creditBalance}
        />

        {/* Main View Workspace Area */}
        <main className="flex-1 p-3 lg:p-5 overflow-y-auto w-full max-w-[1800px] mx-auto">
          {activeTab === 'market_overview' && (
            <MarketOverviewView
              currentUser={currentUser}
              marketPrice={marketPrice}
              recommendationData={recommendationData}
              onNavigateTo={setActiveTab}
            />
          )}

          {activeTab === 'live_analysis' && (
            <LiveAnalysisView
              recommendationData={recommendationData}
              authToken={authToken}
              onCreditBalanceChanged={(newBal) => setCreditBalance(newBal)}
            />
          )}

          {activeTab === 'fundamental' && (
            <FundamentalView
              fundamentalData={recommendationData?.fundamentalScore || null}
            />
          )}

          {activeTab === 'technical' && (
            <TechnicalView
              technicalData={recommendationData?.technicalScore || null}
            />
          )}

          {activeTab === 'sentiment' && (
            <SentimentView
              sentimentData={recommendationData?.sentimentScore || null}
            />
          )}

          {activeTab === 'calendar' && <CalendarView />}

          {activeTab === 'news' && <NewsView />}

          {activeTab === 'ai_recommendation' && (
            <AiRecommendationView data={recommendationData} />
          )}

          {activeTab === 'follow_master_ai' && <FollowMasterAiView />}

          {activeTab === 'history' && <HistoryView />}

          {activeTab === 'engine_settings' && <SettingsView />}
        </main>
      </div>

      {/* Terminal Footer Status Bar */}
      <footer className="bg-[#0B0D12] border-t border-gray-800/90 px-5 py-2 text-gray-500 font-mono text-[10px] uppercase tracking-wider flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center space-x-3">
          <span className="text-[#E5B842] font-bold">SPILLA GOLD QUANTITATIVE WORKSTATION</span>
          <span>•</span>
          <span>System: <span className="text-emerald-400 font-bold">OPERATIONAL</span></span>
          <span>•</span>
          <span>Latency: <span className="text-emerald-400 font-bold">12ms</span></span>
        </div>
        <div className="flex items-center space-x-4">
          <span>Logged in as: <strong className="text-white">{currentUser.fullName} ({currentUser.role})</strong></span>
          <span>•</span>
          <span className="text-emerald-400 font-bold flex items-center gap-1">AI Engine Synced</span>
          <span>•</span>
          <span className="text-gray-400">SPILLA GOLD © 2026</span>
        </div>
      </footer>

      {/* Floating SPILLA AI Assistant Widget Trigger Button */}
      <button
        onClick={() => setIsAssistantOpen(true)}
        className="fixed bottom-12 right-6 z-40 p-2.5 bg-gradient-to-r from-[#E5B842] via-amber-400 to-[#E5B842] text-black font-black rounded-full shadow-2xl hover:scale-105 transition-all flex items-center gap-2 cursor-pointer border-2 border-amber-300 group"
        title="SPILLA AI Assistant"
      >
        <img
          src={spillaLogo}
          alt="SPILLA GOLD Logo"
          className="w-7 h-7 rounded-full object-cover border border-black/40 shrink-0"
          referrerPolicy="no-referrer"
        />
        <span className="hidden sm:inline text-xs font-black tracking-wider uppercase pr-1 text-black">
          SPILLA AI
        </span>
      </button>

      {/* Spilla Assistant Chat & Verification Modal */}
      <SpillaAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
      />

      {/* SPILLA AI Credit Wallet & Top Up Modal */}
      <CreditWalletModal
        isOpen={isCreditWalletOpen}
        onClose={() => setIsCreditWalletOpen(false)}
        authToken={authToken}
        onBalanceUpdated={() => fetchUserCreditBalance(authToken || undefined)}
      />
    </div>
  );
}
