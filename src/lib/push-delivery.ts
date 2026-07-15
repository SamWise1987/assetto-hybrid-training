export function apnsDeliveryResult(status: number, reason?: string) {
  if (status === 200) return 1;
  if (status === 410 || reason === "BadDeviceToken" || reason === "DeviceTokenNotForTopic" || reason === "Unregistered") return -1;
  return 0;
}
