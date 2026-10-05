import { Router } from "express";
import { login, logout, me } from "../controllers/adminAuthController.js";

const router = Router();

// Only Email/Password routes allowed here
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", me);

export default router;
