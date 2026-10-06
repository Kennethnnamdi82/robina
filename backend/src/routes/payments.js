import { Router } from 'express';
import { web3Middleware } from '../middleware/auth.js';
import { quote, verifyPayment, upgradeWithBd, createPaymentIntent, verifyPaymentIntent } from '../controllers/paymentsController.js';

const router = Router();

router.get('/quote', web3Middleware, quote);
router.post('/intents', web3Middleware, createPaymentIntent);
router.post('/verify-intent', web3Middleware, verifyPaymentIntent);
router.post('/verify', web3Middleware, verifyPayment);
router.post('/upgrade-bd', web3Middleware, upgradeWithBd);

export default router;
