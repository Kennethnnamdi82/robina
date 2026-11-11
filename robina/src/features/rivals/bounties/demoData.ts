import { USDC, type BountyTask, type DemoState } from './model';

// Temporary frontend fixtures, NOT live admin campaigns or funded offers.
export const DEMO_TASKS: BountyTask[] = [
  {
    id: 'rivals-x-launch-v1', platform: 'x', title: 'MAKE THE CITY TALK', status: 'active',
    description: 'Create an original promotional post about RIVALS on X.',
    requirement: '5,000 genuine impressions', rewardMicros: 10 * USDC, evidenceRequired: true,
    instructions: [
      'Publish an original, public X post about RIVALS: Rival Heist. Share your own gameplay, perspective or creative hook.',
      'Keep the post public and reach at least 5,000 genuine impressions. Purchased engagement, bots and copied content are not eligible.',
      'Include a link to https://rivals-heist.vercel.app so players can find the game.',
      'Provide a shareable HTTPS link to a screenshot of your post analytics showing the post and impression count. Remove private account details; reviewers must be able to open the evidence.',
    ],
    disclosure: 'Clearly disclose that this is an incentivized promotional post. Put “Ad” or “#ad” prominently in the post, and follow the platform’s promotional-content rules. Do not hide the disclosure among hashtags.',
  },
  {
    id: 'rivals-tiktok-launch-v1', platform: 'tiktok', title: 'CUT YOUR OWN TRAILER', status: 'active',
    description: 'Create an original RIVALS promotional video on TikTok.',
    requirement: '5,000 genuine views', rewardMicros: 5 * USDC, evidenceRequired: true,
    instructions: [
      'Create an original, public TikTok video featuring RIVALS: Rival Heist. Use your own footage, edit and voice.',
      'Reach at least 5,000 genuine views. Bought views, engagement exchanges and reuploaded videos are not eligible.',
      'Tell viewers where to play: rivals-heist.vercel.app. Use only music and footage you have permission to publish.',
      'Provide a shareable HTTPS link to a screenshot of video analytics showing the video and view count. Remove private account details.',
    ],
    disclosure: 'Clearly disclose the incentive with “Ad” or “#ad” in the caption and a visible in-video disclosure. Use TikTok’s promotional-content disclosure tools where applicable and follow its platform rules.',
  },
];
export function emptyDemoState(): DemoState {
  return {
    version: 1, submissions: [], withdrawals: [],
    wallet: { availableMicros: 0, earnedMicros: 0, withdrawnMicros: 0, address: '' },
    notifications: DEMO_TASKS.map(task => ({
      id: `published-${task.id}`, kind: 'published', title: 'New bounty published',
      message: `${task.platform === 'x' ? 'X' : 'TikTok'} demo contract: ${task.title}.`,
      createdAt: '2026-11-11T00:00:00.000Z', read: false,
    })),
  };
}
