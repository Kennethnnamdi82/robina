import { ArrowUpRight, Eye, Music2, ShieldCheck } from 'lucide-react';
import { money, type BountySubmission, type BountyTask } from './model';
import { StatusBadge } from './BountyUI';

export default function TaskCard({ task, submission, onOpen }: {
  task: BountyTask; submission?: BountySubmission; onOpen: (task: BountyTask, trigger: HTMLButtonElement) => void;
}) {
  return <article className="rb-task" data-platform={task.platform} tabIndex={-1} aria-label={`${task.platform === 'x' ? 'X' : 'TikTok'} bounty`}>
    <div className="rb-task-head"><span className="rb-platform">{task.platform === 'x' ? <b aria-hidden="true">X</b> : <Music2 size={25}/>}<span>{task.platform === 'x' ? 'X / TWITTER' : 'TIKTOK'}<small>CREATOR CONTRACT</small></span></span><StatusBadge status={submission?.status ?? task.submissionStatus ?? task.status}/></div>
    <h3>{task.title}</h3><p>{task.description}</p>
    <div className="rb-requirement"><Eye size={16}/><span>{task.requirement}<small>ORIGINAL CONTENT / MANUAL REVIEW</small></span></div>
    <div className="rb-task-reward"><div><small>CONTRACT REWARD</small><strong>{money(task.rewardMicros)} <span>USDC</span></strong></div><ShieldCheck size={25}/></div>
    <button className="rh-secondary rb-wide" disabled={!!submission || task.submitted || task.status !== 'active'} onClick={event => onOpen(task, event.currentTarget)}>
      {submission || task.submitted ? 'ALREADY SUBMITTED' : task.status !== 'active' ? 'BOUNTY CLOSED' : 'VIEW TASK / SUBMIT'}<ArrowUpRight size={17}/>
    </button>
    <small className="rb-fineprint">{submission || task.submitted ? 'Track this contract in My Bounties. One submission per player.' : 'Read the brief and disclosure rules before you publish.'}</small>
  </article>;
}
