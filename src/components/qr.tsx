import QRCode from "qrcode";

/** Server-rendered QR code as inline SVG (value is always an Arthakram URL we built). */
export async function QrSvg({ value, size = 160, className }: { value: string; size?: number; className?: string }) {
  const svg = await QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#141414", light: "#ffffff" } });
  return <div className={className} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg.replace("<svg", `<svg width="${size}" height="${size}"`) }} />;
}
