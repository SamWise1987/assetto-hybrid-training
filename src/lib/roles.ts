import type { UserRole } from "./types";

export function isStaffRole(role?: UserRole | null) {
  return role === "admin" || role === "coach";
}

export function canManagePlans(role?: UserRole | null) {
  return isStaffRole(role);
}

export function parseAdminEmails(raw?: string) {
  return (raw ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function roleFromEmail(email: string, configuredRole?: UserRole | null): UserRole {
  if (configuredRole) return configuredRole;
  const admins = parseAdminEmails(process.env.ASSETTO_ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_ADMIN_EMAILS);
  if (admins.includes(email.toLowerCase())) return "admin";
  return "athlete";
}
