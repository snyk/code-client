import { randomUUID } from 'crypto';

// Mirrors the format accepted by the `uuid` package's `validate`: versions 1-8 plus
// the nil and max UUIDs.
const UUID_RE =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;

// Native replacements for the `uuid` package, backed by node:crypto.
export function v4(): string {
  return randomUUID();
}

export function validate(value: string): boolean {
  return UUID_RE.test(value);
}
