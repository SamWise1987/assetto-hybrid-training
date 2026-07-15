function fnv1a(value: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Stable id for records that already expose an immutable native id. */
export function stableRecordId(namespace: string, value: string) {
  const input = `${namespace}:${value}`;
  const bytes = new Uint8Array(16);
  const seeds = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  seeds.forEach((seed, block) => {
    const hash = fnv1a(input, seed);
    for (let offset = 0; offset < 4; offset += 1) bytes[block * 4 + offset] = (hash >>> (offset * 8)) & 0xff;
  });
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
