import type { AccountProfile, PreferredGreeting, UserProfile } from "./types";

export function getDisplayName(
  account?: Pick<AccountProfile, "displayName" | "email"> | null,
  profile?: Pick<UserProfile, "name"> | null,
  fallback = "Atleta",
) {
  const fromAccount = account?.displayName?.trim();
  if (fromAccount) return fromAccount;
  const fromProfile = profile?.name?.trim();
  if (fromProfile && fromProfile !== "Atleta") return fromProfile;
  const emailLocal = account?.email?.split("@")[0]?.trim();
  if (emailLocal) return emailLocal;
  if (fromProfile) return fromProfile;
  return fallback;
}

export function getWelcomeGreeting(
  name: string,
  form: PreferredGreeting = "neutral",
) {
  if (form === "benvenuto") return `Benvenuto ${name}`;
  if (form === "benvenuta") return `Benvenuta ${name}`;
  return `Benvenuto/a ${name}`;
}

export function greetingLabel(form: PreferredGreeting) {
  if (form === "benvenuto") return "Benvenuto";
  if (form === "benvenuta") return "Benvenuta";
  return "Benvenuto/a";
}
