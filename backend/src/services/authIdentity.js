export function getVerifiedGoogleAccount(privyUser) {
  const accounts = Array.isArray(privyUser?.linked_accounts)
    ? privyUser.linked_accounts
    : [];
  const googleAccount = accounts.find((account) => account?.type === "google_oauth");
  const email = typeof googleAccount?.email === "string" ? googleAccount.email.trim() : "";
  if (!email) return null;
  return { email: email.toLowerCase() };
}
