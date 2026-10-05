import { Router } from 'express';
import { web3Middleware } from '../middleware/auth.js';
import { quote, verifyPayment, upgradeWithBd } from '../controllers/paymentsController.js';

const router = Router();

router.get('/quote', web3Middleware, quote);
router.post('/verify', web3Middleware, verifyPayment);
router.post('/upgrade-bd', web3Middleware, upgradeWithBd);

export default router;