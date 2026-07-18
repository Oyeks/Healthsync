/**
 * Kept separate from auth.ts so pure logic modules (rbac) can throw and test
 * against it without importing the server-only session code.
 */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
