export class UmbraError extends Error {
  /** @param {'capacity'|'nomessage'|'wrongkey'|'format'} code */
  constructor(code, message, detail = {}) {
    super(message);
    this.name = 'UmbraError';
    this.code = code;
    this.detail = detail;
  }
}
