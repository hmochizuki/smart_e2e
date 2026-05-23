export const dateToEpochMs = (d: Date): number => d.getTime();

export const epochMsToDate = (ms: number): Date => new Date(ms);

export const nullableDateToEpochMs = (d: Date | null): number | null =>
  d === null ? null : d.getTime();

export const epochMsToNullableDate = (ms: number | null): Date | null =>
  ms === null ? null : new Date(ms);

export const optionalToNullable = <T>(v: T | undefined): T | null => (v === undefined ? null : v);

export const nullableToOptional = <T>(v: T | null): T | undefined => (v === null ? undefined : v);

export const nullishToNullable = <T>(v: T | null | undefined): T | null =>
  v === undefined || v === null ? null : v;

export const nullableDateInputToEpochMs = (d: Date | null | undefined): number | null => {
  if (d === null || d === undefined) {
    return null;
  }
  return d.getTime();
};
