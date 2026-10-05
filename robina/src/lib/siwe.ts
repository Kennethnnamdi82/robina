import { signMessage } from "wagmi/actions";
import { wagmiConfig, BASE_CHAIN_ID } from "./wagmi";
import { SiweMessage } from "siwe";
import { getAddress } from "viem";

export async function buildAndSignSiwe(address: `0x${string}`, nonce: string) {
  // Use the official library to ensure perfect EIP-4361 formatting
  const siweMessage = new SiweMessage({
    domain: window.location.host,
    address: getAddress(address), // Critical for signature math
    statement: "Sign in to BaseDrop with your Base wallet.",
    uri: window.location.origin,
    version: "1",
    chainId: BASE_CHAIN_ID,
    nonce: nonce,
  });

  const prepared = siweMessage.prepareMessage();

  const signature = await signMessage(wagmiConfig, {
    message: prepared,
    account: address,
  });

  return { message: prepared, signature };
}
