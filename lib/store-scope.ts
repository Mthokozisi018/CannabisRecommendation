export function requireAssignedStoreId(profile: { store_id?: string | null }, label = "Staff") {
  if (!profile.store_id) {
    throw new Error(`${label} store assignment is required before accessing store data.`);
  }

  return profile.store_id;
}

export function assertStoreMatch(actualStoreId: string | null | undefined, expectedStoreId: string, message = "Store access denied.") {
  if (!actualStoreId || actualStoreId !== expectedStoreId) {
    throw new Error(message);
  }
}
