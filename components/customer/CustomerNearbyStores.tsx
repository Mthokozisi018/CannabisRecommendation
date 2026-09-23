"use client";

import { Crosshair, MapPinOff, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { CustomerEmptyState } from "@/components/customer/CustomerEmptyState";
import { CustomerStoreCard } from "@/components/customer/CustomerStoreCard";
import type { CustomerStore } from "@/lib/customer/catalog";

function distanceKm(latitude: number, longitude: number, store: CustomerStore) {
  if (store.latitude === null || store.longitude === null) return null;
  const radians = (value: number) => value * Math.PI / 180;
  const lat = radians(store.latitude - latitude);
  const lng = radians(store.longitude - longitude);
  const a = Math.sin(lat / 2) ** 2 + Math.cos(radians(latitude)) * Math.cos(radians(store.latitude)) * Math.sin(lng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function CustomerNearbyStores({ stores, savedStoreIds, initialRadiusKm }: { stores: CustomerStore[]; savedStoreIds: string[]; initialRadiusKm: number }) {
  const [currentPosition, setCurrentPosition] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationMessage, setLocationMessage] = useState("");
  const [radiusKm, setRadiusKm] = useState(initialRadiusKm);
  const visibleStores = useMemo(() => {
    const withDistance = stores.map((store) => ({ ...store, distanceKm: currentPosition ? distanceKm(currentPosition.latitude, currentPosition.longitude, store) : store.distanceKm }));
    const anyDistance = withDistance.some((store) => store.distanceKm !== null);
    return withDistance.filter((store) => !anyDistance || (store.distanceKm !== null && store.distanceKm <= radiusKm)).sort((a, b) => a.distanceKm !== null && b.distanceKm !== null ? a.distanceKm - b.distanceKm : a.name.localeCompare(b.name));
  }, [currentPosition, radiusKm, stores]);

  function useCurrentLocation() {
    setLocationMessage("");
    if (!navigator.geolocation) { setLocationMessage("Location is not available in this browser."); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => setCurrentPosition({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => setLocationMessage("Location permission was not granted. Saved-address browsing is still available."),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 }
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-[#2d3931] bg-[#08100b] p-4 shadow-[0_14px_30px_rgba(0,0,0,0.22)] sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-2xl font-black">Nearby stores</h2><p className="mt-1 text-sm text-[#9da8a0]">{visibleStores.length} {visibleStores.length === 1 ? "store" : "stores"} within the available location data.</p></div><div className="flex flex-col gap-3 sm:items-end"><button type="button" onClick={useCurrentLocation} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#86b723] bg-[#122009] px-4 font-bold text-[#b2ea3d] shadow-[0_10px_22px_rgba(0,0,0,0.28)] transition hover:border-[#a8e91d] hover:bg-[#17280b]"><Crosshair size={18} />Use current location</button><label className="flex items-center gap-3 rounded-xl border border-[#263229] bg-[#050a07] px-3 py-2 text-xs text-[#aab4ac]">Radius <input type="range" min="1" max="100" value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} className="accent-[#a8e91d]" /><strong className="min-w-12 text-right text-white">{radiusKm} km</strong></label></div></div>
      {locationMessage ? <p className="mb-4 flex items-center gap-2 border border-[#705126] bg-[#231a0c] p-3 text-sm text-[#efc576]"><MapPinOff size={17} />{locationMessage}</p> : null}
      {visibleStores.length ? <div className="grid grid-cols-1 gap-5">{visibleStores.map((store) => <CustomerStoreCard key={store.id} store={store} saved={savedStoreIds.includes(store.id)} landingRow />)}</div> : <CustomerEmptyState Icon={Store} title="No stores in this radius" message="Increase the radius or choose another saved location." />}
    </>
  );
}
