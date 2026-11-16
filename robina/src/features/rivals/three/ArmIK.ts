import { Quaternion, Vector3, type Object3D } from 'three';

/** Small analytic two-bone solve. It changes pose, never the physical body. */
export class ArmIK {
  private shoulder = new Vector3(); private elbow = new Vector3(); private wrist = new Vector3();
  private axis = new Vector3(); private pole = new Vector3(); private desiredElbow = new Vector3();
  private from = new Vector3(); private to = new Vector3(); private turn = new Quaternion();
  private parent = new Quaternion(); private world = new Quaternion();
  constructor(readonly upper: Object3D, readonly lower: Object3D, readonly hand: Object3D) {}
  /** Translate a held item's anchor into the support arm's reachable volume,
   * instead of stretching the skin or leaving the support hand floating. */
  reachOffset(target:Vector3,out:Vector3){
    this.upper.updateWorldMatrix(true,true);this.upper.getWorldPosition(this.shoulder);
    this.lower.getWorldPosition(this.elbow);this.hand.getWorldPosition(this.wrist);
    const reach=(this.shoulder.distanceTo(this.elbow)+this.elbow.distanceTo(this.wrist))*.98;
    out.subVectors(target,this.shoulder);const distance=out.length();
    return distance>reach&&distance>1e-5?out.multiplyScalar(reach/distance-1):out.set(0,0,0);
  }
  solve(target: Vector3, elbowHint: Vector3) {
    this.upper.updateWorldMatrix(true, true);
    this.upper.getWorldPosition(this.shoulder); this.lower.getWorldPosition(this.elbow); this.hand.getWorldPosition(this.wrist);
    const a = this.shoulder.distanceTo(this.elbow), b = this.elbow.distanceTo(this.wrist);
    this.axis.subVectors(target, this.shoulder); const distance = this.axis.length();
    if (a < 1e-5 || b < 1e-5 || distance < 1e-5) return false;
    this.axis.divideScalar(distance);
    this.pole.subVectors(elbowHint, this.shoulder).addScaledVector(this.axis, -this.pole.dot(this.axis));
    if (this.pole.lengthSq() < 1e-6) this.pole.set(1, 0, 0).addScaledVector(this.axis, -this.axis.x);
    if (this.pole.lengthSq() < 1e-6) this.pole.set(0, 0, 1).addScaledVector(this.axis, -this.axis.z);
    this.pole.normalize();
    const reach = Math.max(Math.abs(a - b) + .0001, Math.min(a + b - .0001, distance));
    const cosine = Math.max(-1, Math.min(1, (a * a + reach * reach - b * b) / (2 * a * reach)));
    this.desiredElbow.copy(this.shoulder).addScaledVector(this.axis, a * cosine).addScaledVector(this.pole, a * Math.sqrt(Math.max(0, 1 - cosine * cosine)));
    this.rotate(this.upper, this.elbow, this.desiredElbow);
    this.lower.getWorldPosition(this.elbow); this.hand.getWorldPosition(this.wrist);
    this.to.copy(this.shoulder).addScaledVector(this.axis, reach);
    this.rotate(this.lower, this.wrist, this.to);
    return distance <= a + b + .001;
  }
  private rotate(bone: Object3D, current: Vector3, target: Vector3) {
    bone.getWorldPosition(this.from);
    this.to.subVectors(target, this.from).normalize(); this.from.subVectors(current, this.from).normalize();
    this.turn.setFromUnitVectors(this.from, this.to); bone.getWorldQuaternion(this.world).premultiply(this.turn);
    bone.parent!.getWorldQuaternion(this.parent).invert(); bone.quaternion.copy(this.parent.multiply(this.world)).normalize(); bone.updateMatrixWorld(true);
  }
}

export function setWorldRotation(node: Object3D, rotation: Quaternion, scratch: Quaternion) {
  node.parent!.getWorldQuaternion(scratch).invert(); node.quaternion.copy(scratch.multiply(rotation)).normalize(); node.updateMatrixWorld(true);
}
