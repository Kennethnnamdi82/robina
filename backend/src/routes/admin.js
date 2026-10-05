import { Router } from "express";
import { tryAdminCookie } from "../controllers/adminAuthController.js";
import { RevokedToken } from "../models/RevokedToken.js";
import {
  listUsers,
  listPayments,
  listTasks,
  reviewTask,
  adminLeaderboard,
  analytics,
  listSeasons,
  startSeason,
  endCurrentSeason,
  createTaskDefinition,
  updateTaskDefinition,
  deleteTaskDefinition,
  suspendUser,
  reactivateUser,
  addUserBdBalance,
  deleteUser,
  getTreasureRewardState,
  resetAllUserTreasures,
  listActivity,
  listLoginSessions,
  activitySummary,
  reduceUserBdBalance,
} from "../controllers/adminController.js";

const router = Router();

async function adminAuth(req, res, next) {
  const admin = tryAdminCookie(req);
  if (!admin) return res.status(401).json({ error: "unauthenticated" });
  if (admin.jti) {
    const revoked = await RevokedToken.exists({ jti: admin.jti });
    if (revoked) return res.status(401).json({ error: "token_revoked" });
  }
  req.admin = admin;
  return next();
}

router.use(adminAuth);

router.get("/users", listUsers);
router.post("/users/suspend", suspendUser);
router.post("/users/reactivate", reactivateUser);
router.post("/users/add-bd", addUserBdBalance);
router.post("/users/reduce-bd", reduceUserBdBalance);
router.post("/users/delete", deleteUser);
router.get("/payments", listPayments);
router.get("/tasks", listTasks);
router.post("/tasks/definitions", createTaskDefinition);
router.patch("/tasks/definitions/:taskId", updateTaskDefinition);
router.delete("/tasks/definitions/:taskId", deleteTaskDefinition);
router.post("/tasks/review", reviewTask);
router.get("/seasons", listSeasons);
router.post("/seasons/start", startSeason);
router.post("/seasons/end-current", endCurrentSeason);
router.post("/seasons/reset-treasures", resetAllUserTreasures);
router.get("/treasure-rewards/state", getTreasureRewardState);
router.get("/leaderboard", adminLeaderboard);
router.get("/analytics", analytics);
router.get("/activity", listActivity);
router.get("/login-sessions", listLoginSessions);
router.get("/activity-summary", activitySummary);

export default router;
