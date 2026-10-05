import { Router } from 'express';
import { web3Middleware } from '../middleware/auth.js';
import { startSession, getState, revealCard, openAllCards, resetRound } from '../controllers/gameController.js';

const router = Router();

router.post('/start', web3Middleware, startSession);
router.get('/state', web3Middleware, getState);
router.post('/reveal', web3Middleware, revealCard);
router.post('/open-all', web3Middleware, openAllCards);
router.post('/reset', web3Middleware, resetRound);

export default router;
