/**
 * A v4 UUID built from getRandomValues, which works on a plain-HTTP
 * local-network origin as well as HTTPS. `crypto.randomUUID` is unavailable
 * outside a secure context, and joining from a phone over the LAN is exactly
 * that case, so it must not be used here.
 */
export function browserUuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 15) | 64;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
