type AccessTokenGetter = () => Promise<string | null>;

export async function getAccessTokenAfterLogin(
  getAccessToken: AccessTokenGetter,
  wait: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 250)),
  maxAttempts = 5,
): Promise<string | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const token = await getAccessToken();
    if (token) return token;
    if (attempt < maxAttempts - 1) await wait();
  }
  return null;
}
