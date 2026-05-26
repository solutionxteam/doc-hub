/**
 * Minimal ambient type declaration for heic-convert (no official @types package).
 */
declare module "heic-convert" {
  interface ConvertOptions {
    buffer:   ArrayBuffer | Uint8Array
    format:   "JPEG" | "PNG"
    quality?: number
  }
  function convert(options: ConvertOptions): Promise<ArrayBuffer>
  export = convert
}
