import { fail, ok, type ActionResult } from '@/lib/action-result';
import { subscribePush, unsubscribePush } from './actions';

const PADDING_MULTIPLE = 4;

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const paddingLength = (PADDING_MULTIPLE - (base64String.length % PADDING_MULTIPLE)) % PADDING_MULTIPLE;
  const padding = '='.repeat(paddingLength);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer: ArrayBuffer = new ArrayBuffer(rawData.length);
  const outputArray: Uint8Array<ArrayBuffer> = new Uint8Array(buffer);

  for (let i = 0; i < rawData.length; i += 1) {
    const code = rawData.charCodeAt(i);
    outputArray[i] = code;
  }

  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) {
    return '';
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    const code = bytes[i];
    if (code !== undefined) {
      binary += String.fromCharCode(code);
    }
  }
  return window.btoa(binary);
}

/**
 * Checks if current browser environment supports Service Worker and Push API.
 */
export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Gets the current active PushSubscription for this browser, if any.
 */
export async function getBrowserPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registration) {
      return null;
    }
    return registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

/**
 * Requests browser permission, registers Service Worker, creates PushSubscription,
 * and calls subscribePush Server Action.
 */
export async function subscribeBrowserPush(
  vapidPublicKey: string,
): Promise<ActionResult<{ id: string }>> {
  if (!isPushSupported()) {
    return fail('Twoja przeglądarka nie obsługuje powiadomień Push.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return fail('Nie udzielono zgody na wyświetlanie powiadomień.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const appServerKey = urlBase64ToUint8Array(vapidPublicKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });
  }

  const p256dh = arrayBufferToBase64(subscription.getKey('p256dh'));
  const authSecret = arrayBufferToBase64(subscription.getKey('auth'));

  return subscribePush({
    endpoint: subscription.endpoint,
    p256dh,
    authSecret,
    userAgent: navigator.userAgent,
  });
}

/**
 * Unsubscribes browser PushSubscription and deletes the record from database.
 */
export async function unsubscribeBrowserPush(): Promise<ActionResult<{ success: boolean }>> {
  if (!isPushSupported()) {
    return ok({ success: true });
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registration) {
      return ok({ success: true });
    }

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return ok({ success: true });
    }

    const serverResult = await unsubscribePush({ endpoint: subscription.endpoint });
    await subscription.unsubscribe();

    return serverResult;
  } catch (error: unknown) {
    return fail(
      `Błąd podczas wyłączania powiadomień: ${error instanceof Error ? error.message : 'nieznany błąd'}`,
    );
  }
}

/**
 * Cleanup helper for logout: forgets this browser's push subscription.
 * Guaranteed to NEVER throw errors, so signOut is never blocked (H-7).
 */
export async function forgetThisBrowserPush(): Promise<void> {
  if (!isPushSupported()) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    if (!registration) {
      return;
    }
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await unsubscribePush({ endpoint: subscription.endpoint }).catch(() => {});
      await subscription.unsubscribe().catch(() => {});
    }
  } catch {
    // Ignore all errors during logout cleanup
  }
}
