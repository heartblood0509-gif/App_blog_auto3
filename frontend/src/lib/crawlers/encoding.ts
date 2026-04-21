/**
 * Detects charset from HTTP response and decodes the body correctly.
 * Handles EUC-KR and other non-UTF-8 encodings common in Korean websites.
 */
export async function decodeResponse(response: Response): Promise<string> {
  const buffer = await response.arrayBuffer();

  // 1. Check Content-Type header for charset
  const contentType = response.headers.get("content-type") || "";
  const headerCharset = extractCharset(contentType);

  if (headerCharset && !isUtf8(headerCharset)) {
    return new TextDecoder(headerCharset).decode(buffer);
  }

  // 2. Quick scan of raw bytes for <meta charset="..."> (ASCII-safe even in EUC-KR)
  const preview = new TextDecoder("ascii", { fatal: false }).decode(
    buffer.slice(0, 4096)
  );
  const metaCharset =
    preview.match(/<meta[^>]+charset=["']?([^"'\s;>]+)/i)?.[1] ||
    preview.match(
      /<meta[^>]+content=["'][^"']*charset=([^"'\s;>]+)/i
    )?.[1];

  if (metaCharset && !isUtf8(metaCharset)) {
    return new TextDecoder(metaCharset).decode(buffer);
  }

  // 3. Default to UTF-8
  return new TextDecoder("utf-8").decode(buffer);
}

function isUtf8(charset: string): boolean {
  const normalized = charset.toLowerCase().replace(/[-_]/g, "");
  return normalized === "utf8";
}

function extractCharset(contentType: string): string | null {
  const match = contentType.match(/charset=([^\s;]+)/i);
  return match ? match[1].trim() : null;
}
