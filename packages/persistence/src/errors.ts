export class PersistenceError extends Error {
  override readonly name: string = 'PersistenceError';
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

export class NotFoundError extends PersistenceError {
  override readonly name = 'NotFoundError';
  readonly entity: string;
  readonly id: string;
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.entity = entity;
    this.id = id;
  }
}

export class ConflictError extends PersistenceError {
  override readonly name = 'ConflictError';
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

const SQLITE_CONSTRAINT_CODES = new Set([
  'SQLITE_CONSTRAINT_UNIQUE',
  'SQLITE_CONSTRAINT_PRIMARYKEY',
  'SQLITE_CONSTRAINT_FOREIGNKEY',
  'SQLITE_CONSTRAINT_CHECK',
  'SQLITE_CONSTRAINT_NOTNULL',
  'SQLITE_CONSTRAINT',
]);

const hasStringCode = (e: unknown): e is { code: string; message: string } => {
  if (typeof e !== 'object' || e === null) {
    return false;
  }
  if (!('code' in e) || !('message' in e)) {
    return false;
  }
  const code = (e as { code: unknown }).code;
  const message = (e as { message: unknown }).message;
  return typeof code === 'string' && typeof message === 'string';
};

export const runWithConflictMapping = <T>(entity: string, fn: () => T): T => {
  try {
    return fn();
  } catch (e) {
    if (hasStringCode(e) && SQLITE_CONSTRAINT_CODES.has(e.code)) {
      throw new ConflictError(`${entity}: ${e.code} ${e.message}`, {
        cause: e,
      });
    }
    throw e;
  }
};
