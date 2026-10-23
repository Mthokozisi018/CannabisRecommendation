export const storeDayKeys = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type StoreDayKey = (typeof storeDayKeys)[number];
