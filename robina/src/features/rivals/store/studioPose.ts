import { AnimationMixer, type AnimationClip, type Object3D } from 'three';
import { finishOperative } from '../three/OperativeFinish';

/** Freeze a genuine idle pose and use the same fabric finish as gameplay.
 * Operates on a privately loaded scene, never the running actor or cached rig. */
export function studioPose(root: Object3D, clips: readonly AnimationClip[], operative: boolean) {
  if (!operative) return;
  finishOperative(root);
  const clip = clips.find(c => c.name === 'Idle_Loop');
  if (!clip) return;
  const mixer = new AnimationMixer(root);
  mixer.clipAction(clip).play(); mixer.update(.5); root.updateMatrixWorld(true);
  // Preserve the evaluated pose. No timer, RAF or mixer remains active.
}
