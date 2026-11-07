import { Router } from 'express';
import { web3Middleware } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { getNonce, verifySiwe, walletLogin, googleLogin, logout, me } from '../controllers/authController.js';
import {authorizeNative,exchangeNative} from '../controllers/nativeAuthController.js';

const router = Router();

const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
router.get('/nonce', authRateLimit, getNonce);
router.post('/verify', authRateLimit, verifySiwe);
router.post('/wallet', authRateLimit, walletLogin);
router.post('/google', authRateLimit, googleLogin);
router.post('/logout', logout);
router.get('/me', web3Middleware, me);
router.post('/native/authorize',web3Middleware,authRateLimit,authorizeNative);
router.post('/native/exchange',authRateLimit,exchangeNative);

export default router;
