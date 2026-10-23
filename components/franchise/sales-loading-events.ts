export const salesLoadingStart = "greenchoice:franchise-sales-loading-start";
export const salesLoadingReady = "greenchoice:franchise-sales-loading-ready";
export const salesLoadingFailed = "greenchoice:franchise-sales-loading-failed";

export function notifySalesLoading(event: string) {
  window.dispatchEvent(new Event(event));
}
