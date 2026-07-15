export function notificationDedupeKey(input: {
  recipientUserId: string;
  type: string;
  entityId: string;
  revision?: string | number;
}) {
  const parts = [input.recipientUserId, input.type, input.entityId];
  if (input.revision !== undefined) parts.push(String(input.revision));
  return parts.map((part) => encodeURIComponent(part)).join(":");
}
