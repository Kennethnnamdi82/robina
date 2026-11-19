import { api } from './api';
import type {MissionPermit} from '@/features/rivals/authority/MissionReplay';
import type {VerifiedGameResult} from './missionAuthority';

export interface CompletionStatus {status:'missing'|'uploading'|'queued'|'verifying'|'verified'|'rejected';id:string;result?:VerifiedGameResult;error?:string;received?:number;total?:number}
export interface SavedMissionResult {sessionId:string;missionId:string;score:number;durationSeconds:number;verifiedAt:string;outcome:'success'|'failure';firstCompletion:boolean;rewardEligible:boolean;enemiesDefeated:number;shotsFired:number;successfulHits:number}

export interface MissionServerSession {
  _id: string;
  missionId: string;
  seed: number;
  authority: boolean;
  status: 'active' | 'abandoned' | 'expired' | 'reported' | 'failed' | 'verified_success' | 'verified_failure';
  reconnectDeadline: string;
  integrity: 'unverified' | 'verified';
}
export interface MissionEligibility {
  eligible: boolean;
  recoveryUntil: string | null;
  activeSession: MissionServerSession | null;
  serverTime: string;
}

export const missionsApi = {
  permit:(missionId:string,seed:number)=>api.post<{permit:MissionPermit}>('/api/missions/permits',{missionId,seed}),
  upload:(body:{permit:string;index:number;count:number;chunk:string})=>api.post<CompletionStatus>('/api/missions/completions',body),
  completion:(id:string)=>api.get<CompletionStatus>('/api/missions/completions/'+id),
  leaderboard: () => api.get<{ items: Array<{ missionId: string; score: number; durationSeconds: number; verifiedAt: string; player: string }> }>('/api/missions/leaderboard'),
  results: () => api.get<{ items: SavedMissionResult[] }>('/api/missions/results'),
  eligibility: () => api.get<MissionEligibility>('/api/missions/eligibility'),
  start: (missionId: string, seed?: number) => api.post<{ session: MissionServerSession }>('/api/missions/sessions', { missionId, seed }),
  connect: (id: string) => api.post<{ ticket: string; origin: string }>(`/api/missions/sessions/${id}/connect`),
  inspect: (id: string) => api.get<{ session: MissionServerSession; result: import('./missionAuthority').VerifiedGameResult | null; recoveryUntil: string | null }>(`/api/missions/sessions/${id}`),
  heartbeat: (id: string) => api.post<{ reconnectDeadline: string }>(`/api/missions/sessions/${id}/heartbeat`),
  abandon: (id: string) => api.post<{ session: MissionServerSession }>(`/api/missions/sessions/${id}/abandon`),
  report: (id: string, outcome: 'success' | 'failure') => api.post<{ session: MissionServerSession; integrity: 'unverified'; rewardEligible: false }>(`/api/missions/sessions/${id}/report`, { outcome }),
};
