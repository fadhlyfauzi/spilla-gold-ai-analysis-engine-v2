import { Router } from 'express';
import { db } from '../db/database.js';

export const copytradeRouter = Router();

/**
 * POST /api/copytrade/trader-login
 * Records trader copy trade login activity and returns redirect URL
 */
copytradeRouter.post('/trader-login', (req, res) => {
  try {
    const { identifier, accountNumber, password, brokerServer, masterName, redirectUrl } = req.body;

    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Username / Nama / Email wajib diisi.',
      });
    }

    if (!masterName || typeof masterName !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Master Copy Trade belum dipilih.',
      });
    }

    // Record login entry in database (WITHOUT storing password in plaintext)
    const newLog = db.addTraderLogin({
      identifier: identifier.trim(),
      accountNumber: accountNumber ? String(accountNumber).trim() : '-',
      brokerServer: brokerServer ? String(brokerServer).trim() : 'AIMS-Live',
      status: 'SUCCESS',
      selectedMaster: masterName.trim(),
    });

    db.addLog(
      'INFO',
      'COPY_TRADE',
      `Trader login successful for ${identifier.trim()} (${accountNumber || 'N/A'}) - Selected Master: ${masterName.trim()}`
    );

    res.json({
      success: true,
      message: 'Login trader berhasil. Mengalihkan ke link Master...',
      redirectUrl: redirectUrl || 'https://social.aimsxchange.com/portal/registration/subscription/82123/SpillaSeribu',
      record: newLog,
    });
  } catch (error: any) {
    console.error('[Trader Login Route Error]', error);
    res.status(500).json({
      success: false,
      message: 'Gagal memproses login trader.',
    });
  }
});
