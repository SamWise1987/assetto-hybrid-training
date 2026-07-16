import { describe, expect, it, vi } from "vitest";
import {
  notificationRealtimeChanges,
  notificationRealtimeScope,
  removeUserNotificationChannel,
  subscribeToUserNotifications,
} from "./notification-realtime";

describe("notification realtime", () => {
  it("crea un canale e un filtro dedicati al destinatario", () => {
    expect(notificationRealtimeScope("user-123")).toEqual({
      channel: "app-notifications-user-123",
      filter: "recipient_user_id=eq.user-123",
    });
  });

  it("ascolta soltanto le notifiche dell'utente", () => {
    expect(notificationRealtimeChanges("user-123")).toEqual({
      event: "*",
      schema: "public",
      table: "app_notifications",
      filter: "recipient_user_id=eq.user-123",
    });
  });

  it("sottoscrive e rimuove il canale filtrato", () => {
    const callback = vi.fn();
    const subscribe = vi.fn();
    const on = vi.fn();
    const channel = { on, subscribe };
    on.mockReturnValue(channel);
    subscribe.mockReturnValue(channel);

    const client = {
      channel: vi.fn().mockReturnValue(channel),
      removeChannel: vi.fn(),
    };

    const subscription = subscribeToUserNotifications(client, "user-123", callback);

    expect(client.channel).toHaveBeenCalledWith("app-notifications-user-123");
    expect(on).toHaveBeenCalledWith(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "app_notifications",
        filter: "recipient_user_id=eq.user-123",
      },
      callback,
    );
    expect(subscribe).toHaveBeenCalledOnce();

    removeUserNotificationChannel(client, subscription);
    expect(client.removeChannel).toHaveBeenCalledWith(channel);
  });
});
