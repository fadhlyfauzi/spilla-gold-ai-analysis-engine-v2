import { prisma } from '../db/prisma.js';
import {
  UserCreditWallet,
  UserWalletWithProfile,
  TopUpRequest,
  TopUpStatus,
  CreditTransaction,
  CreditTransactionType,
  AiAnalysisHistoryRecord,
  PaymentSettings,
  AdminCreditStats,
} from '../../src/types/credit.js';

class CreditService {
  // In-memory persistent collections (synchronized across app execution)
  private wallets: Map<string, UserCreditWallet> = new Map();
  private topups: Map<string, TopUpRequest> = new Map();
  private transactions: CreditTransaction[] = [];
  private analysisHistory: AiAnalysisHistoryRecord[] = [];
  private paymentSettings: PaymentSettings = {
    bankName: 'BCA (Bank Central Asia)',
    accountNumber: '0771360059',
    accountName: 'Sri Hartono',
    instructions: 'Silakan transfer sesuai nominal Top Up ke rekening BCA 0771360059 a/n Sri Hartono. Cantumkan ID Top Up pada berita transfer. Saldo Credit akan otomatis ditambahkan setelah Admin mengonfirmasi pembayaran.',
    isActive: true,
    updatedAt: new Date().toISOString(),
  };

  private isSeeded = false;

  constructor() {
    this.seedInitialData();
  }

  private seedInitialData() {
    if (this.isSeeded) return;
    this.isSeeded = true;

    const now = new Date().toISOString();

    // 1. Seed Admin Wallet (100,000 Credits = Rp100.000)
    const adminWallet: UserCreditWallet = {
      id: 'CWAL-ADMIN-001',
      userId: 'usr-admin-001',
      creditBalance: 100000,
      totalCreditPurchased: 100000,
      totalCreditUsed: 0,
      totalAnalysis: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.wallets.set(adminWallet.userId, adminWallet);

    this.transactions.push({
      id: 'CTX-SEED-001',
      userId: 'usr-admin-001',
      userName: 'Master Admin SPILLA',
      email: 'admin@spillagold.com',
      type: 'TOPUP',
      amount: 100000,
      creditIn: 100000,
      creditOut: 0,
      balanceBefore: 0,
      balanceAfter: 100000,
      referenceId: 'TOPUP-SYS-INITIAL',
      description: 'System Provisioning Admin Balance',
      createdAt: now,
    });

    // 2. Seed Demo Trader Wallet (25,000 Credits = Rp25.000 = 250 Analysis)
    const traderWallet: UserCreditWallet = {
      id: 'CWAL-TRADER-002',
      userId: 'usr-trader-002',
      creditBalance: 25000,
      totalCreditPurchased: 25000,
      totalCreditUsed: 0,
      totalAnalysis: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.wallets.set(traderWallet.userId, traderWallet);

    this.transactions.push({
      id: 'CTX-SEED-002',
      userId: 'usr-trader-002',
      userName: 'Institutional Trader',
      email: 'trader@spillagold.com',
      type: 'TOPUP',
      amount: 25000,
      creditIn: 25000,
      creditOut: 0,
      balanceBefore: 0,
      balanceAfter: 25000,
      referenceId: 'TOPUP-20260815-000101',
      description: 'Top Up SPILLA AI Credit (Bank BCA)',
      createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    });

    // Seed past topup records
    const seedTopup1: TopUpRequest = {
      id: 'TOPUP-20260815-000101',
      userId: 'usr-trader-002',
      userName: 'Institutional Trader',
      email: 'trader@spillagold.com',
      phoneNumber: '081234567890',
      amountIdr: 25000,
      creditRequested: 25000,
      paymentMethod: 'MANUAL_BANK_TRANSFER',
      bankName: 'BCA (Bank Central Asia)',
      accountNumber: '0771360059',
      accountName: 'Sri Hartono',
      status: 'CONFIRMED',
      createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
      confirmedAt: new Date(Date.now() - 3600000 * 24 * 3 + 180000).toISOString(),
      confirmedBy: 'usr-admin-001',
      confirmedByName: 'Master Admin SPILLA',
      adminNotes: 'Pembayaran transfer bank valid & telah diverifikasi.',
    };
    this.topups.set(seedTopup1.id, seedTopup1);

    const seedTopup2: TopUpRequest = {
      id: 'TOPUP-20260819-000204',
      userId: 'usr-trader-002',
      userName: 'Institutional Trader',
      email: 'trader@spillagold.com',
      phoneNumber: '081234567890',
      amountIdr: 50000,
      creditRequested: 50000,
      paymentMethod: 'MANUAL_BANK_TRANSFER',
      bankName: 'BCA (Bank Central Asia)',
      accountNumber: '0771360059',
      accountName: 'Sri Hartono',
      status: 'PENDING',
      createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      referenceNotes: 'Transfer via M-BCA an Trader',
    };
    this.topups.set(seedTopup2.id, seedTopup2);
  }

  /**
   * Helper: Resolve User details from Prisma or In-Memory
   */
  private async resolveUser(userId: string): Promise<{ fullName: string; email: string; role: string; status: string; accountType?: string } | null> {
    try {
      const u = await prisma.user.findUnique({ where: { id: userId } });
      if (u) {
        return {
          fullName: u.fullName,
          email: u.email,
          role: u.role,
          status: u.status,
          accountType: u.accountType,
        };
      }
    } catch (err) {
      console.warn('[CreditService] Prisma resolve fallback for user:', userId);
    }

    if (userId === 'usr-admin-001') {
      return { fullName: 'Master Admin SPILLA', email: 'admin@spillagold.com', role: 'ADMIN', status: 'ACTIVE', accountType: 'Master Admin' };
    }
    if (userId === 'usr-trader-002') {
      return { fullName: 'Institutional Trader', email: 'trader@spillagold.com', role: 'USER', status: 'ACTIVE', accountType: 'Trader Institusi' };
    }
    return { fullName: 'Trader Member', email: 'user@spillagold.com', role: 'USER', status: 'ACTIVE' };
  }

  /**
   * Get or initialize User Credit Wallet
   */
  public async getWallet(userId: string): Promise<UserCreditWallet> {
    let wallet = this.wallets.get(userId);
    if (!wallet) {
      const now = new Date().toISOString();
      wallet = {
        id: `CWAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        userId,
        creditBalance: 0,
        totalCreditPurchased: 0,
        totalCreditUsed: 0,
        totalAnalysis: 0,
        createdAt: now,
        updatedAt: now,
      };
      this.wallets.set(userId, wallet);
    }
    return wallet;
  }

  /**
   * Pre-check if User has enough balance for Live AI Analysis (Cost: 100 Credit)
   */
  public async checkCanAnalyze(userId: string, cost = 100): Promise<{ canAnalyze: boolean; currentBalance: number; required: number; availableAnalysis: number }> {
    const wallet = await this.getWallet(userId);
    const canAnalyze = wallet.creditBalance >= cost;
    return {
      canAnalyze,
      currentBalance: wallet.creditBalance,
      required: cost,
      availableAnalysis: Math.floor(wallet.creditBalance / cost),
    };
  }

  /**
   * Deduct 100 Credits upon SUCCESSFUL Live AI Analysis
   */
  public async deductForAnalysis(
    userId: string,
    details: {
      symbol: string;
      timeframe: string;
      analysisType?: string;
      snapshotId?: string;
      signalId?: string;
    }
  ): Promise<{ success: boolean; newBalance: number; transactionId: string; analysisId: string }> {
    const cost = 100;
    const wallet = await this.getWallet(userId);

    if (wallet.creditBalance < cost) {
      throw new Error(`INSUFFICIENT_CREDIT: Saldo Anda ${wallet.creditBalance} Credit tidak mencukupi (dibutuhkan ${cost} Credit).`);
    }

    const user = await this.resolveUser(userId);
    const balanceBefore = wallet.creditBalance;
    const balanceAfter = balanceBefore - cost;
    const now = new Date().toISOString();

    // Atomic update
    wallet.creditBalance = balanceAfter;
    wallet.totalCreditUsed += cost;
    wallet.totalAnalysis += 1;
    wallet.updatedAt = now;

    const analysisId = `ANL-${Date.now().toString().slice(-8)}`;
    const txId = `CTX-${Date.now().toString().slice(-8)}`;

    // Ledger record
    const tx: CreditTransaction = {
      id: txId,
      userId,
      userName: user?.fullName || 'User',
      email: user?.email || '',
      type: 'ANALYSIS',
      amount: -cost,
      creditIn: 0,
      creditOut: cost,
      balanceBefore,
      balanceAfter,
      referenceId: analysisId,
      description: `Live Analysis AI (${details.symbol} ${details.timeframe || 'H1'})`,
      createdAt: now,
    };
    this.transactions.unshift(tx);

    // Analysis History record
    const anlRecord: AiAnalysisHistoryRecord = {
      id: analysisId,
      userId,
      userName: user?.fullName || 'User',
      email: user?.email || '',
      symbol: details.symbol || 'XAUUSD',
      timeframe: details.timeframe || 'H1',
      analysisType: details.analysisType || 'LIVE_AI_ANALYSIS',
      creditCost: cost,
      status: 'SUCCESS',
      snapshotId: details.snapshotId,
      signalId: details.signalId,
      createdAt: now,
    };
    this.analysisHistory.unshift(anlRecord);

    console.log(`[CREDIT SERVICE] Deducted ${cost} Credit for user ${userId}. Balance: ${balanceBefore} -> ${balanceAfter}`);
    return {
      success: true,
      newBalance: balanceAfter,
      transactionId: txId,
      analysisId,
    };
  }

  /**
   * Record Failed Analysis (No Credit Deducted)
   */
  public async recordFailedAnalysis(
    userId: string,
    details: {
      symbol: string;
      timeframe: string;
      analysisType?: string;
      error: string;
    }
  ): Promise<AiAnalysisHistoryRecord> {
    const user = await this.resolveUser(userId);
    const now = new Date().toISOString();
    const analysisId = `ANL-FAIL-${Date.now().toString().slice(-6)}`;

    const anlRecord: AiAnalysisHistoryRecord = {
      id: analysisId,
      userId,
      userName: user?.fullName || 'User',
      email: user?.email || '',
      symbol: details.symbol || 'XAUUSD',
      timeframe: details.timeframe || 'H1',
      analysisType: details.analysisType || 'LIVE_AI_ANALYSIS',
      creditCost: 0, // 0 credit on error
      status: 'FAILED',
      errorMessage: details.error,
      createdAt: now,
    };
    this.analysisHistory.unshift(anlRecord);

    console.log(`[CREDIT SERVICE] Recorded failed analysis for user ${userId}. Zero credits deducted.`);
    return anlRecord;
  }

  /**
   * Create Manual Bank Transfer Top Up Request
   */
  public async createTopUpRequest(
    userId: string,
    amountIdr: number,
    referenceNotes?: string
  ): Promise<TopUpRequest> {
    if (amountIdr < 1000) {
      throw new Error('Minimal Top Up adalah Rp1.000 (1.000 Credit).');
    }

    const user = await this.resolveUser(userId);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const topupId = `TOPUP-${dateStr}-${randomSuffix}`;

    const settings = this.paymentSettings;

    const request: TopUpRequest = {
      id: topupId,
      userId,
      userName: user?.fullName || 'User',
      email: user?.email || '',
      amountIdr,
      creditRequested: amountIdr, // 1 Credit = Rp1
      paymentMethod: 'MANUAL_BANK_TRANSFER',
      bankName: settings.bankName,
      accountNumber: settings.accountNumber,
      accountName: settings.accountName,
      status: 'PENDING',
      createdAt: now.toISOString(),
      referenceNotes: referenceNotes?.trim() || undefined,
    };

    this.topups.set(topupId, request);
    console.log(`[CREDIT SERVICE] Top Up Request Created: ${topupId} by ${userId} for Rp${amountIdr.toLocaleString('id-ID')}`);
    return request;
  }

  /**
   * Confirm Top Up Request (Admin Action - Double Credit Safe & Atomic)
   */
  public async confirmTopUpRequest(
    topupId: string,
    adminId: string,
    adminName: string,
    adminNotes?: string
  ): Promise<{ success: boolean; topup: TopUpRequest; wallet: UserCreditWallet }> {
    const topup = this.topups.get(topupId);
    if (!topup) {
      throw new Error('Top Up Request tidak ditemukan.');
    }

    if (topup.status === 'CONFIRMED') {
      throw new Error('Top Up Request ini sudah pernah dikonfirmasi sebelumnya.');
    }

    if (topup.status === 'REJECTED') {
      throw new Error('Top Up Request yang sudah ditolak tidak dapat dikonfirmasi kembali.');
    }

    const now = new Date().toISOString();
    const wallet = await this.getWallet(topup.userId);
    const creditToAdd = topup.creditRequested;
    const balanceBefore = wallet.creditBalance;
    const balanceAfter = balanceBefore + creditToAdd;

    // Mutate Wallet
    wallet.creditBalance = balanceAfter;
    wallet.totalCreditPurchased += creditToAdd;
    wallet.updatedAt = now;

    // Mutate Top Up Record
    topup.status = 'CONFIRMED';
    topup.confirmedAt = now;
    topup.confirmedBy = adminId;
    topup.confirmedByName = adminName;
    if (adminNotes) topup.adminNotes = adminNotes.trim();

    // Create Ledger Transaction
    const tx: CreditTransaction = {
      id: `CTX-${Date.now().toString().slice(-8)}`,
      userId: topup.userId,
      userName: topup.userName,
      email: topup.email,
      type: 'TOPUP',
      amount: creditToAdd,
      creditIn: creditToAdd,
      creditOut: 0,
      balanceBefore,
      balanceAfter,
      referenceId: topup.id,
      description: `Top Up SPILLA AI Credit (Bank ${topup.bankName}) - Confirmed by Admin ${adminName}`,
      adminId,
      adminName,
      createdAt: now,
    };
    this.transactions.unshift(tx);

    console.log(`[CREDIT SERVICE] Admin ${adminName} confirmed Top Up ${topup.id}: Added ${creditToAdd} Credits to ${topup.userId}. Balance: ${balanceBefore} -> ${balanceAfter}`);

    return {
      success: true,
      topup,
      wallet,
    };
  }

  /**
   * Reject Top Up Request (Admin Action)
   */
  public async rejectTopUpRequest(
    topupId: string,
    adminId: string,
    adminName: string,
    adminNotes: string
  ): Promise<TopUpRequest> {
    const topup = this.topups.get(topupId);
    if (!topup) {
      throw new Error('Top Up Request tidak ditemukan.');
    }

    if (topup.status === 'CONFIRMED') {
      throw new Error('Top Up Request yang telah dikonfirmasi tidak dapat ditolak.');
    }

    const now = new Date().toISOString();
    topup.status = 'REJECTED';
    topup.confirmedAt = now;
    topup.confirmedBy = adminId;
    topup.confirmedByName = adminName;
    topup.adminNotes = adminNotes.trim() || 'Pembayaran ditolak oleh Admin.';

    console.log(`[CREDIT SERVICE] Admin ${adminName} rejected Top Up ${topup.id}. Reason: ${topup.adminNotes}`);
    return topup;
  }

  /**
   * Admin Manual Adjust Credit (ADD / DEDUCT with mandatory reason)
   */
  public async adjustCredit(
    adminId: string,
    adminName: string,
    targetUserId: string,
    adjustment: {
      type: 'ADD' | 'DEDUCT';
      amount: number;
      reason: string;
    }
  ): Promise<{ success: boolean; wallet: UserCreditWallet; transaction: CreditTransaction }> {
    if (!adjustment.reason || adjustment.reason.trim().length < 3) {
      throw new Error('Alasan penyesuaian saldo (Reason) wajib diisi minimal 3 karakter.');
    }

    if (adjustment.amount <= 0) {
      throw new Error('Nominal penyesuaian harus lebih besar dari 0.');
    }

    const wallet = await this.getWallet(targetUserId);
    const user = await this.resolveUser(targetUserId);
    const now = new Date().toISOString();
    const balanceBefore = wallet.creditBalance;

    let balanceAfter: number;
    let creditIn = 0;
    let creditOut = 0;
    let txType: CreditTransactionType;
    let signedAmount: number;

    if (adjustment.type === 'ADD') {
      balanceAfter = balanceBefore + adjustment.amount;
      creditIn = adjustment.amount;
      txType = 'ADMIN_ADD';
      signedAmount = adjustment.amount;
      wallet.totalCreditPurchased += adjustment.amount;
    } else {
      if (wallet.creditBalance < adjustment.amount) {
        throw new Error(`Saldo pengguna (${wallet.creditBalance}) tidak mencukupi untuk dikurangi sejumlah ${adjustment.amount}.`);
      }
      balanceAfter = balanceBefore - adjustment.amount;
      creditOut = adjustment.amount;
      txType = 'ADMIN_DEDUCT';
      signedAmount = -adjustment.amount;
    }

    wallet.creditBalance = balanceAfter;
    wallet.updatedAt = now;

    const tx: CreditTransaction = {
      id: `CTX-${Date.now().toString().slice(-8)}`,
      userId: targetUserId,
      userName: user?.fullName || 'User',
      email: user?.email || '',
      type: txType,
      amount: signedAmount,
      creditIn,
      creditOut,
      balanceBefore,
      balanceAfter,
      referenceId: `ADJ-${Date.now().toString().slice(-6)}`,
      description: `[Penyesuaian Admin] ${adjustment.reason.trim()} (oleh ${adminName})`,
      adminId,
      adminName,
      createdAt: now,
    };
    this.transactions.unshift(tx);

    console.log(`[CREDIT SERVICE] Admin ${adminName} adjusted credit for ${targetUserId}: ${adjustment.type} ${adjustment.amount}. Balance: ${balanceBefore} -> ${balanceAfter}`);

    return {
      success: true,
      wallet,
      transaction: tx,
    };
  }

  /**
   * Get Top Up Requests with optional filtering
   */
  public getTopUpRequests(filters?: { status?: string; userId?: string; search?: string }): TopUpRequest[] {
    let list = Array.from(this.topups.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filters?.userId) {
      list = list.filter((t) => t.userId === filters.userId);
    }
    if (filters?.status && filters.status !== 'ALL') {
      list = list.filter((t) => t.status === filters.status);
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.userName.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          t.userId.toLowerCase().includes(q)
      );
    }
    return list;
  }

  /**
   * Get Credit Transactions Ledger
   */
  public getCreditTransactions(filters?: { userId?: string; type?: string; search?: string }): CreditTransaction[] {
    let list = [...this.transactions];

    if (filters?.userId) {
      list = list.filter((t) => t.userId === filters.userId);
    }
    if (filters?.type && filters.type !== 'ALL') {
      list = list.filter((t) => t.type === filters.type);
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          (t.userName && t.userName.toLowerCase().includes(q)) ||
          (t.email && t.email.toLowerCase().includes(q)) ||
          (t.referenceId && t.referenceId.toLowerCase().includes(q))
      );
    }
    return list;
  }

  /**
   * Get AI Analysis History
   */
  public getAiAnalysisHistory(filters?: { userId?: string; symbol?: string; search?: string }): AiAnalysisHistoryRecord[] {
    let list = [...this.analysisHistory];

    if (filters?.userId) {
      list = list.filter((a) => a.userId === filters.userId);
    }
    if (filters?.symbol && filters.symbol !== 'ALL') {
      list = list.filter((a) => a.symbol === filters.symbol);
    }
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.id.toLowerCase().includes(q) ||
          a.symbol.toLowerCase().includes(q) ||
          (a.userName && a.userName.toLowerCase().includes(q)) ||
          (a.email && a.email.toLowerCase().includes(q))
      );
    }
    return list;
  }

  /**
   * Payment Settings
   */
  public getPaymentSettings(): PaymentSettings {
    return this.paymentSettings;
  }

  public updatePaymentSettings(settings: Partial<PaymentSettings>): PaymentSettings {
    this.paymentSettings = {
      ...this.paymentSettings,
      ...settings,
      updatedAt: new Date().toISOString(),
    };
    console.log('[CREDIT SERVICE] Payment settings updated:', this.paymentSettings);
    return this.paymentSettings;
  }

  /**
   * Admin Aggregated Dashboard Metrics
   */
  public getAdminCreditStats(): AdminCreditStats {
    const topups = Array.from(this.topups.values());
    const wallets = Array.from(this.wallets.values());

    const totalCreditSoldIdr = topups
      .filter((t) => t.status === 'CONFIRMED')
      .reduce((sum, t) => sum + t.amountIdr, 0);

    const creditInUserWallets = wallets.reduce((sum, w) => sum + w.creditBalance, 0);
    const totalCreditUsed = wallets.reduce((sum, w) => sum + w.totalCreditUsed, 0);
    const totalAiAnalysis = wallets.reduce((sum, w) => sum + w.totalAnalysis, 0);

    const pendingTopups = topups.filter((t) => t.status === 'PENDING');
    const pendingTopUpCount = pendingTopups.length;
    const pendingTopUpAmountIdr = pendingTopups.reduce((sum, t) => sum + t.amountIdr, 0);

    return {
      totalCreditSoldIdr,
      creditInUserWallets,
      totalCreditUsed,
      totalAiAnalysis,
      pendingTopUpCount,
      pendingTopUpAmountIdr,
    };
  }

  /**
   * Get all User Wallets combined with profile metadata for Admin View
   */
  public async getAllUserWalletsWithUsers(search?: string): Promise<UserWalletWithProfile[]> {
    let usersList: any[] = [];
    try {
      usersList = await prisma.user.findMany();
    } catch {
      usersList = [
        { id: 'usr-admin-001', fullName: 'Master Admin SPILLA', email: 'admin@spillagold.com', role: 'ADMIN', status: 'ACTIVE', accountType: 'Master Admin' },
        { id: 'usr-trader-002', fullName: 'Institutional Trader', email: 'trader@spillagold.com', role: 'USER', status: 'ACTIVE', accountType: 'Trader Institusi' },
      ];
    }

    const results: UserWalletWithProfile[] = [];

    for (const u of usersList) {
      const wallet = await this.getWallet(u.id);
      const userTxs = this.transactions.filter((t) => t.userId === u.id);
      const lastTx = userTxs.length > 0 ? userTxs[0].createdAt : undefined;

      results.push({
        ...wallet,
        userName: u.fullName,
        email: u.email,
        role: u.role,
        status: u.status,
        accountType: u.accountType,
        lastTransactionDate: lastTx,
      });
    }

    if (search && search.trim()) {
      const q = search.toLowerCase().trim();
      return results.filter(
        (r) =>
          r.userName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          r.userId.toLowerCase().includes(q)
      );
    }

    return results;
  }
}

export const creditService = new CreditService();
