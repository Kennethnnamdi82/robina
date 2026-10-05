import { Router } from 'express';
import { web3Middleware } from '../middleware/auth.js';
import { getNonce, verifySiwe, logout, me } from '../controllers/authController.js';

const router = Router();

router.get('/nonce', getNonce);
router.post('/verify', verifySiwe);
router.post('/logout', logout);
router.get('/me', web3Middleware, me);

export default router;