import { createSign } from "node:crypto";
import http2 from "node:http2";
import webpush from "web-push";
import { createServiceSupabaseClient } from "./supabase/server";
import { apnsDeliveryResult } from "./push-delivery";

interface PushMessage { title: string; body: string; href?: string }

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function privateKey(value: string | undefined) {
  return value?.replace(/\\n/g, "\n");
}

function signedJwt(header: Record<string, string>, claims: Record<string, string | number>, key: string, algorithm: "RS256" | "ES256") {
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;
  const signer = createSign("SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign({ key, dsaEncoding: algorithm === "ES256" ? "ieee-p1363" : "der" });
  return `${unsigned}.${base64Url(signature)}`;
}

async function getFcmAccessToken() {
  const email = process.env.FCM_CLIENT_EMAIL;
  const key = privateKey(process.env.FCM_PRIVATE_KEY);
  if (!email || !key) return null;
  const now = Math.floor(Date.now() / 1000);
  const assertion = signedJwt(
    { alg: "RS256", typ: "JWT" },
    { iss: email, sub: email, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600, scope: "https://www.googleapis.com/auth/firebase.messaging" },
    key,
    "RS256",
  );
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return null;
  const result = await response.json() as { access_token?: string };
  return result.access_token ?? null;
}

async function sendFcm(token: string, notification: PushMessage, accessToken: string) {
  const projectId = process.env.FCM_PROJECT_ID;
  if (!projectId) return 0;
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { token, notification: { title: notification.title, body: notification.body }, data: { href: notification.href ?? "/?tab=inbox" } } }),
    signal: AbortSignal.timeout(10_000),
  });
  if (response.ok) return 1;
  if (response.status === 404) return -1;
  return 0;
}

function sendApns(token: string, notification: PushMessage) {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const key = privateKey(process.env.APNS_PRIVATE_KEY);
  const bundleId = process.env.APNS_BUNDLE_ID ?? "com.robertafunctional.app";
  if (!keyId || !teamId || !key) return Promise.resolve(0);
  const providerToken = signedJwt({ alg: "ES256", kid: keyId }, { iss: teamId, iat: Math.floor(Date.now() / 1000) }, key, "ES256");
  const host = process.env.APNS_ENVIRONMENT === "development" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  return new Promise<number>((resolve) => {
    const client = http2.connect(`https://${host}`);
    let settled = false;
    const finish = (result: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      client.destroy();
      resolve(result);
    };
    const timer = setTimeout(() => finish(0), 10_000);
    client.once("error", () => finish(0));
    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${providerToken}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
    });
    let status = 0;
    let responseBody = "";
    request.on("response", (headers) => { status = Number(headers[":status"] ?? 0); });
    request.on("data", (chunk) => { responseBody += chunk.toString(); });
    request.once("error", () => finish(0));
    request.once("end", () => {
      let reason: string | undefined;
      try { reason = (JSON.parse(responseBody) as { reason?: string }).reason; } catch { /* APNs può rispondere senza body. */ }
      finish(apnsDeliveryResult(status, reason));
    });
    request.end(JSON.stringify({ aps: { alert: { title: notification.title, body: notification.body }, sound: "default" }, href: notification.href ?? "/?tab=inbox" }));
  });
}

export async function dispatchPush(recipientUserIds: string[], notification: PushMessage) {
  if (!recipientUserIds.length) return { sent: 0 };
  const service = createServiceSupabaseClient();
  if (!service) return { sent: 0 };
  const { data } = await service.from("push_subscriptions").select("id,platform,endpoint,p256dh,auth,native_token").in("user_id", recipientUserIds);
  const subscriptions = data ?? [];
  let sent = 0;

  const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
  const webPrivateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  if (publicKey && webPrivateKey) {
    webpush.setVapidDetails(process.env.WEB_PUSH_SUBJECT ?? "mailto:privacy@robertafunctional.app", publicKey, webPrivateKey);
  }
  const fcmToken = subscriptions.some((item) => item.platform === "android") ? await getFcmAccessToken() : null;

  await Promise.all(subscriptions.map(async (subscription) => {
    let result = 0;
    try {
      if (subscription.platform === "web" && publicKey && webPrivateKey && subscription.endpoint && subscription.p256dh && subscription.auth) {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(notification));
        result = 1;
      } else if (subscription.platform === "android" && subscription.native_token && fcmToken) {
        result = await sendFcm(subscription.native_token, notification, fcmToken);
      } else if (subscription.platform === "ios" && subscription.native_token) {
        result = await sendApns(subscription.native_token, notification);
      }
    } catch (error) {
      const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      result = statusCode === 404 || statusCode === 410 ? -1 : 0;
    }
    if (result === -1) await service.from("push_subscriptions").delete().eq("id", subscription.id);
    if (result === 1) sent += 1;
  }));
  return { sent };
}
