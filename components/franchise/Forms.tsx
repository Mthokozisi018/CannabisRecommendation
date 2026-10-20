"use client";
import { clearStoreRequestKey, useStoreRequestKey } from "./use-store-request-key";
import { useActionState, useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import {
  registerFranchiseAction,
  registerFranchiseAdminAction,
} from "@/app/dashboard/admin/franchises/actions";
import { completeFranchiseSetupAction } from "@/app/franchise/setup/actions";
import {
  saveFranchiseStoreAction,
  createFranchiseStaffAction,
  manageFranchiseStaffAction,
  uploadFranchiseStoreImageAction,
} from "@/app/dashboard/franchise/actions";
import type {
  FranchiseActionState,
  FranchiseStaff,
  FranchiseStore,
} from "@/lib/franchise/types";
import { southAfricanProvinces } from "@/lib/manager/onboarding-options";
import { storeDayKeys } from "@/lib/manager/store-settings-fields";
import styles from "./Franchise.module.css";
const initial: FranchiseActionState = { ok: false, message: "" };
export function Field({
  label,
  name,
  type = "text",
  value,
  onChange,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string | null;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
}) {
  return (
    <label className={styles.field}>
      {label}
      <input
        name={name}
        type={type}
        defaultValue={onChange ? undefined : value || ""}
        value={onChange ? value || "" : undefined}
        onChange={onChange}
        required={required}
        maxLength={type === "password" ? 256 : 320}
        autoComplete={
          type === "password"
            ? name === "actorPassword"
              ? "current-password"
              : "new-password"
            : undefined
        }
      />
    </label>
  );
}
export function Feedback({ state }: { state: FranchiseActionState }) {
  return state.message ? (
    <p
      role={state.ok ? "status" : "alert"}
      className={state.ok ? styles.success : styles.error}
    >
      {state.message}
    </p>
  ) : null;
}
function Submit({
  pending,
  label = "Save Changes",
  disabled = false,
}: {
  pending: boolean;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button disabled={pending || disabled} className={styles.button}>
      {pending ? "Saving…" : label}
    </button>
  );
}
function PersonFields({ person }: { person?: FranchiseStaff }) {
  return (
    <>
      <Field name="firstName" label="First name" value={person?.first_name} />
      <Field name="surname" label="Last name" value={person?.surname} />
      <Field
        name="phone"
        type="tel"
        label="Phone"
        value={person?.phone_number || person?.mobile_number}
      />
    </>
  );
}
function PasswordFields() {
  return (
    <>
      <Field name="password" type="password" label="Temporary password" />
      <Field
        name="confirmPassword"
        type="password"
        label="Confirm temporary password"
      />
      <p className={styles.muted}>
        Use at least 12 characters, including uppercase, lowercase, a number and
        a symbol. Share credentials securely; they must be changed at first
        login.
      </p>
    </>
  );
}
export function RegisterFranchiseForm({
  franchiseId,
}: {
  franchiseId?: string;
}) {
  const [state, action, pending] = useActionState(
    registerFranchiseAction,
    initial,
  );
  const id = franchiseId || state.id;
  return id ? (
    <RegisterAdministratorForm franchiseId={id} />
  ) : (
    <form action={action} className={`${styles.panel} ${styles.form}`}>
      <h2>1. Franchise information</h2>
      <div className={styles.formGrid}>
        <Field name="name" label="Franchise name" />
        <Field
          name="registrationNumber"
          label="Business registration number (optional)"
          required={false}
        />
        <Field name="email" type="email" label="Contact email" />
        <Field name="phone" type="tel" label="Contact phone" />
        <Field name="address" label="Business address" />
      </div>
      <Feedback state={state} />
      <Submit pending={pending} label="Continue to administrator" />
    </form>
  );
}
function RegisterAdministratorForm({ franchiseId }: { franchiseId: string }) {
  const [state, action, pending] = useActionState(
    registerFranchiseAdminAction,
    initial,
  );
  return (
    <form action={action} className={`${styles.panel} ${styles.form}`}>
      <h2>2. Franchise Administrator</h2>
      <input type="hidden" name="franchiseId" value={franchiseId} />
      {!state.ok ? (
        <>
          <div className={styles.formGrid}>
            <PersonFields />
            <Field name="email" type="email" label="Administrator email" />
            <PasswordFields />
            <Field
              name="actorPassword"
              type="password"
              label="Your current Admin password"
            />
          </div>
          <Submit pending={pending} label="Create Franchise Administrator" />
        </>
      ) : (
        <Link
          className={styles.button}
          href={"/dashboard/admin/franchises" as never}
        >
          View Franchises
        </Link>
      )}
      <Feedback state={state} />
    </form>
  );
}
export function FranchiseSetupForm() {
  const [state, action, pending] = useActionState(
    completeFranchiseSetupAction,
    initial,
  );
  return (
    <form action={action} className={`${styles.panel} ${styles.form}`}>
      <Field name="password" type="password" label="New permanent password" />
      <Field
        name="confirmPassword"
        type="password"
        label="Confirm permanent password"
      />
      <p className={styles.muted}>
        At least 12 characters with uppercase, lowercase, a number and a symbol.
      </p>
      <label className={styles.checkbox}>
        <input type="checkbox" name="termsAccepted" required />I accept the{" "}
        <a href="/legal/terms-of-service.pdf" target="_blank" rel="noreferrer">
          Terms of Service
        </a>
      </label>
      <label className={styles.checkbox}>
        <input type="checkbox" name="privacyAccepted" required />I accept the{" "}
        <a href="/legal/privacy-policy.pdf" target="_blank" rel="noreferrer">
          Privacy Policy
        </a>
      </label>
      <Feedback state={state} />
      <Submit pending={pending} label="Complete account setup" />
    </form>
  );
}
export function StoreForm({
  store,
  onCancel,
  creationScope = "franchise-store",
}: {
  store?: FranchiseStore;
  onCancel?: () => void;
  creationScope?: string;
}) {
  const [state, action, pending] = useActionState(
    saveFranchiseStoreAction,
    initial,
  );
  const [hours, setHours] = useState(store?.opening_hours || {});
  const [draft, setDraft] = useState(() => ({
    name: store?.name || "", phone: store?.store_phone_number || "",
    email: store?.store_contact_email || "", address: store?.physical_store_address || "",
    city: store?.city || "", province: store?.province || "", postalCode: store?.postal_code || "",
    active: String(Boolean(store?.is_active && store.store_access_status === "active")),
  }));
  const inputFor = (name: keyof typeof draft) => ({
    value: draft[name],
    onChange: (event: ChangeEvent<HTMLInputElement>) => setDraft(previous => ({...previous, [name]: event.target.value})),
  });
  const requestKey = useStoreRequestKey(creationScope, !store);
  useEffect(() => {
    if (!store && state.ok) clearStoreRequestKey(creationScope);
  }, [state.ok, store, creationScope]);
  return (
    <form action={action} className={`${styles.panel} ${styles.form}`}>
      {/* Controlled drafts survive React's reset after an unsuccessful action result. */}
      {store ? <input type="hidden" name="storeId" value={store.id} /> : null}
      {!store ? <input type="hidden" name="idempotencyKey" value={requestKey} /> : null}
      <div className={styles.formGrid}>
        <Field name="name" label="Store name" {...inputFor("name")} />
        <Field
          name="phone"
          type="tel"
          label="Phone"
          {...inputFor("phone")}
        />
        <Field
          name="email"
          type="email"
          label="Contact email (optional)"
          required={false}
          {...inputFor("email")}
        />
        <Field
          name="address"
          label="Street address"
          {...inputFor("address")}
        />
        <Field name="city" label="City" {...inputFor("city")} />
        <label className={styles.field}>
          Province
          <select required name="province" value={draft.province} onChange={event=>setDraft(previous=>({...previous,province:event.target.value}))}>
            <option value="" disabled>
              Select province
            </option>
            {southAfricanProvinces.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <Field
          name="postalCode"
          label="Postal code"
          {...inputFor("postalCode")}
        />
        {store ? (
          <label className={styles.field}>
            Store status
            <select
              name="active"
              value={draft.active}
              onChange={event=>setDraft(previous=>({...previous,active:event.target.value}))}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
        ) : null}
      </div>
      {store ? (
        <>
          <h2>Operating hours</h2>
          <input
            name="openingHours"
            type="hidden"
            value={JSON.stringify(hours)}
          />
          {storeDayKeys.map((day) => {
            const current = hours[day] || { closed: true };
            return (
              <div key={day} className={styles.hours}>
                <span>{day}</span>
                <label className={styles.field}>
                  <span className={styles.visuallyHidden}>
                    {day} opening time
                  </span>
                  <input
                    type="time"
                    disabled={current.closed}
                    value={current.open || ""}
                    onChange={(e) =>
                      setHours({
                        ...hours,
                        [day]: { ...current, open: e.target.value },
                      })
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span className={styles.visuallyHidden}>
                    {day} closing time
                  </span>
                  <input
                    type="time"
                    disabled={current.closed}
                    value={current.close || ""}
                    onChange={(e) =>
                      setHours({
                        ...hours,
                        [day]: { ...current, close: e.target.value },
                      })
                    }
                  />
                </label>
                <label className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={current.closed || false}
                    onChange={(e) =>
                      setHours({
                        ...hours,
                        [day]: { ...current, closed: e.target.checked },
                      })
                    }
                  />
                  Closed
                </label>
              </div>
            );
          })}
        </>
      ) : null}
      <Feedback state={state} />
      <div className={styles.actions}>
        <Submit
          pending={pending}
          disabled={!store && (!requestKey || state.ok)}
          label={store ? "Save Changes" : "Register Store"}
        />
        {onCancel ? (
          <button type="button" className={styles.button} onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        {state.ok && state.id ? (
          <Link
            className={styles.button}
            href={`/dashboard/franchise/stores/${state.id}` as never}
          >
            Manage Store
          </Link>
        ) : null}
      </div>
    </form>
  );
}
export function StaffCreateForm({
  storeId,
  role = "receptionist",
  atLimit = false,
}: {
  storeId: string;
  role?: "manager" | "receptionist";
  atLimit?: boolean;
}) {
  const [state, action, pending] = useActionState(
    createFranchiseStaffAction,
    initial,
  );
  return (
    <form action={action} className={`${styles.panel} ${styles.form}`}>
      <h2>{role === "manager" ? "Assign Manager" : "Add Receptionist"}</h2>
      <p className={styles.muted}>
        The employee will complete their personal details and choose a permanent
        password at first sign-in. This account is assigned to the current store.
      </p>
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="role" value={role} />
      <fieldset disabled={pending || atLimit} className={styles.formGrid}>
        <Field name="email" type="email" label={role === "manager" ? "Manager Email Address" : "Receptionist Email Address"} />
        <Field name="password" type="password" label="Temporary Password" />
      </fieldset>
      <p className={styles.muted}>
        {role === "manager"
          ? "Use at least 12 characters with uppercase, lowercase, a number and a symbol."
          : "Temporary passwords must meet the authentication provider's requirements."}
        {" "}Share temporary credentials securely.
      </p>
      {atLimit ? (
        <p className={styles.error}>
          This store has reached the {role === "manager" ? 3 : 5} {role} limit.
        </p>
      ) : null}
      <Feedback state={state} />
      <Submit
        pending={pending}
        disabled={atLimit}
        label={role === "manager" ? "Assign Manager" : "Add Receptionist"}
      />
    </form>
  );
}
export function StaffEditForm({
  person,
  onCancel,
}: {
  person: FranchiseStaff;
  onCancel: () => void;
}) {
  const [state, action, pending] = useActionState(
    manageFranchiseStaffAction,
    initial,
  );
  const [operation, setOperation] = useState("edit_staff");
  return (
    <form
      action={action}
      onReset={() => setOperation("edit_staff")}
      className={`${styles.panel} ${styles.form}`}
    >
      <h2>Manage {person.full_name || person.email}</h2>
      <input type="hidden" name="storeId" value={person.store_id} />
      <input type="hidden" name="staffId" value={person.id} />
      <label className={styles.field}>
        Action
        <select
          name="action"
          value={operation}
          onChange={(e) => setOperation(e.target.value)}
        >
          <option value="edit_staff">Edit details</option>
          <option value="restrict_staff">Restrict access</option>
          <option value="reactivate_staff">Reactivate access</option>
          <option value="deactivate_staff">Deactivate account</option>
          <option value="reset_staff_password">Send password reset</option>
          {person.role === "manager" ? (
            <option value="remove_manager">Remove manager assignment</option>
          ) : null}
        </select>
      </label>
      {operation === "edit_staff" ? (
        <div className={styles.formGrid}>
          <PersonFields person={person} />
        </div>
      ) : null}
      {operation === "remove_manager" ? (
        <p className={styles.muted}>
          This deactivates the account and releases its manager slot. Business
          history is retained.
        </p>
      ) : null}
      <Field
        name="actorPassword"
        type="password"
        label="Your current password"
      />
      <Feedback state={state} />
      <div className={styles.actions}>
        <Submit pending={pending} label="Confirm action" />
        <button type="button" className={styles.button} onClick={onCancel}>
          Close
        </button>
      </div>
    </form>
  );
}
export function StoreImageForm({ storeId }: { storeId: string }) {
  const [state, action, pending] = useActionState(
    uploadFranchiseStoreImageAction,
    initial,
  );
  return (
    <form action={action} className={`${styles.panel} ${styles.form}`}>
      <h2>Store photograph</h2>
      <input name="storeId" type="hidden" value={storeId} />
      <label className={styles.field}>
        JPEG, PNG or WebP · up to 6 MB
        <input
          name="image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
      </label>
      <Feedback state={state} />
      <Submit pending={pending} label="Upload photograph" />
    </form>
  );
}
