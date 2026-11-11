import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { dateLabel, money, STATUS_LABELS, type BountySubmission, type SubmissionStatus } from './model';
import { ExternalLink, StatusBadge } from './BountyUI';

export default function MyBounties({ submissions }: { submissions: BountySubmission[] }) {
  const [filter, setFilter] = useState<SubmissionStatus | 'all'>('all');
  const shown = submissions.filter(s => filter === 'all' || s.status === filter);
  return <section className="rb-section" id="my-bounties" aria-labelledby="rb-my-title">
    <div className="rb-section-heading"><div><span className="rh-eyebrow">YOUR CREATOR RECORD</span><h2 id="rb-my-title">MY BOUNTIES</h2></div><span>{submissions.length.toString().padStart(2, '0')} SUBMITTED</span></div>
    <div className="rb-filters" role="group" aria-label="Submission status filter">
      {(['all', 'pending_review', 'approved', 'rejected', 'completed'] as const).map(status => <button key={status} aria-pressed={filter === status} onClick={() => setFilter(status)}>{status === 'all' ? 'All' : STATUS_LABELS[status]}</button>)}
    </div>
    {!shown.length ? <div className="rb-empty"><ClipboardList size={27}/><h3>{submissions.length ? 'NO MATCHING SUBMISSIONS' : 'YOUR NEXT MOVE STARTS HERE'}</h3><p>{submissions.length ? 'Choose another status to see your bounty history.' : 'Open a contract, read the brief and submit your content. Your review history will stay here.'}</p></div> : <div className="rb-submissions">{shown.map(submission => <article className="rb-submission" key={submission.id}>
      <div className="rb-submission-title"><div><small>{submission.platform === 'x' ? 'X / TWITTER' : 'TIKTOK'} / CREATOR CONTRACT</small><h3>{submission.taskTitle}</h3></div><StatusBadge status={submission.status}/></div>
      <div className="rb-submission-meta"><strong>{money(submission.rewardMicros)} <span>USDC</span></strong><time dateTime={submission.submittedAt}>{dateLabel(submission.submittedAt)}</time><ExternalLink href={submission.postUrl}>View submission</ExternalLink>{submission.evidenceUrl && <ExternalLink href={submission.evidenceUrl}>View evidence</ExternalLink>}</div>
      {submission.status === 'pending_review' && <p>Awaiting review. The listed reward is not an available balance.</p>}
      {submission.status === 'approved' && <p>Approved for reward processing. Credit is not yet confirmed.</p>}
      {submission.status === 'completed' && <p>Reward credited. This contract is complete and cannot be repeated.</p>}
      {submission.status === 'rejected' && <p className="rb-rejection"><strong>Review reason:</strong> {submission.rejectionReason || 'No reason supplied. Contact support when live reviews are available.'} This contract cannot be resubmitted.</p>}
    </article>)}</div>}
  </section>;
}
