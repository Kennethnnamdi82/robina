import mongoose from 'mongoose';
import { MissionLife, MissionRecoveryEntitlement } from './models.js';

/** Called only by verified Phase 6 fulfillment; no public recovery bypass. */
export async function consumeVerifiedLifeRecovery(playerId, entitlementId) {
  if(!mongoose.isValidObjectId(playerId)||!mongoose.isValidObjectId(entitlementId))throw new Error('invalid_entitlement');
  const transaction=await mongoose.startSession();
  try{
    await transaction.withTransaction(async()=>{
      const now=new Date();
      const entitlement=await MissionRecoveryEntitlement.findOneAndUpdate({_id:entitlementId,playerId,status:'verified',expiresAt:{$gt:now}},
        {$set:{status:'consumed',consumedAt:now}},{new:true,session:transaction});
      if(!entitlement)throw new Error('entitlement_unavailable');
      const result=await MissionLife.updateOne({playerId,recoveryUntil:{$gt:now}},{$set:{recoveryUntil:null},$inc:{admissionVersion:1}},{session:transaction});
      if(!result.modifiedCount)throw new Error('life_not_recovering');
    });
    return {recovered:true};
  }finally{await transaction.endSession();}
}
