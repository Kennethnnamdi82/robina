import { signMessage } from "wagmi/actions";
import { wagmiConfig } from "./wagmi";
import { SiweMessage } from "siwe";
import { getAddress } from "viem";

export async function buildAndSignSiwe(
  address: `0x${string}`,
  nonce: string,
  chainId: number,
  domain: string,
  uri: string,
  expirationTime: string,
) {
  // Use the official library to ensure perfect EIP-4361 formatting
  const siweMessage = new SiweMessage({
    domain,
    address: getAddress(address), // Critical for signature math
    statement: "Sign in to Robina.",
    uri,
    version: "1",
    chainId,
    nonce,
    // The server issues and persists this exact expiry alongside the nonce.
    // Signing it binds the signature to the one-time challenge and satisfies
    // the EIP-4361 freshness checks performed before the nonce is consumed.
    expirationTime,
  });

  const prepared = siweMessage.prepareMessage();

  const signature = await signMessage(wagmiConfig, {
    message: prepared,
    account: address,
  });

  return { message: prepared, signature };
}
