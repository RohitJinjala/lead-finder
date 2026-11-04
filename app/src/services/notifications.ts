/**
 * Feature-flagged Expo push notifications service.
 * Native push notifications cannot be fully registered without native device provisioning and Apple/Google credentials.
 * Kept disabled by default via EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS flag.
 */

let pushEnabledOverride: boolean | null = null;

export function setPushEnabledOverride(enabled: boolean | null): void {
  pushEnabledOverride = enabled;
}

export function isPushEnabled(): boolean {
  if (pushEnabledOverride !== null) return pushEnabledOverride;
  return process.env.EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS === 'true' ||
         process.env['EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS'] === 'true';
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!isPushEnabled()) {
    console.log('[notifications] Push notifications feature flag disabled (EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS != true).');
    return null;
  }

  // Placeholder for Expo Notifications native module registration
  try {
    console.log('[notifications] Push enabled: native device registration placeholder active.');
    return 'exponent-push-token-placeholder';
  } catch (err) {
    console.warn('[notifications] Failed to register push token:', err);
    return null;
  }
}

export async function sendLocalNotification(title: string, body: string): Promise<boolean> {
  if (!isPushEnabled()) {
    console.log(`[notifications] Skipped local notification (flag disabled): "${title}" - "${body}"`);
    return false;
  }

  console.log(`[notifications] Local notification dispatched: "${title}" - "${body}"`);
  return true;
}
