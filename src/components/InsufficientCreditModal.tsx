import React from 'react';
import { AlertCircle, Coins, PlusCircle, X, Sparkles } from 'lucide-react';

interface InsufficientCreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  requiredCredit?: number;
  onOpenTopUp: () => void;
}

export const InsufficientCreditModal: React.FC<InsufficientCreditModalProps> = ({
  isOpen,
  onClose,
  currentBalance,
  requiredCredit = 100,
  onOpenTopUp,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#0E1118] border-2 border-amber-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 text-center font-sans">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-[#E5B842] shadow-inner">
          <Coins className="w-7 h-7 text-[#E5B842] animate-bounce" />
        </div>

        <div className="space-y-1.5">
          <h3 className="text-lg font-black text-white uppercase tracking-wide">
            SALDO SPILLA AI CREDIT TIDAK CUKUP
          </h3>
          <p className="text-xs text-gray-400">
            Untuk menjalankan fitur <strong className="text-amber-300">LIVE ANALYSIS AI</strong>, dibutuhkan{' '}
            <strong className="text-white font-mono">{requiredCredit} Credit (Rp100)</strong> per sesi analisis.
          </p>
        </div>

        {/* Balance Status Comparison */}
        <div className="p-4 rounded-xl bg-[#121622] border border-gray-800 grid grid-cols-2 gap-3 text-left">
          <div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wider">Saldo Saat Ini</div>
            <div className="text-base font-black text-rose-400 font-mono">
              {currentBalance.toLocaleString('id-ID')} <span className="text-xs font-normal">Credit</span>
            </div>
            <div className="text-[10px] text-gray-500">Rp{currentBalance.toLocaleString('id-ID')}</div>
          </div>
          <div className="border-l border-gray-800 pl-3">
            <div className="text-[11px] text-gray-500 uppercase tracking-wider">Dibutuhkan</div>
            <div className="text-base font-black text-[#E5B842] font-mono">
              {requiredCredit} <span className="text-xs font-normal">Credit</span>
            </div>
            <div className="text-[10px] text-emerald-400 font-medium">1x Sesi AI Analisis</div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            onClick={() => {
              onClose();
              onOpenTopUp();
            }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#E5B842] to-amber-500 hover:from-[#d6a529] hover:to-amber-600 text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Top Up Credit Sekarang (Mulai Rp10.000)</span>
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-xs font-bold text-gray-400 hover:text-white transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
