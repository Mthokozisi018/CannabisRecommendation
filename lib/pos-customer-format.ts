export type NormalizedPOSPhone = {
  normalized: string;
  digits: string;
  display: string;
};

export function normalizePOSCustomerPhone(value: string): NormalizedPOSPhone | null {
  const digitsOnly = value.replace(/\D/g, "");
  let national = "";

  if (/^0\d{9}$/.test(digitsOnly)) national = digitsOnly;
  else if (/^27\d{9}$/.test(digitsOnly)) national = `0${digitsOnly.slice(2)}`;
  else if (/^\d{9}$/.test(digitsOnly)) national = `0${digitsOnly}`;

  if (!/^0[6-8]\d{8}$/.test(national)) return null;
  return {
    normalized: `+27${national.slice(1)}`,
    digits: national,
    display: `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`
  };
}

export function customerFullName(firstName: string, surname: string) {
  return [firstName, surname].map((part) => part.trim()).filter(Boolean).join(" ");
}
