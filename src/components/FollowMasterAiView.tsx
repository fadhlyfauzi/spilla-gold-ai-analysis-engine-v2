import React, { useState } from 'react';
import {
  Users,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Zap,
  Award,
  Sparkles,
  ArrowRight,
  UserPlus,
  DollarSign,
  Lock,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { TraderLoginModal } from './TraderLoginModal';

export const FollowMasterAiView: React.FC = () => {
  const brokerRegisterUrl = 'https://cp2.aimsdagang.com/register?referral2=30072436';
  const UNIVERSAL_MASTER_REGISTRATION_LINK =
    'https://social.aimsxchange.com/portal/registration/subscription/82123/SpillaSeribu';

  const [selectedPkgForLogin, setSelectedPkgForLogin] = useState<{ id: string; name: string; ctaUrl: string } | null>(null);
  const [isTraderLoginOpen, setIsTraderLoginOpen] = useState<boolean>(false);

  const handleOpenLogin = (pkg: { id: string; name: string; ctaUrl: string }) => {
    setSelectedPkgForLogin(pkg);
    setIsTraderLoginOpen(true);
  };

  const packages = [
    {
      id: 'scout',
      name: 'SPILLA SCOUT',
      badge: 'STARTER COPY TRADE',
      accentColor: 'border-amber-700/60 text-amber-500 bg-amber-950/30',
      badgeColor: 'bg-amber-900/40 text-amber-400 border-amber-700/50',
      headerGradient: 'from-amber-950/50 to-transparent',
      ctaColor: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/40',
      tagline: 'Start Small • Learn • Grow',
      description:
        'Pilihan awal bagi investor yang ingin mulai mengenal sistem Copy Trade SPILLA GOLD dengan modal terjangkau.',
      minDeposit: '$50',
      accessFee: '$10',
      profitShare: '70% Investor : 30% Master',
      accessType: 'Lifetime (S&K)',
      suitableFor: ['Pemula', 'Modal kecil', 'Uji coba sistem', 'Diversifikasi bertahap'],
      advantages: [
        'Modal terjangkau ($50)',
        'Akses lifetime (S&K)',
        'Automated copy trade',
        'Akun milik sendiri',
        'Transparan & real-time monitoring',
      ],
      ctaUrl: UNIVERSAL_MASTER_REGISTRATION_LINK,
    },
    {
      id: 'elite',
      name: 'SPILLA ELITE',
      badge: 'BALANCED COPY TRADE',
      accentColor: 'border-cyan-500/60 text-cyan-400 bg-cyan-950/30',
      badgeColor: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/50',
      headerGradient: 'from-cyan-950/50 to-transparent',
      ctaColor: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/40',
      tagline: 'Smart Capital • Smart Copy Trade',
      description:
        'Dirancang untuk investor yang menginginkan kapasitas modal lebih tinggi dibanding SCOUT dengan skema bagi hasil sama.',
      minDeposit: '$100',
      accessFee: '$20',
      profitShare: '70% Investor : 30% Master',
      accessType: 'Lifetime (S&K)',
      suitableFor: [
        'Investor pemula naik level',
        'Modal $100',
        'Kapasitas sedang',
        'Strategi bertahap',
      ],
      advantages: [
        'Modal mulai $100',
        'Akses lifetime (S&K)',
        'Automated copy trade',
        'Kontrol mandiri',
        'Transparan & real-time monitoring',
      ],
      ctaUrl: UNIVERSAL_MASTER_REGISTRATION_LINK,
    },
    {
      id: 'hunter',
      name: 'SPILLA HUNTER',
      badge: 'ADVANCED COPY TRADE',
      accentColor: 'border-slate-400/60 text-slate-300 bg-slate-900/40',
      badgeColor: 'bg-slate-800/80 text-slate-200 border-slate-500/50',
      headerGradient: 'from-slate-800/50 to-transparent',
      ctaColor: 'bg-slate-200 hover:bg-white text-slate-950 font-bold shadow-slate-900/40',
      tagline: 'Hunt the Market • Follow the Strategy',
      description:
        'Ditujukan bagi investor yang ingin menggunakan kapasitas modal lebih besar untuk mengikuti strategi trading.',
      minDeposit: '$250',
      accessFee: '$50',
      profitShare: '70% Investor : 30% Master',
      accessType: 'Lifetime (S&K)',
      suitableFor: [
        'Investor berpengalaman',
        'Kapasitas modal lebih tinggi',
        'Paham risiko pasar',
      ],
      advantages: [
        'Kapasitas modal lebih besar ($250)',
        'Akses lifetime (S&K)',
        'Automated copy trade',
        'Kontrol akun sendiri',
        'Transparan & real-time monitoring',
      ],
      ctaUrl: UNIVERSAL_MASTER_REGISTRATION_LINK,
    },
    {
      id: 'striker',
      name: 'SPILLA STRIKER',
      badge: 'PROFESSIONAL COPY TRADE',
      accentColor: 'border-[#E5B842] text-[#E5B842] bg-[#E5B842]/10',
      badgeColor: 'bg-[#E5B842]/20 text-amber-300 border-[#E5B842]/50',
      headerGradient: 'from-amber-900/40 to-transparent',
      ctaColor: 'bg-[#E5B842] hover:bg-amber-400 text-black font-extrabold shadow-amber-500/20',
      tagline: 'Strike with Strategy • Trade with Discipline',
      description:
        'Pilihan bagi investor dengan kapasitas modal lebih besar yang ingin mengikuti strategi trading Master.',
      minDeposit: '$500+',
      accessFee: '$100',
      profitShare: '70% Investor : 30% Master',
      accessType: 'Lifetime (S&K)',
      suitableFor: [
        'Modal $500+',
        'Trader/Investor berpengalaman',
        'Paham risiko tinggi',
        'Eksposur besar',
      ],
      advantages: [
        'Kapasitas modal $500+',
        'Akses lifetime (S&K)',
        'Automated copy trade',
        'Monitoring transparan',
        'Eksekusi prioritas & terdisiplin',
      ],
      ctaUrl: UNIVERSAL_MASTER_REGISTRATION_LINK,
    },
    {
      id: 'infinity',
      name: 'SPILLA INFINITY',
      badge: 'PREMIUM MASTER COPY TRADE',
      accentColor: 'border-yellow-400/80 text-yellow-300 bg-yellow-950/40',
      badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-400/60 font-black',
      headerGradient: 'from-amber-900/60 via-yellow-950/40 to-transparent',
      ctaColor: 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 hover:brightness-110 text-black font-black shadow-amber-500/30 border border-yellow-200',
      tagline: 'Infinite Potential • Premium Strategy',
      description:
        'SPILLA INFINITY merupakan salah satu Master CT SPILLA GOLD yang diperuntukkan bagi investor dengan kapasitas modal lebih besar dan ingin mengikuti strategi trading melalui sistem Copy Trade.',
      minDeposit: '$1,000',
      accessFee: 'Gratis Akses (S&K)',
      profitShare: '70% Investor : 30% Master',
      accessType: 'Lifetime (S&K)',
      suitableFor: [
        'Kapasitas modal besar ($1,000+)',
        'Investor institusional & profesional',
        'Sistem Copy Trade otomatis',
        'Eksekusi & monitoring real-time',
      ],
      advantages: [
        'Kapasitas modal mulai $1,000',
        'Sistem Copy Trade',
        'Akses lifetime (S&K)',
        'Investor menggunakan akun trading sendiri',
        'Transaksi Master dapat diikuti secara otomatis',
        'Dapat dipantau melalui platform copy trade',
      ],
      ctaUrl: UNIVERSAL_MASTER_REGISTRATION_LINK,
    },
  ];

  const steps = [
    {
      step: 1,
      title: 'Registrasi Akun Broker',
      desc: 'Buat akun broker resmi melalui link referal SPILLA GOLD.',
      icon: UserPlus,
    },
    {
      step: 2,
      title: 'Pilih Master EA',
      desc: 'Pilih paket Master EA Copy Trade sesuai dengan modal investasi Anda.',
      icon: Layers,
    },
    {
      step: 3,
      title: 'Klik Link Master EA',
      desc: 'Akses link pendaftaran Copy Trade resmi sesuai paket yang dipilih.',
      icon: ExternalLink,
    },
    {
      step: 4,
      title: 'Deposit Modal',
      desc: 'Lakukan deposit modal sesuai ketentuan minimum paket Master EA.',
      icon: DollarSign,
    },
    {
      step: 5,
      title: 'Aktifkan Copy Trade',
      desc: 'Hubungkan akun Anda dan aktifkan fitur otomatisasi Copy Trade.',
      icon: Zap,
    },
    {
      step: 6,
      title: 'Siap Beroperasi',
      desc: 'Akun Anda secara otomatis mengikuti transaksi strategi Master EA.',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="space-y-8 font-sans pb-12">
      {/* 1. Page Header & Registration Banner */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#0F121A] border border-gray-800 p-6 rounded-2xl shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#E5B842]/5 rounded-full blur-3xl pointer-events-none" />

          <div className="space-y-2 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E5B842]/10 border border-[#E5B842]/30 text-[#E5B842] text-xs font-extrabold uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5 text-[#E5B842]" />
              <span>TERMINAL MODULES • COPY TRADE SYSTEM</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
              <span>Follow Master AI - Copy Trade SPILLA GOLD</span>
            </h1>
            <p className="text-sm text-gray-400 max-w-2xl leading-relaxed">
              Mulai Copy Trade dari <strong className="text-amber-300">$50</strong>. Pilihan Master
              EA Copy Trade presisi sesuai dengan kapasitas modal dan strategi investasi Anda.
            </p>
          </div>

          <div className="shrink-0 relative z-10">
            <div className="bg-[#151924] border border-gray-800 p-3.5 rounded-xl text-center space-y-1">
              <span className="text-[10px] text-gray-400 font-bold uppercase block">
                SKEMA BAGI HASIL
              </span>
              <span className="text-xl font-black text-[#E5B842]">70% : 30%</span>
              <span className="text-[10px] text-emerald-400 font-bold block bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                70% INVESTOR / 30% MASTER
              </span>
            </div>
          </div>
        </div>

        {/* Banner Registrasi Akun Broker */}
        <div className="bg-gradient-to-r from-amber-950/40 via-[#151924] to-[#0F121A] border-2 border-[#E5B842]/40 p-6 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-black text-[#E5B842] tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-[#E5B842] animate-ping" />
              <span>LANGKAH WAJIB • 1. REGISTRASI AKUN BROKER</span>
            </div>
            <h2 className="text-lg md:text-xl font-extrabold text-white">
              Belum Memiliki Akun Broker SPILLA GOLD?
            </h2>
            <p className="text-xs text-gray-300 leading-relaxed">
              Sebelum mengaktifkanCopy Trade, pastikan Anda telah mendaftar dan memiliki akun
              broker resmi yang terhubung dengan infrastruktur Copy Trade SPILLA GOLD.
            </p>
          </div>

          <a
            href={brokerRegisterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full md:w-auto px-6 py-3.5 rounded-xl bg-[#E5B842] hover:bg-amber-400 text-black font-black text-xs transition-all transform hover:-translate-y-0.5 shadow-xl hover:shadow-[#E5B842]/30 flex items-center justify-center gap-2 shrink-0 tracking-wider uppercase cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>REGISTRASI AKUN BROKER SPILLA GOLD</span>
            <ExternalLink className="w-4 h-4 ml-1" />
          </a>
        </div>
      </div>

      {/* 2. Grid Cards Paket Copy Trade (2x2 Desktop, 1 Col Mobile) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-[#E5B842]" />
              <span>PILIHAN PAKET MASTER EA COPY TRADE</span>
            </h2>
            <p className="text-xs text-gray-400">
              Pilih alokasi modal dan kapasitas risikomu. Akses berlaku Lifetime (S&K).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`bg-[#0F121A] border-2 ${pkg.accentColor} rounded-2xl p-6 shadow-2xl flex flex-col justify-between transition-all hover:border-[#E5B842]/70 relative overflow-hidden group`}
            >
              {/* Background Glow */}
              <div
                className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-b ${pkg.headerGradient} rounded-full blur-3xl opacity-30 pointer-events-none group-hover:opacity-50 transition-opacity`}
              />

              <div className="space-y-5 relative z-10">
                {/* Header Badge & Name */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span
                      className={`text-[10px] font-black tracking-widest uppercase px-2.5 py-1 rounded-md border ${pkg.badgeColor} inline-block mb-2`}
                    >
                      {pkg.badge}
                    </span>
                    <h3 className="text-2xl font-black text-white tracking-tight">{pkg.name}</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-0.5">{pkg.tagline}</p>
                  </div>
                  <div className="text-right bg-[#151924] px-3 py-2 rounded-xl border border-gray-800">
                    <span className="text-[10px] text-gray-400 block font-bold uppercase">
                      MIN. DEPOSIT
                    </span>
                    <span className="text-xl font-black text-white">{pkg.minDeposit}</span>
                  </div>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed bg-[#151924]/80 p-3 rounded-xl border border-gray-800/80">
                  {pkg.description}
                </p>

                {/* Details Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-[#151924] p-2.5 rounded-xl border border-gray-800">
                    <span className="text-[10px] text-gray-400 block font-bold">BIAYA AKSES</span>
                    <span className="font-extrabold text-amber-300">{pkg.accessFee}</span>
                  </div>
                  <div className="bg-[#151924] p-2.5 rounded-xl border border-gray-800">
                    <span className="text-[10px] text-gray-400 block font-bold">AKSES</span>
                    <span className="font-extrabold text-emerald-400">{pkg.accessType}</span>
                  </div>
                  <div className="col-span-2 bg-[#151924] p-2.5 rounded-xl border border-gray-800 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400 font-bold">BAGI HASIL:</span>
                    <span className="font-black text-[#E5B842]">{pkg.profitShare}</span>
                  </div>
                </div>

                {/* Cocok Untuk */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block">
                    COCOK UNTUK:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {pkg.suitableFor.map((item, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-800/80 text-gray-300 border border-gray-700/50"
                      >
                        • {item}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Keunggulan */}
                <div className="space-y-2">
                  <span className="text-[11px] font-extrabold text-gray-400 uppercase tracking-wider block">
                    KEUNGGULAN UTAMA:
                  </span>
                  <ul className="space-y-1.5 text-xs text-gray-300">
                    {pkg.advantages.map((adv, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{adv}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* CTA Button Trigger Login Modal */}
              <div className="pt-6 mt-4 border-t border-gray-800/80 relative z-10">
                <button
                  type="button"
                  onClick={() => handleOpenLogin(pkg)}
                  className={`w-full py-3.5 px-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer shadow-lg ${pkg.ctaColor}`}
                >
                  <span>GABUNG {pkg.name} NOW</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Section Cara Bergabung (Step-by-Step 1 to 6) */}
      <div className="bg-[#0F121A] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="space-y-1 border-b border-gray-800 pb-4">
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#E5B842]" />
            <span>CARA BERGABUNG COPY TRADE (STEP-BY-STEP)</span>
          </h2>
          <p className="text-xs text-gray-400">
            Ikuti 6 langkah mudah berikut untuk mengaktifkan akun Copy Trade Anda secara otomatis.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {steps.map((s) => {
            const IconComponent = s.icon;
            return (
              <div
                key={s.step}
                className="bg-[#151924] border border-gray-800 p-4 rounded-xl flex items-start gap-3.5 hover:border-[#E5B842]/40 transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-[#E5B842]/10 border border-[#E5B842]/30 flex items-center justify-center text-[#E5B842] font-black text-base shrink-0 group-hover:scale-110 transition-transform">
                  {s.step}
                </div>
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>{s.title}</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Section Skema Bagi Hasil & Disclaimer (Footer Page) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Skema Bagi Hasil */}
        <div className="bg-[#0F121A] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#E5B842] uppercase">
              <ShieldCheck className="w-4 h-4 text-[#E5B842]" />
              <span>SKEMA BAGI HASIL & BIAYA</span>
            </div>
            <h3 className="text-base font-black text-white">Transparan & Tanpa Biaya Tersembunyi</h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              Sistem Copy Trade SPILLA GOLD menerapkan pembagian hasil yang adil. Keuntungan hasil
              trading dibagi otomatis oleh sistem broker.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-800">
            <div className="flex justify-between items-center bg-[#151924] p-2.5 rounded-xl text-xs font-mono">
              <span className="text-gray-400 font-bold">Porsi Investor:</span>
              <span className="text-emerald-400 font-black text-sm">70% NET PROFIT</span>
            </div>
            <div className="flex justify-between items-center bg-[#151924] p-2.5 rounded-xl text-xs font-mono">
              <span className="text-gray-400 font-bold">Porsi Master EA:</span>
              <span className="text-[#E5B842] font-black text-sm">30% PERFORMANCE FEE</span>
            </div>
            <div className="flex justify-between items-center bg-[#151924] p-2.5 rounded-xl text-xs font-mono">
              <span className="text-gray-400 font-bold">Masa Berlaku Akses:</span>
              <span className="text-cyan-300 font-black text-xs">LIFETIME (S&K BROKER)</span>
            </div>
          </div>
        </div>

        {/* Warning Banner / Disclaimer Box */}
        <div className="lg:col-span-2 bg-amber-950/20 border-2 border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase tracking-wider">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
              <span>PERINGATAN RISIKO & DISCLAIMER RESMI</span>
            </div>
            <h3 className="text-sm font-extrabold text-amber-200">
              Pahami Risiko Sebelum Memulai Copy Trade
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed font-sans">
              ⚠️ <strong>DISCLAIMER:</strong> Trading valuta asing (Forex) dan komoditas (Emas/XAUUSD)
              memiliki tingkat risiko tinggi yang mungkin tidak cocok untuk semua investor. Tingkat
              leverage yang tinggi dapat bekerja menguntungkan sekaligus merugikan Anda.
            </p>
            <p className="text-xs text-gray-400 leading-relaxed font-sans">
              Profit masa lalu tidak menjamin hasil di masa mendatang. Hasil kinerja akun Copy Trade
              dapat bervariasi tergantung kondisi volatilitas pasar, waktu eksekusi deposit, slippage,
              serta manajemen risiko masing-masing akun. Gunakan modal yang siap Anda tanggung risikonya.
            </p>
          </div>

          <div className="pt-3 border-t border-amber-500/20 flex items-center justify-between text-[11px] text-amber-400 font-mono">
            <span>SPILLA GOLD QUANTITATIVE WORKSTATION</span>
            <span>OFFICIAL COPY TRADE MODULE</span>
          </div>
        </div>
      </div>

      {/* Trader Copy Trade Login Modal */}
      <TraderLoginModal
        isOpen={isTraderLoginOpen}
        selectedMaster={selectedPkgForLogin}
        onClose={() => setIsTraderLoginOpen(false)}
      />
    </div>
  );
};
