export const SAFE_DEMO_MODE_KEY = "aurevix_safe_demo_mode";

export function readSafeDemoMode() {
  if (typeof window === "undefined") return true;
  const saved = localStorage.getItem(SAFE_DEMO_MODE_KEY);
  if (saved === null) {
    localStorage.setItem(SAFE_DEMO_MODE_KEY, "true");
    return true;
  }
  return saved !== "false";
}

export function saveSafeDemoMode(enabled: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SAFE_DEMO_MODE_KEY, String(enabled));
}
