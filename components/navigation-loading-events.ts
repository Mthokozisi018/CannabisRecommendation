export const navigationLoadingStartEvent = "greenchoice:navigation-loading-start";

export function startNavigationLoading() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(navigationLoadingStartEvent));
}
