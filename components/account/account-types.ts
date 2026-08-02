export type AccountRole = "manager" | "receptionist";

export type DashboardAccountProfile = {
  firstName: string;
  surname: string;
  email: string;
  phoneNumber: string;
  alternativePhone: string;
  physicalAddress: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  employeeId: string;
};

export function accountRoleTitle(role: AccountRole) {
  return role === "manager" ? "Manager" : "Receptionist";
}

export function accountFirstName(profile: DashboardAccountProfile) {
  return profile.firstName.trim() || "Account";
}
