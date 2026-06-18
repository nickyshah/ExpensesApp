export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

export function requireFields(body, fields) {
  for (const f of fields) {
    if (body[f] === undefined || body[f] === null || body[f] === '') {
      throw new ValidationError(`Missing required field: ${f}`);
    }
  }
}

export function isValidDate(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(new Date(str + 'T00:00:00').getTime());
}

export function isValidAmount(val) {
  const n = Number(val);
  return !isNaN(n) && n > 0 && isFinite(n);
}

export function isValidMonth(str) {
  return /^\d{4}-\d{2}$/.test(str);
}
