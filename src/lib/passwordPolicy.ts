/**
 * Shared Password Policy for SINC Platform.
 *
 * Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 */

export const PASSWORD_MIN_LENGTH = 8;

/**
 * Validates a password against the platform security policy.
 * @param password - The password string to validate
 * @returns Error message string if invalid, or null if valid
 */
export function validatePassword(password: string): string | null {
  if (!password) {
    return 'Password is required';
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter (A-Z)';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter (a-z)';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number (0-9)';
  }
  return null;
}

export const PASSWORD_POLICY_HINT = 'Must be at least 8 characters and include uppercase, lowercase, and numbers.';
