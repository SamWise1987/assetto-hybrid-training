export function notificationRealtimeScope(userId: string) {
  return {
    channel: `app-notifications-${userId}`,
    filter: `recipient_user_id=eq.${userId}`,
  };
}

export function notificationRealtimeChanges(userId: string) {
  return {
    event: "*",
    schema: "public",
    table: "app_notifications",
    filter: notificationRealtimeScope(userId).filter,
  } as const;
}

interface RuntimeRealtimeChannel {
  on: (
    type: "postgres_changes",
    changes: ReturnType<typeof notificationRealtimeChanges>,
    callback: () => void,
  ) => RuntimeRealtimeChannel;
  subscribe: () => RuntimeRealtimeChannel;
}

interface RuntimeRealtimeClient {
  channel: (name: string) => RuntimeRealtimeChannel;
  removeChannel: (channel: RuntimeRealtimeChannel) => unknown;
}

/** Limita gli eventi Realtime al solo destinatario autenticato. */
export function subscribeToUserNotifications(
  client: unknown,
  userId: string,
  callback: () => void,
) {
  if (!client) return null;

  const runtimeClient = client as RuntimeRealtimeClient;
  const scope = notificationRealtimeScope(userId);

  return runtimeClient
    .channel(scope.channel)
    .on("postgres_changes", notificationRealtimeChanges(userId), callback)
    .subscribe();
}

export function removeUserNotificationChannel(
  client: unknown,
  channel: RuntimeRealtimeChannel | null,
) {
  if (!client || !channel) return;
  (client as RuntimeRealtimeClient).removeChannel(channel);
}
