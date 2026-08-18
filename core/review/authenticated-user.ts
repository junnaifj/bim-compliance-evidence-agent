export type AuthenticatedUser = { displayName: string; email: string; fullName: string | null };

export function authenticatedUserFromHeaders(headers: Headers): AuthenticatedUser | null {
  const email = headers.get("oai-authenticated-user-email");
  if (!email) return null;
  const encoded = headers.get("oai-authenticated-user-full-name");
  let fullName: string | null = null;
  if (encoded && headers.get("oai-authenticated-user-full-name-encoding") === "percent-encoded-utf-8") {
    try { fullName = decodeURIComponent(encoded); } catch { fullName = null; }
  }
  return { displayName: fullName ?? email, email, fullName };
}
