/**
 * Sets the DPI of a JPEG blob by inserting/modifying the JFIF APP0 marker.
 * Returns a new Blob with 300 DPI metadata.
 */
export async function setJpegDpi(blob: Blob, dpi: number = 300): Promise<Blob> {
  const buffer = await blob.arrayBuffer();
  const data = new Uint8Array(buffer);

  // JFIF APP0 marker with specified DPI
  // Marker: FF E0, Length: 00 10 (16 bytes), "JFIF\0", version 1.1,
  // units=1 (dots per inch), Xdensity, Ydensity, no thumbnail
  const jfifHeader = new Uint8Array([
    0xFF, 0xE0, // APP0 marker
    0x00, 0x10, // Length: 16
    0x4A, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
    0x01, 0x01, // Version 1.1
    0x01,       // Units: dots per inch
    (dpi >> 8) & 0xFF, dpi & 0xFF, // X density
    (dpi >> 8) & 0xFF, dpi & 0xFF, // Y density
    0x00, 0x00  // No thumbnail
  ]);

  // Check if there's already a JFIF segment (FF E0 right after FF D8)
  if (data[0] === 0xFF && data[1] === 0xD8) {
    if (data[2] === 0xFF && data[3] === 0xE0) {
      // Replace existing JFIF segment
      const existingLength = (data[4] << 8) | data[5];
      const segmentEnd = 4 + existingLength; // offset after the segment (after marker bytes 2+3)
      // Actually segment starts at index 2, length includes the 2 length bytes
      const fullSegmentLength = 2 + existingLength; // marker (2) + length field + rest
      const beforeSegment = data.slice(0, 2); // FF D8
      const afterSegment = data.slice(2 + fullSegmentLength);
      
      const result = new Uint8Array(beforeSegment.length + jfifHeader.length + afterSegment.length);
      result.set(beforeSegment, 0);
      result.set(jfifHeader, beforeSegment.length);
      result.set(afterSegment, beforeSegment.length + jfifHeader.length);
      return new Blob([result], { type: 'image/jpeg' });
    } else {
      // Insert JFIF segment after SOI marker
      const soi = data.slice(0, 2); // FF D8
      const rest = data.slice(2);
      
      const result = new Uint8Array(soi.length + jfifHeader.length + rest.length);
      result.set(soi, 0);
      result.set(jfifHeader, soi.length);
      result.set(rest, soi.length + jfifHeader.length);
      return new Blob([result], { type: 'image/jpeg' });
    }
  }

  // Not a valid JPEG, return as-is
  return blob;
}
