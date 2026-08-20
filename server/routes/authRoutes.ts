import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'spilla_gold_institutional_jwt_secret_2026';

/**
 * POST /api/auth/register
 * Handles User and Admin Registration
 */
authRouter.post('/register', async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword, accountType, role } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Nama lengkap, email, dan password wajib diisi.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password minimal harus 6 karakter.',
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Konfirmasi password tidak cocok dengan password.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check existing email in Prisma DB
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email sudah terdaftar. Silakan login atau gunakan email lain.',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Determine Role
    const assignedRole = role === 'ADMIN' ? 'ADMIN' : 'USER';
    const assignedAccountType = accountType || (assignedRole === 'ADMIN' ? 'Institutional Administrator' : 'Trader Individu');

    // Create user in Prisma DB
    const newUser = await prisma.user.create({
      data: {
        fullName: fullName.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: assignedRole,
        status: 'ACTIVE',
        accountType: assignedAccountType,
      },
    });

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Pendaftaran berhasil! Selamat datang di SPILLA GOLD Analysis Engine.',
      token,
      user: {
        id: newUser.id,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        accountType: newUser.accountType,
        createdAt: newUser.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Auth Register Error]', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mendaftar. Terjadi kesalahan server.',
      error: error?.message,
    });
  }
});

/**
 * POST /api/auth/login
 * Handles User and Admin Login
 */
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email dan password wajib diisi.',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Query user via Prisma ORM
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Email atau password salah.',
      });
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Email atau password salah.',
      });
    }

    // Check Status
    if (user.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda telah ditangguhkan/Banned oleh Administrator. Silakan hubungi support.',
      });
    }

    if (user.status === 'PENDING') {
      return res.status(403).json({
        success: false,
        message: 'Akun Anda masih dalam status PENDING persetujuan Admin.',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login berhasil! Mengakses SPILLA GOLD Analysis Engine...',
      token,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        accountType: user.accountType,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[Auth Login Error]', error);
    res.status(500).json({
      success: false,
      message: 'Gagal login. Terjadi kesalahan pada server.',
      error: error?.message,
    });
  }
});

/**
 * GET /api/auth/me
 * Returns profile for current authenticated token
 */
authRouter.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Token otentikasi tidak ditemukan.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }

    if (user.status === 'SUSPENDED') {
      return res.status(403).json({ success: false, message: 'Akun telah ditangguhkan.' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
        accountType: user.accountType,
        createdAt: user.createdAt.toISOString(),
      },
    });
  } catch (error) {
    res.status(401).json({ success: false, message: 'Sesi kedaluwarsa atau token tidak valid.' });
  }
});
