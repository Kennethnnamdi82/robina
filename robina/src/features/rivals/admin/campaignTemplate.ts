import type { TaskInput } from '@/services/bounties';
/** Form presets only: never published or treated as available server tasks. */
export function campaignTemplate(platform: 'x' | 'tiktok'): TaskInput {
  return { title: platform === 'x' ? 'RIVALS Original X Post' : 'RIVALS Original TikTok Video', platform,
    description: platform === 'x' ? 'Create an original promotional post about RIVALS.' : 'Create an original RIVALS promotional video.',
    instructions: ['Create original RIVALS content using your own account.', 'Clearly disclose that you may receive a promotional reward.',
      'Reach 5,000 genuine impressions/views. Purchased or automated engagement is ineligible.',
      'Provide a full post URL, account ownership evidence and engagement analytics for independent review.'],
    disclosure: 'Include a clear, prominent paid-promotion disclosure, such as #ad, and use any applicable platform paid-promotion disclosure tools.',
    minimumEngagement: 5000, evidenceRequired: true, startsAt: null, expiresAt: null };
}
