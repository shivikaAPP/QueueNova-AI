import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createPngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcPayload = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcPayload);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, crcPayload, crcBuf]);
}

function createPng(width, height, r, g, b) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = createPngChunk('IHDR', ihdrData);

  // Scanlines with 3 rising bars
  const rawBytes = [];
  for (let y = 0; y < height; y++) {
    rawBytes.push(0); // filter: none
    for (let x = 0; x < width; x++) {
      const nx = x / width;
      const ny = y / height;

      // Check if pixel is within the 3 bars or teal background #0E5A63
      let isBar = false;
      // Bar 1: x 14/64 to 22/64, y 32/64 to 50/64
      if (nx >= 14 / 64 && nx <= 22 / 64 && ny >= 32 / 64 && ny <= 50 / 64) isBar = true;
      // Bar 2: x 28/64 to 36/64, y 22/64 to 50/64
      if (nx >= 28 / 64 && nx <= 36 / 64 && ny >= 22 / 64 && ny <= 50 / 64) isBar = true;
      // Bar 3: x 42/64 to 50/64, y 12/64 to 50/64
      if (nx >= 42 / 64 && nx <= 50 / 64 && ny >= 12 / 64 && ny <= 50 / 64) isBar = true;

      if (isBar) {
        rawBytes.push(0xf7, 0xf8, 0xf6, 255); // #F7F8F6
      } else {
        rawBytes.push(r, g, b, 255); // #0E5A63 (14, 90, 99)
      }
    }
  }

  const compressed = zlib.deflateSync(Buffer.from(rawBytes));
  const idatChunk = createPngChunk('IDAT', compressed);
  const iendChunk = createPngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate files:
// #0E5A63 is RGB(14, 90, 99)
const r = 14, g = 90, b = 99;

const png32 = createPng(32, 32, r, g, b);
fs.writeFileSync(path.join(publicDir, 'favicon-32.png'), png32);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), png32); // Valid PNG in ico or PNG format

const png180 = createPng(180, 180, r, g, b);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png180);

const png192 = createPng(192, 192, r, g, b);
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), png192);

const png512 = createPng(512, 512, r, g, b);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), png512);

console.log('Icons generated successfully.');
