/** An error whose message is safe and useful to show to the admin (never contains secrets or stack traces). */
export class PublicError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}
