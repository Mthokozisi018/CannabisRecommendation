export const storesLoadingStart = "greenchoice:franchise-stores-loading-start";
export const storesLoadingReady = "greenchoice:franchise-stores-loading-ready";
export const storesLoadingFailed = "greenchoice:franchise-stores-loading-failed";

export function notifyStoresLoading(event: string) {
  window.dispatchEvent(new Event(event));
}
