// SPILLA AI Credit System Types (Saldo Internal - NOT Crypto/Blockchain)

export type CreditTransactionType =
  | 'TOPUP'
  | 'ANALYSIS'
  | 'REFUND'
  | 'ADMIN_ADD'
  | 'ADMIN_DEDUCT'
  | 'PROMO'
  | 'ADJUSTMENT';

export type TopUpStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'CANCELLED';

export interface UserCreditWallet {
  id: string;
  userId: string;
  creditBalance: number; // 1 Credit = Rp1
  totalCreditPurchased: number;
  totalCreditUsed: number;
  totalAnalysis: number;
  updatedAt: string;
  createdAt: string;
}

export interface UserWalletWithProfile extends UserCreditWallet {
  userName: string;
  email: string;
  role: string;
  status: string;
  accountType?: string;
  lastTransactionDate?: string;
}

export interface TopUpRequest {
  id: string; // e.g. TOPUP-20260820-000001
  userId: string;
  userName: string;
  email: string;
  phoneNumber?: string;
  amountIdr: number; // e.g. 50000
  creditRequested: number; // e.g. 50000
  paymentMethod: 'MANUAL_BANK_TRANSFER';
  bankName: string;
  accountNumber: string;
  accountName: string;
  status: TopUpStatus;
  createdAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
  confirmedByName?: string;
  adminNotes?: string;
  referenceNotes?: string;
}

export interface CreditTransaction {
  id: string; // e.g. CTX-20260820-000001
  userId: string;
  userName?: string;
  email?: string;
  type: CreditTransactionType;
  amount: number; // positive or negative
  creditIn: number;
  creditOut: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId?: string; // TopUp ID or Analysis ID
  description: string;
  adminId?: string;
  adminName?: string;
  createdAt: string;
}

export interface AiAnalysisHistoryRecord {
  id: string; // ANL-XXXXXX
  userId: string;
  userName?: string;
  email?: string;
  symbol: string;
  timeframe: string;
  analysisType: string;
  creditCost: number; // 100
  status: 'SUCCESS' | 'FAILED';
  errorMessage?: string;
  snapshotId?: string;
  signalId?: string;
  createdAt: string;
}

export interface PaymentSettings {
  bankName: string;
  accountNumber: string;
  accountName: string;
  instructions: string;
  isActive: boolean;
  updatedAt: string;
}

export interface AdminCreditStats {
  totalCreditSoldIdr: number;
  creditInUserWallets: number;
  totalCreditUsed: number;
  totalAiAnalysis: number;
  pendingTopUpCount: number;
  pendingTopUpAmountIdr: number;
}
