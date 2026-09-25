import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

const secret = base32Encode(randomBytes(20));
const label = process.argv[2] || "admin";
const issuer = process.argv[3] || "link-me";
const uri =
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}` +
  `?secret=${secret}&issuer=${encodeURIComponent(issuer)}` +
  `&algorithm=SHA1&digits=6&period=30`;

console.log("TOTP_SECRET=" + secret);
console.log("");
console.log("在验证器 App 中手动添加，或扫描/打开以下链接：");
console.log(uri);
