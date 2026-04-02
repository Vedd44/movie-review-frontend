export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail || !EMAIL_PATTERN.test(normalizedEmail)) {
    return "Enter a valid email";
  }

  return "";
}

export function validatePassword(password) {
  const normalizedPassword = String(password || "");

  if (normalizedPassword.length < 8) {
    return "Use at least 8 characters";
  }

  if (!/[A-Za-z]/.test(normalizedPassword) || !/\d/.test(normalizedPassword)) {
    return "Use a mix of letters and numbers";
  }

  return "";
}
