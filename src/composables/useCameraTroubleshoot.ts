import { ref, onMounted } from 'vue';
import { ApiService } from '@/services/api.service';
import { useAuthStore } from '@/stores/auth.store';
import { APP_VERSION } from '@/version';
import type { CameraErrorReportPayload } from '@/types';

export const CAMERA_DENIED_MESSAGE =
  'Camera access is blocked for this site. Tap the lock/info icon next to your browser\'s address bar → Permissions → Camera → Allow, then try again. You can also type the number in manually.';

/** Maps a getUserMedia() rejection to user-facing guidance. canRetry means
 *  tapping "Try Again" can plausibly fix it on its own (transient/permission
 *  cases) — false means no in-app action will help (e.g. no camera at all). */
export function describeCameraError(err: unknown): { message: string; canRetry: boolean } {
  const name = err instanceof DOMException ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return { message: CAMERA_DENIED_MESSAGE, canRetry: true };
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return { message: 'No camera was found on this device. Use manual entry instead.', canRetry: false };
    case 'NotReadableError':
    case 'TrackStartError':
      return { message: 'The camera is busy in another app. Close any other app using the camera, then try again.', canRetry: true };
    default:
      return { message: 'Camera unavailable right now. Try again or use manual entry.', canRetry: true };
  }
}

/** Calls `onGranted` the moment the browser's camera permission flips to
 *  'granted' — e.g. right after the user fixes it in their browser's site
 *  settings — so they don't also have to remember to come back and tap
 *  "Try Again" themselves. No-ops silently where the Permissions API or a
 *  'camera' query isn't supported (notably Safari); callers must still offer
 *  a manual retry for those. Returns an unsubscribe function. */
export function watchCameraPermission(onGranted: () => void): () => void {
  let status: PermissionStatus | null = null;
  const handler = () => { if (status?.state === 'granted') onGranted(); };
  navigator.permissions?.query({ name: 'camera' as PermissionName })
    .then((s) => { status = s; status.addEventListener('change', handler); })
    .catch(() => { /* Permissions API or 'camera' query unsupported — ignore */ });
  return () => status?.removeEventListener('change', handler);
}

/** Best-effort check of whether the camera permission is already blocked,
 *  so a caller can skip opening a camera UI that's known to be dead and show
 *  the fix-it message right away instead. Resolves false (i.e. "go ahead and
 *  try") wherever the Permissions API or a 'camera' query isn't supported —
 *  callers' own getUserMedia/capture failure path is the fallback there. */
export async function isCameraPermissionDenied(): Promise<boolean> {
  try {
    const status = await navigator.permissions?.query({ name: 'camera' as PermissionName });
    return status?.state === 'denied';
  } catch {
    return false;
  }
}

/** Reports a camera-unavailable failure to the backend (fire-and-forget,
 *  never throws) so the developer gets an emailed alert with as much device
 *  context as the browser will give up, instead of the failure only ever
 *  being visible on the affected user's own device. */
export async function reportCameraError(
  feature: CameraErrorReportPayload['feature'],
  err: unknown,
  userFacingMessage: string,
): Promise<void> {
  const authStore = useAuthStore();

  let permissionState: string | undefined;
  try {
    const status = await navigator.permissions?.query({ name: 'camera' as PermissionName });
    permissionState = status?.state;
  } catch {
    // Permissions API / 'camera' query unsupported — leave undefined
  }

  let cameraDeviceCount: number | undefined;
  try {
    const devices = await navigator.mediaDevices?.enumerateDevices();
    cameraDeviceCount = devices?.filter((d) => d.kind === 'videoinput').length;
  } catch {
    // leave undefined
  }

  void ApiService.reportCameraError({
    feature,
    errorName: err instanceof DOMException ? err.name : undefined,
    errorMessage: err instanceof Error ? err.message : typeof err === 'string' ? err : undefined,
    userFacingMessage,
    permissionState,
    mediaDevicesSupported: 'mediaDevices' in navigator && typeof navigator.mediaDevices?.getUserMedia === 'function',
    cameraDeviceCount,
    isSecureContext: window.isSecureContext,
    url: location.href,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenResolution: `${screen.width}x${screen.height}`,
    viewportSize: `${window.innerWidth}x${window.innerHeight}`,
    online: navigator.onLine,
    appVersion: APP_VERSION,
    username: authStore.user?.username,
    userDisplayName: authStore.user?.displayName,
    companyCode: authStore.company?.code,
    clientTimestamp: new Date().toISOString(),
  });
}

/** Whether this device appears to have a camera at all, checked once on
 *  mount via enumerateDevices (works without prompting for permission).
 *  Starts optimistic (true) so the button isn't disabled before the check
 *  resolves. */
export function useCameraAvailability() {
  const cameraAvailable = ref(true);

  onMounted(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      cameraAvailable.value = false;
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      cameraAvailable.value = devices.some((d) => d.kind === 'videoinput');
    } catch {
      // Can't enumerate — assume available rather than wrongly hiding it.
    }
  });

  return { cameraAvailable };
}
