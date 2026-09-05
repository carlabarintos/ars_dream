/**
 * Throw this instead of a plain Error when the message itself is already
 * safe/friendly to show a user verbatim (e.g. a deliberate business-rule
 * message written for them) — getFriendlyErrorMessage trusts it as-is
 * instead of routing it through the generic on-brand fallback copy.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UserFacingError'
  }
}
