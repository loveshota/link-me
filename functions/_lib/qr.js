import qrcode from "qrcode-generator";

export function makeQrSvg(text, cellSize = 4, margin = 4) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize, margin, scalable: true, alt: "2FA QR Code" });
}
