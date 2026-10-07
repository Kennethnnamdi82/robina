export function isSessionVersionCurrent(tokenVersion, userVersion) {
  const currentUserVersion = userVersion ?? 0;
  return (
    Number.isSafeInteger(tokenVersion) &&
    Number.isSafeInteger(currentUserVersion) &&
    tokenVersion === currentUserVersion
  );
}
