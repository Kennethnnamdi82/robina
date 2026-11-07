import {NativeGrant} from '../models/NativeGrant.js';
import {User} from '../models/User.js';
import {publicUser} from './authController.js';
import {signSession,setSessionCookie} from '../middleware/auth.js';
import {createNativeGrant,grantDigest,nativeChallenge,validNativeParameter} from '../services/nativeGrant.js';

export async function authorizeNative(req,res,next){
  try{
    const {challenge,state}=req.body||{};
    if(!validNativeParameter(challenge)||!validNativeParameter(state))return res.status(400).json({error:'invalid_native_request'});
    const user=await User.findOne({wallet:req.wallet});if(!user)return res.status(401).json({error:'unauthenticated'});
    const grant=createNativeGrant(challenge,state);
    await NativeGrant.create({digest:grant.digest,challenge,wallet:req.wallet,sessionVersion:Number(user.sessionVersion||0),expiresAt:grant.expiresAt});
    return res.json({redirectUrl:grant.redirectUrl});
  }catch(error){next(error);}
}
export async function exchangeNative(req,res,next){
  try{
    const {code,verifier}=req.body||{};
    if(!validNativeParameter(code)||!validNativeParameter(verifier))return res.status(400).json({error:'invalid_native_request'});
    // The verifier is retained only by Android Keystore-backed native code.
    // Matching and consuming the grant is one atomic database operation.
    const grant=await NativeGrant.findOneAndDelete({digest:grantDigest(code),challenge:nativeChallenge(verifier),expiresAt:{$gt:new Date()}});
    if(!grant)return res.status(401).json({error:'native_grant_expired_or_used'});
    const user=await User.findOne({wallet:grant.wallet});
    if(!user||Number(user.sessionVersion||0)!==grant.sessionVersion)return res.status(401).json({error:'invalid_token'});
    if(user.accountStatus==='suspended'&&(!user.suspendedUntil||new Date(user.suspendedUntil)>new Date()))return res.status(403).json({error:'account_suspended'});
    setSessionCookie(res,signSession(grant.wallet,Number(user.sessionVersion||0)));
    return res.json({ok:true,user:publicUser(user)});
  }catch(error){next(error);}
}
