import crypto from 'node:crypto';
export const NATIVE_REDIRECT='https://rivals-heist.vercel.app/android/auth/callback';
export const nativeChallenge=verifier=>crypto.createHash('sha256').update(verifier).digest('base64url');
export const grantDigest=code=>crypto.createHash('sha256').update(code).digest('hex');
export const validNativeParameter=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
export function createNativeGrant(challenge,state,now=Date.now()){
  if(!validNativeParameter(challenge)||!validNativeParameter(state))throw Error('invalid_native_request');
  const code=crypto.randomBytes(32).toString('base64url');
  return{code,digest:grantDigest(code),challenge,expiresAt:new Date(now+120000),redirectUrl:NATIVE_REDIRECT+'?'+new URLSearchParams({code,state})};
}
