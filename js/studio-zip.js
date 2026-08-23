/* FPL Challenge Studio — shared standards-compliant ZIP writer.
   Keeps validated package downloads available without the retired Publishing Centre. */
(() => {
  "use strict";

  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
      let value = index;
      for (let bit = 0; bit < 8; bit += 1) {
        value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      }
      table[index] = value >>> 0;
    }
    return table;
  })();

  function uint16(value) {
    return new Uint8Array([value & 0xff, (value >>> 8) & 0xff]);
  }

  function uint32(value) {
    return new Uint8Array([
      value & 0xff,
      (value >>> 8) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 24) & 0xff
    ]);
  }

  function concatBytes(parts) {
    const arrays = parts.map(part => part instanceof Uint8Array ? part : new Uint8Array(part));
    const length = arrays.reduce((sum, part) => sum + part.byteLength, 0);
    const output = new Uint8Array(length);
    let offset = 0;
    for (const part of arrays) {
      output.set(part, offset);
      offset += part.byteLength;
    }
    return output;
  }

  function toDosDateTime(date) {
    const year = Math.max(1980, date.getFullYear());
    return {
      time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
      date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
    };
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }

  function contentBytes(content, encoder) {
    if (content instanceof Uint8Array) return content;
    if (content instanceof ArrayBuffer) return new Uint8Array(content);
    if (ArrayBuffer.isView(content)) return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
    return encoder.encode(String(content ?? ""));
  }

  /* Minimal ZIP writer using stored (uncompressed) entries. */
  function buildZipBlob(files) {
    if (!Array.isArray(files)) throw new TypeError("ZIP files must be supplied as an array.");

    const encoder = new TextEncoder();
    const dos = toDosDateTime(new Date());
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    for (const file of files) {
      const name = String(file?.name || "");
      if (!name) throw new Error("Every ZIP entry needs a file name.");
      const nameBytes = encoder.encode(name);
      const data = contentBytes(file?.content, encoder);
      const checksum = crc32(data);

      const localHeader = concatBytes([
        uint32(0x04034b50),
        uint16(20),
        uint16(0),
        uint16(0),
        uint16(dos.time),
        uint16(dos.date),
        uint32(checksum),
        uint32(data.byteLength),
        uint32(data.byteLength),
        uint16(nameBytes.byteLength),
        uint16(0),
        nameBytes
      ]);
      localParts.push(localHeader, data);

      centralParts.push(concatBytes([
        uint32(0x02014b50),
        uint16(20),
        uint16(20),
        uint16(0),
        uint16(0),
        uint16(dos.time),
        uint16(dos.date),
        uint32(checksum),
        uint32(data.byteLength),
        uint32(data.byteLength),
        uint16(nameBytes.byteLength),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(0),
        uint32(offset),
        nameBytes
      ]));

      offset += localHeader.byteLength + data.byteLength;
    }

    const centralDirectory = concatBytes(centralParts);
    const endRecord = concatBytes([
      uint32(0x06054b50),
      uint16(0),
      uint16(0),
      uint16(files.length),
      uint16(files.length),
      uint32(centralDirectory.byteLength),
      uint32(offset),
      uint16(0)
    ]);

    return new Blob([...localParts, centralDirectory, endRecord], { type: "application/zip" });
  }

  window.FPL_STUDIO_ZIP = Object.freeze({ buildZipBlob });
})();
