export default class ErrorMessage extends Error {
  code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, ErrorMessage.prototype);
  }
}
