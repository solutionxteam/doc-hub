/**
 * Minimal ambient type declaration for heic-convert (no official @types package).
 */
declare module "heic-convert" {
  interface ConvertOptions {
    /** Input HEIC/HEIF as Uint8Array or Buffer */
    buffer: ArrayBuffer | Uint8Array
    /** Target format */
    format: "JPEG" | "PNG"
    /** Quality 0–1, used for JPEG output */
    quality?: number
  }

  function convert(options: ConvertOptions): Promise<ArrayBuffer>
  export = convert
}
