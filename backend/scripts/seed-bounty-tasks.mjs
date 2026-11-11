import mongoose from 'mongoose';
import { connectMongo } from '../src/db/mongo.js';
import { initializeBounties, BountyTask } from '../src/bounties/models.js';
import { createTask } from '../src/bounties/service.js';

// Explicit operator action only. Creates DRAFTS; never publishes rewards or sends funds.
if (!process.argv.includes('--create-drafts')) {
  console.error('Usage: node scripts/seed-bounty-tasks.mjs --create-drafts');
  process.exitCode = 1;
} else {
  try {
    await connectMongo(); await initializeBounties();
    for (const platform of ['x', 'tiktok']) {
      const title = platform === 'x' ? 'RIVALS Original X Post' : 'RIVALS Original TikTok Video';
      if (await BountyTask.exists({ 'terms.title': title })) { console.log(`${title}: already exists`); continue; }
      const task = await createTask('operator:seed-bounty-tasks', {
        title, platform,
        description: platform === 'x' ? 'Create an original promotional post about RIVALS.' : 'Create an original RIVALS promotional video.',
        instructions: ['Create original content using your own account.', 'Clearly disclose that you may receive a reward for the promotion.',
          'Reach 5,000 genuine impressions/views. Purchased or automated engagement is ineligible.',
          'Submit the full post URL and evidence of ownership and engagement analytics. A link or screenshot alone does not guarantee approval.'],
        disclosure: 'Include a clear, prominent promotional disclosure such as #ad, plus any platform-specific paid promotion disclosure required for your content.',
        minimumEngagement: 5000, rewardMicros: platform === 'x' ? '10000000' : '5000000',
        // Small explicit draft budget. Admin MUST review budget/funding before publishing.
        budgetMicros: platform === 'x' ? '100000000' : '50000000', participationLimit: 10, evidenceRequired: true,
      });
      console.log(`${title}: draft ${task._id}`);
    }
  } catch (error) {
    console.error(error.code || 'bounty_seed_failed'); process.exitCode = 1;
  } finally { await mongoose.disconnect(); }
}
