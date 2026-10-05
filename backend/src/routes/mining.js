import { Router } from 'express';
import { web3Middleware } from '../middleware/auth.js';
import { claim, status } from '../controllers/miningController.js';

const router = Router();

router.post('/claim', web3Middleware, claim);
router.get('/status', web3Middleware, status);

export default router;