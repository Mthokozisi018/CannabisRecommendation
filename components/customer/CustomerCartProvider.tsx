"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { CustomerCartPayload } from "@/lib/customer/cart";

type CustomerCartContextValue = {
  cart: CustomerCartPayload;
  busy: boolean;
  message: string;
  addProduct: (productId: string) => Promise<boolean>;
  setQuantity: (itemId: string, quantity: number) => Promise<boolean>;
  clearCart: () => Promise<boolean>;
  clearMessage: () => void;
};

const CustomerCartContext = createContext<CustomerCartContextValue | null>(null);

async function cartRequest(method: "POST" | "PATCH" | "DELETE", body?: Record<string, unknown>) {
  const response = await fetch("/api/customer/cart", {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const result = await response.json() as CustomerCartPayload & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Cart update failed.");
  return result;
}

export function CustomerCartProvider({ initialCart, children }: { initialCart: CustomerCartPayload; children: ReactNode }) {
  const [cart, setCart] = useState(initialCart);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const mutate = useCallback(async (method: "POST" | "PATCH" | "DELETE", body?: Record<string, unknown>) => {
    if (busy) return false;
    setBusy(true);
    setMessage("");
    try {
      const next = await cartRequest(method, body);
      setCart(next);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cart update failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const value = useMemo<CustomerCartContextValue>(() => ({
    cart,
    busy,
    message,
    addProduct: (productId) => mutate("POST", { productId }),
    setQuantity: (itemId, quantity) => mutate("PATCH", { itemId, quantity }),
    clearCart: () => mutate("DELETE"),
    clearMessage: () => setMessage("")
  }), [busy, cart, message, mutate]);

  return <CustomerCartContext.Provider value={value}>{children}</CustomerCartContext.Provider>;
}

export function useCustomerCart() {
  const value = useContext(CustomerCartContext);
  if (!value) throw new Error("Customer cart is unavailable outside the customer application.");
  return value;
}

