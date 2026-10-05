import { User } from '../models/User.js';
import { Season } from '../models/Season.js';
import { syncSeasonStates } from '../services/seasonLifecycle.js';

export async function getLeaderboard(req, res) {
  await syncSeasonStates();

  const activeSeason = await Season.findOne({ status: "active" }).sort({
    startDate: -1,
  });

  const page = Math.max(1, Number.parseInt(String(req.query.page || "1"), 10) || 1);
  const limit = Math.min(
    50,
    Math.max(1, Number.parseInt(String(req.query.limit || "10"), 10) || 10),
  );

  if (!activeSeason) {
    return res.json({
      seasonComingSoon: true,
      activeSeason: null,
      leaderboard: [],
      page: 1,
      limit,
      total: 0,
      totalPages: 1,
    });
  }

  const skip = (page - 1) * limit;
  const total = await User.countDocuments({});
  const top = await User.find({})
    .sort({ bdBalance: -1 })
    .skip(skip)
    .limit(limit)
    .select("wallet bdBalance level");
  res.json({
    seasonComingSoon: false,
    activeSeason: {
      id: activeSeason._id,
      name: activeSeason.name,
      startDate: activeSeason.startDate,
      endDate: activeSeason.endDate,
    },
    leaderboard: top.map((u, i) => ({
      rank: skip + i + 1, wallet: u.wallet, bd: u.bdBalance, level: u.level,
    })),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}
