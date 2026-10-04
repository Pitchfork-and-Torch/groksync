const ENC_ITER = 100000;

function b64(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(s) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(pass, salt) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ENC_ITER, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptSecret(pass, obj) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const pt = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt);
  return {
    v: 1,
    alg: "A256GCM",
    kdf: "PBKDF2-SHA256",
    iter: ENC_ITER,
    salt: b64(salt),
    iv: b64(iv),
    ct: b64(ct),
  };
}

export async function decryptSecret(pass, enc) {
  if (!enc || enc.v !== 1) throw new Error("bad enc");
  const salt = unb64(enc.salt);
  const iv = unb64(enc.iv);
  const key = await deriveKey(pass, salt);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, unb64(enc.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
