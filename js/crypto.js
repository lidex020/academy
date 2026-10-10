/* Lidex Academy - real cryptographic primitives used by the lab simulators.
   Keccak-256 (Ethereum hash, pre-NIST padding), SHA-256 / double SHA-256 via WebCrypto,
   RLP encoding (Ethereum), and Merkle roots. Pure functions, no network access. */
(function (root) {
  "use strict";

  // ---------- Keccak-f[1600] ----------
  const M64 = (1n << 64n) - 1n;
  const RC = [
    0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
    0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
    0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
    0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
    0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
    0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
  ];
  // Rotation offsets indexed by x + 5*y
  const ROT = [0, 1, 62, 28, 27, 36, 44, 6, 55, 20, 3, 10, 43, 25, 39, 41, 45, 15, 21, 8, 18, 2, 61, 56, 14];

  function rol(v, n) {
    if (n === 0) return v;
    const s = BigInt(n);
    return ((v << s) | (v >> (64n - s))) & M64;
  }

  function keccakF(A) {
    for (let round = 0; round < 24; round++) {
      const C = [0n, 0n, 0n, 0n, 0n];
      for (let x = 0; x < 5; x++) C[x] = A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20];
      const D = [0n, 0n, 0n, 0n, 0n];
      for (let x = 0; x < 5; x++) D[x] = C[(x + 4) % 5] ^ rol(C[(x + 1) % 5], 1);
      for (let i = 0; i < 25; i++) A[i] ^= D[i % 5];
      const B = new Array(25).fill(0n);
      for (let x = 0; x < 5; x++)
        for (let y = 0; y < 5; y++) {
          const idx = x + 5 * y;
          B[y + 5 * ((2 * x + 3 * y) % 5)] = rol(A[idx], ROT[idx]);
        }
      for (let x = 0; x < 5; x++)
        for (let y = 0; y < 5; y++) {
          A[x + 5 * y] = B[x + 5 * y] ^ ((~B[((x + 1) % 5) + 5 * y] & M64) & B[((x + 2) % 5) + 5 * y]);
        }
      A[0] ^= RC[round];
    }
  }

  function keccak256(bytes) {
    const rate = 136;
    const padLen = rate - (bytes.length % rate);
    const msg = new Uint8Array(bytes.length + padLen);
    msg.set(bytes);
    msg[bytes.length] ^= 0x01; // Keccak padding (SHA-3 would use 0x06)
    msg[msg.length - 1] ^= 0x80;
    const A = new Array(25).fill(0n);
    for (let off = 0; off < msg.length; off += rate) {
      for (let i = 0; i < rate / 8; i++) {
        let lane = 0n;
        for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(msg[off + i * 8 + b]);
        A[i] ^= lane;
      }
      keccakF(A);
    }
    const out = new Uint8Array(32);
    for (let i = 0; i < 4; i++) {
      let lane = A[i];
      for (let b = 0; b < 8; b++) { out[i * 8 + b] = Number(lane & 0xffn); lane >>= 8n; }
    }
    return out;
  }

  // ---------- Bytes / hex helpers ----------
  const enc = new TextEncoder();
  function utf8(s) { return enc.encode(s); }
  function toHex(bytes) { return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join(""); }
  function fromHex(hex) {
    let h = String(hex).trim().replace(/^0x/i, "");
    if (h.length % 2) h = "0" + h;
    if (!/^[0-9a-fA-F]*$/.test(h)) throw new Error("Not a hex string: " + hex);
    const out = new Uint8Array(h.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  }
  function concat(...arrs) {
    const len = arrs.reduce((a, b) => a + b.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const a of arrs) { out.set(a, o); o += a.length; }
    return out;
  }
  function bigintToBytes(n) { // minimal big-endian, 0 -> empty
    if (n < 0n) throw new Error("negative integer not RLP encodable");
    if (n === 0n) return new Uint8Array(0);
    const hex = n.toString(16);
    return fromHex(hex.length % 2 ? "0" + hex : hex);
  }

  // ---------- RLP ----------
  function lenPrefix(len, offset) {
    if (len <= 55) return Uint8Array.of(offset + len);
    const lb = bigintToBytes(BigInt(len));
    return concat(Uint8Array.of(offset + 55 + lb.length), lb);
  }
  function rlpEncode(item) {
    if (item instanceof Uint8Array) {
      if (item.length === 1 && item[0] < 0x80) return item;
      return concat(lenPrefix(item.length, 0x80), item);
    }
    if (Array.isArray(item)) {
      const payload = concat(...item.map(rlpEncode));
      return concat(lenPrefix(payload.length, 0xc0), payload);
    }
    throw new Error("RLP input must be Uint8Array or array");
  }

  // ---------- SHA-256 (WebCrypto) ----------
  async function sha256(bytes) {
    return new Uint8Array(await root.crypto.subtle.digest("SHA-256", bytes));
  }
  async function sha256d(bytes) { return sha256(await sha256(bytes)); }

  function leadingZeroBits(bytes) {
    let bits = 0;
    for (const b of bytes) {
      if (b === 0) { bits += 8; continue; }
      bits += Math.clz32(b) - 24;
      break;
    }
    return bits;
  }

  // ---------- Merkle tree (Keccak-256, duplicate last node on odd levels) ----------
  function merkleRoot(leaves) { // leaves: array of strings
    if (!leaves.length) throw new Error("No leaves");
    let level = leaves.map(l => keccak256(utf8(l)));
    const levels = [level];
    while (level.length > 1) {
      if (level.length % 2) level = level.concat([level[level.length - 1]]);
      const next = [];
      for (let i = 0; i < level.length; i += 2) next.push(keccak256(concat(level[i], level[i + 1])));
      level = next;
      levels.push(level);
    }
    return { root: level[0], levels };
  }

  // ---------- Integer helpers ----------
  function isqrt(n) { // floor(sqrt(n)) for BigInt
    if (n < 0n) throw new Error("sqrt of negative");
    if (n < 2n) return n;
    let x = BigInt(Math.floor(Math.sqrt(Number(n))));
    while (x * x > n) x--;
    while ((x + 1n) * (x + 1n) <= n) x++;
    return x;
  }

  const api = {
    keccak256, sha256, sha256d, leadingZeroBits, utf8, toHex, fromHex, concat,
    rlpEncode, bigintToBytes, merkleRoot, isqrt,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.LidexCrypto = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
