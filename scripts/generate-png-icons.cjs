const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create an uncompressed or zlib-compressed raw RGBA PNG
function createSolidPng(width, height, r, g, b, a = 255) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // Helper to write chunk
  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);

    const typeBuf = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeBuf, data]);

    const crc = calcCrc(body);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc, 0);

    return Buffer.concat([len, body, crcBuf]);
  }

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth 8
  ihdr.writeUInt8(6, 9); // RGBA color type
  ihdr.writeUInt8(0, 10); // compression method 0
  ihdr.writeUInt8(0, 11); // filter method 0
  ihdr.writeUInt8(0, 12); // interlace method 0

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image scanlines
  // Each line starts with filter byte 0
  const rowLen = 1 + width * 4;
  const rawData = Buffer.alloc(rowLen * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLen;
    rawData[rowOffset] = 0; // filter None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      // Draw rounded squircle / store pattern
      const cx = width / 2;
      const cy = height / 2;
      const dx = Math.abs(x - cx) / (width / 2);
      const dy = Math.abs(y - cy) / (height / 2);
      const dist = Math.pow(dx, 4) + Math.pow(dy, 4); // squircle distance

      if (dist <= 1.0) {
        // Inside squircle
        // Check if inside central white square / cashier outline
        const innerDistX = Math.abs(x - cx);
        const innerDistY = Math.abs(y - cy);
        if (innerDistX < width * 0.28 && innerDistY < height * 0.25) {
          // Inner register / screen
          if (innerDistY > height * 0.05 && innerDistY < height * 0.15 && innerDistX < width * 0.22) {
            // Dark screen
            rawData[pxOffset] = 15;
            rawData[pxOffset + 1] = 23;
            rawData[pxOffset + 2] = 42;
            rawData[pxOffset + 3] = 255;
          } else {
            // White body
            rawData[pxOffset] = 255;
            rawData[pxOffset + 1] = 255;
            rawData[pxOffset + 2] = 255;
            rawData[pxOffset + 3] = 255;
          }
        } else {
          // Emerald green gradient
          const grad = Math.min(255, Math.floor(r + (y / height) * 20));
          rawData[pxOffset] = grad;
          rawData[pxOffset + 1] = g;
          rawData[pxOffset + 2] = b;
          rawData[pxOffset + 3] = a;
        }
      } else {
        // Transparent outside
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) c = 0xedb88320 ^ (c >>> 1);
    else c = c >>> 1;
  }
  crcTable[n] = c;
}

function calcCrc(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate 192x192, 512x512, apple-touch-icon 180x180, and maskable 512x512
const png192 = createSolidPng(192, 192, 5, 150, 105);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);

const png512 = createSolidPng(512, 512, 5, 150, 105);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);

const pngApple = createSolidPng(180, 180, 5, 150, 105);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), pngApple);

const pngMaskable = createSolidPng(512, 512, 5, 150, 105);
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pngMaskable);

console.log('PNG icons generated successfully.');
