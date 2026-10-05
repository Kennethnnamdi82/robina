import { Router } from 'express';
import { web3Middleware } from '../middleware/auth.js';
import { getCatalogue, getMine, submitTask, startTask, claimTask, startAutoTask, claimAutoTask } from '../controllers/tasksController.js';

const router = Router();

router.get('/catalogue', web3Middleware, getCatalogue);
router.get('/mine', web3Middleware, getMine);
router.post('/submit', web3Middleware, submitTask);
router.post('/start', web3Middleware, startTask);
router.post('/claim', web3Middleware, claimTask);
router.post('/start-auto', web3Middleware, startAutoTask);
router.post('/claim-auto', web3Middleware, claimAutoTask);

export default router;
