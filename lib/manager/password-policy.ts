export function managerPasswordIssues(password: string, confirmPassword?: string) {
  const issues: string[] = [];
  if (password.length < 12) issues.push("At least 12 characters");
  if (!/[A-Z]/.test(password)) issues.push("At least 1 uppercase letter");
  if (!/[a-z]/.test(password)) issues.push("At least 1 lowercase letter");
  if (!/[0-9]/.test(password)) issues.push("At least 1 number");
  if (!/[^A-Za-z0-9]/.test(password)) issues.push("At least 1 special character");
  if (/(password|greenchoice|manager|admin|qwerty|letmein|123456|name)/i.test(password)) issues.push("Do not use easily guessed personal information");
  if (confirmPassword !== undefined && password !== confirmPassword) issues.push("Password and confirm password must match");
  return issues;
}

export function passwordStrength(password: string) {
  const checks = [
    password.length >= 12,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length;
  if (checks <= 2) return "Weak";
  if (checks <= 4) return "Good";
  return "Strong";
}
