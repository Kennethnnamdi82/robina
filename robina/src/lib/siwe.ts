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
) {
  // Use the official library to ensure perfect EIP-4361 formatting
  const siweMessage = new SiweMessage({
    domain,
    address: getAddress(address), // Critical for signature math
    statement: "Sign in to Robina.",
    uri,
    version: "1",
    chainId,
    nonce: nonce,
  });

  const prepared = siweMessage.prepareMessage();

  const signature = await signMessage(wagmiConfig, {
    message: prepared,
    account: address,
  });

  return { message: prepared, signature };
}
