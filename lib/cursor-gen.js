'use strict';

/**
 * Cursor Generator
 *
 * Generates Windows .cur files (ICO type-2) for a given color and size.
 * Draws each cursor shape as pixel art onto a Jimp bitmap, then serializes
 * the DIB into the .cur binary format.
 *
 * The 15 standard Windows cursor slots:
 *   Arrow, Help, AppStarting, Wait, Crosshair, IBeam, NWPen, No,
 *   SizeNS, SizeWE, SizeNWSE, SizeNESW, SizeAll, UpArrow, Hand
 */

const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

// Parse a hex color string like "#00FF66" into { r, g, b }
function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

// Build a 32-bit RGBA integer for Jimp (RGBA big-endian: 0xRRGGBBAA)
function rgba(r, g, b, a = 255) {
  return ((r & 0xff) * 0x1000000 + (g & 0xff) * 0x10000 + (b & 0xff) * 0x100 + (a & 0xff)) >>> 0;
}

const TRANSPARENT = rgba(0, 0, 0, 0);

/**
 * Serialize a Jimp image to a .cur binary buffer.
 * .cur is identical to .ico (type = 2) with a hotspot embedded in the
 * reserved word of the directory entry.
 *
 * Format: ICONDIR + ICONDIRENTRY[] + BITMAPINFOHEADER + XOR_DIB + AND_MASK
 */
function jimpToCurBuffer(image, hotX, hotY) {
  const size = image.bitmap.width; // width == height (square cursors)
  const bpp = 32;

  // --- DIB header (BITMAPINFOHEADER, 40 bytes) ---
  const dibHeader = Buffer.alloc(40);
  dibHeader.writeUInt32LE(40, 0);        // biSize
  dibHeader.writeInt32LE(size, 4);       // biWidth
  dibHeader.writeInt32LE(size * 2, 8);   // biHeight (*2 because DIB includes AND mask)
  dibHeader.writeUInt16LE(1, 12);        // biPlanes
  dibHeader.writeUInt16LE(bpp, 14);      // biBitCount
  dibHeader.writeUInt32LE(0, 16);        // biCompression (BI_RGB)
  dibHeader.writeUInt32LE(0, 20);        // biSizeImage (0 = auto)
  dibHeader.writeInt32LE(0, 24);         // biXPelsPerMeter
  dibHeader.writeInt32LE(0, 28);         // biYPelsPerMeter
  dibHeader.writeUInt32LE(0, 32);        // biClrUsed
  dibHeader.writeUInt32LE(0, 36);        // biClrImportant

  // --- XOR bitmap (32bpp BGRA, bottom-up) ---
  const xorSize = size * size * 4;
  const xorBuf = Buffer.alloc(xorSize);
  for (let y = 0; y < size; y++) {
    const srcRow = size - 1 - y; // flip vertically (DIB is bottom-up)
    for (let x = 0; x < size; x++) {
      const pixel = Jimp.intToRGBA(image.getPixelColor(x, srcRow));
      const offset = (y * size + x) * 4;
      xorBuf[offset + 0] = pixel.b;
      xorBuf[offset + 1] = pixel.g;
      xorBuf[offset + 2] = pixel.r;
      xorBuf[offset + 3] = pixel.a;
    }
  }

  // --- AND mask (1bpp, bottom-up, rows padded to 32-bit boundary) ---
  // Bit = 1 means transparent, 0 means opaque. For 32-bit .cur with alpha,
  // Windows uses the alpha channel, but we provide the mask for compatibility.
  const rowBytes = Math.ceil(size / 32) * 4;
  const andBuf = Buffer.alloc(rowBytes * size, 0);
  for (let y = 0; y < size; y++) {
    const srcRow = size - 1 - y;
    for (let x = 0; x < size; x++) {
      const pixel = Jimp.intToRGBA(image.getPixelColor(x, srcRow));
      if (pixel.a < 128) {
        // Set bit to 1 (transparent)
        const bytePos = y * rowBytes + Math.floor(x / 8);
        const bit = 7 - (x % 8);
        andBuf[bytePos] |= (1 << bit);
      }
    }
  }

  const imageData = Buffer.concat([dibHeader, xorBuf, andBuf]);

  // --- ICONDIR (6 bytes) ---
  const iconDir = Buffer.alloc(6);
  iconDir.writeUInt16LE(0, 0);  // reserved
  iconDir.writeUInt16LE(2, 2);  // type = 2 (.cur)
  iconDir.writeUInt16LE(1, 4);  // count = 1 image

  // --- ICONDIRENTRY (16 bytes) ---
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size > 255 ? 0 : size, 0); // width (0 = 256)
  entry.writeUInt8(size > 255 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2);                      // colorCount (0 for 32bpp)
  entry.writeUInt8(0, 3);                      // reserved
  entry.writeUInt16LE(hotX, 4);               // xHotspot
  entry.writeUInt16LE(hotY, 6);               // yHotspot
  entry.writeUInt32LE(imageData.length, 8);   // dwBytesInRes
  entry.writeUInt32LE(6 + 16, 12);            // dwImageOffset (after ICONDIR + 1 entry)

  return Buffer.concat([iconDir, entry, imageData]);
}

// ─── Shape Painters ──────────────────────────────────────────────────────────
// Each painter receives (image, size, fg, outline) and draws into image.
// fg/outline are Jimp RGBA integers.

function paintArrow(image, size, fg, outline) {
  // Classic upper-left arrow. Scales with size.
  const scale = size / 32;
  const tip = Math.round(2 * scale);
  const arrowLen = Math.round(22 * scale);
  const shaftW = Math.round(8 * scale);

  // Draw filled arrow polygon pixel-by-pixel
  for (let y = tip; y < arrowLen; y++) {
    const width = Math.round((y - tip) * (shaftW / (arrowLen - tip)));
    for (let x = tip; x <= tip + width; x++) {
      image.setPixelColor(fg, x, y);
    }
  }
  // Shaft
  const shaftStart = Math.round(arrowLen * 0.55);
  const shaftEnd = Math.round(arrowLen * 0.95);
  const shaftLeft = tip + Math.round(shaftW * 0.3);
  const shaftRight = tip + Math.round(shaftW * 0.7);
  for (let y = shaftStart; y < shaftEnd; y++) {
    for (let x = shaftLeft; x <= shaftRight; x++) {
      image.setPixelColor(fg, x, y);
    }
  }
  // Outline (1px border)
  for (let y = tip - 1; y < arrowLen + 1; y++) {
    for (let x = tip - 1; x <= tip + Math.round((y - tip + 1) * (shaftW / (arrowLen - tip))) + 1; x++) {
      if (Jimp.intToRGBA(image.getPixelColor(x, y)).a === 0) {
        const neighbors = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && ny >= 0 && nx < size && ny < size) {
            const pix = Jimp.intToRGBA(image.getPixelColor(nx, ny));
            if (pix.a > 0) { image.setPixelColor(outline, x, y); break; }
          }
        }
      }
    }
  }
}

function paintCross(image, size, fg, outline) {
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);
  const arm = Math.floor(size * 0.45);
  const thick = Math.max(1, Math.floor(size * 0.05));

  for (let i = -arm; i <= arm; i++) {
    for (let t = -thick; t <= thick; t++) {
      if (cx + i >= 0 && cx + i < size) image.setPixelColor(fg, cx + i, cy + t);
      if (cy + i >= 0 && cy + i < size) image.setPixelColor(fg, cx + t, cy + i);
    }
  }
}

function paintIBeam(image, size, fg, _outline) {
  const cx = Math.floor(size / 2);
  const barH = Math.floor(size * 0.75);
  const barTop = Math.floor((size - barH) / 2);
  const capW = Math.floor(size * 0.25);
  const capH = Math.max(1, Math.floor(size * 0.04));

  // vertical bar
  for (let y = barTop; y < barTop + barH; y++) {
    image.setPixelColor(fg, cx, y);
  }
  // top cap
  for (let x = cx - capW; x <= cx + capW; x++) {
    for (let dy = 0; dy < capH; dy++) image.setPixelColor(fg, x, barTop + dy);
  }
  // bottom cap
  for (let x = cx - capW; x <= cx + capW; x++) {
    for (let dy = 0; dy < capH; dy++) image.setPixelColor(fg, x, barTop + barH - 1 - dy);
  }
}

function paintHourglass(image, size, fg, _outline) {
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);
  const r = Math.floor(size * 0.38);

  for (let y = cy - r; y <= cy + r; y++) {
    const t = Math.abs(y - cy) / r;
    const halfW = Math.floor(r * t);
    for (let x = cx - halfW; x <= cx + halfW; x++) {
      image.setPixelColor(fg, x, y);
    }
  }
  // hourglass frame lines
  for (let x = cx - r; x <= cx + r; x++) {
    image.setPixelColor(fg, x, cy - r);
    image.setPixelColor(fg, x, cy + r);
  }
}

function paintHand(image, size, fg, outline) {
  const scale = size / 32;
  const palmTop = Math.round(14 * scale);
  const palmBot = Math.round(28 * scale);
  const palmLeft = Math.round(6 * scale);
  const palmRight = Math.round(22 * scale);
  const fingerW = Math.max(2, Math.round(3 * scale));
  const indexTop = Math.round(4 * scale);

  // Index finger (pointing up)
  for (let y = indexTop; y < palmTop; y++) {
    for (let x = palmLeft + Math.round(4 * scale); x < palmLeft + Math.round(4 * scale) + fingerW; x++) {
      if (x >= 0 && x < size && y >= 0 && y < size) image.setPixelColor(fg, x, y);
    }
  }
  // Middle, ring, pinky fingers (shorter)
  const fingers = [
    { ox: Math.round(8 * scale), top: Math.round(8 * scale) },
    { ox: Math.round(12 * scale), top: Math.round(9 * scale) },
    { ox: Math.round(16 * scale), top: Math.round(11 * scale) },
  ];
  for (const f of fingers) {
    for (let y = f.top; y < palmTop; y++) {
      for (let x = palmLeft + f.ox; x < palmLeft + f.ox + fingerW; x++) {
        if (x >= 0 && x < size && y >= 0 && y < size) image.setPixelColor(fg, x, y);
      }
    }
  }
  // Palm
  for (let y = palmTop; y <= palmBot; y++) {
    for (let x = palmLeft; x <= palmRight; x++) {
      image.setPixelColor(fg, x, y);
    }
  }
}

function paintResizeNS(image, size, fg, _outline) {
  const cx = Math.floor(size / 2);
  const arrowH = Math.floor(size * 0.3);
  const shaftH = Math.floor(size * 0.4);
  const arrowHalfW = Math.floor(size * 0.2);
  const shaftHalfW = Math.floor(size * 0.06);

  // Top arrow
  for (let i = 0; i <= arrowH; i++) {
    const w = Math.floor(arrowHalfW * (1 - i / arrowH));
    for (let x = cx - w; x <= cx + w; x++) {
      image.setPixelColor(fg, x, i + 1);
    }
  }
  // Bottom arrow
  for (let i = 0; i <= arrowH; i++) {
    const w = Math.floor(arrowHalfW * (1 - i / arrowH));
    for (let x = cx - w; x <= cx + w; x++) {
      image.setPixelColor(fg, x, size - 2 - i);
    }
  }
  // Shaft
  for (let y = arrowH; y <= size - arrowH; y++) {
    for (let x = cx - shaftHalfW; x <= cx + shaftHalfW; x++) {
      image.setPixelColor(fg, x, y);
    }
  }
}

function paintResizeWE(image, size, fg, _outline) {
  const cy = Math.floor(size / 2);
  const arrowW = Math.floor(size * 0.3);
  const arrowHalfH = Math.floor(size * 0.2);
  const shaftHalfH = Math.floor(size * 0.06);

  // Left arrow
  for (let i = 0; i <= arrowW; i++) {
    const h = Math.floor(arrowHalfH * (1 - i / arrowW));
    for (let y = cy - h; y <= cy + h; y++) {
      image.setPixelColor(fg, i + 1, y);
    }
  }
  // Right arrow
  for (let i = 0; i <= arrowW; i++) {
    const h = Math.floor(arrowHalfH * (1 - i / arrowW));
    for (let y = cy - h; y <= cy + h; y++) {
      image.setPixelColor(fg, size - 2 - i, y);
    }
  }
  // Shaft
  for (let x = arrowW; x <= size - arrowW; x++) {
    for (let y = cy - shaftHalfH; y <= cy + shaftHalfH; y++) {
      image.setPixelColor(fg, x, y);
    }
  }
}

function paintResizeAll(image, size, fg, _outline) {
  paintResizeNS(image, size, fg, _outline);
  paintResizeWE(image, size, fg, _outline);
}

function paintDiagArrow(image, size, fg, _outline, flip = false) {
  const arm = Math.floor(size * 0.35);
  const tipOff = Math.floor(size * 0.1);
  const arrowHead = Math.floor(size * 0.12);

  for (let i = 0; i < arm; i++) {
    const x = flip ? size - 1 - tipOff - i : tipOff + i;
    const y = tipOff + i;
    image.setPixelColor(fg, x, y);
    image.setPixelColor(fg, x, y + 1);
    image.setPixelColor(fg, x + (flip ? -1 : 1), y);
  }
  // arrowheads
  for (let d = 0; d < arrowHead; d++) {
    const x0 = flip ? size - 1 - tipOff - d : tipOff + d;
    for (let dd = 0; dd <= d; dd++) {
      image.setPixelColor(fg, x0, tipOff + dd);
    }
  }
}

function paintNoBan(image, size, fg, _outline) {
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);
  const r = Math.floor(size * 0.4);
  const thick = Math.max(2, Math.floor(size * 0.1));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= r - thick && dist <= r) {
        image.setPixelColor(fg, x, y);
      }
    }
  }
  // diagonal line through circle
  for (let i = -r; i <= r; i++) {
    for (let t = -thick / 2; t <= thick / 2; t++) {
      const x = cx + i + Math.round(t);
      const y = cy - i;
      if (x >= 0 && x < size && y >= 0 && y < size) {
        image.setPixelColor(fg, x, y);
      }
    }
  }
}

function paintUpArrow(image, size, fg, _outline) {
  const cx = Math.floor(size / 2);
  const arrowH = Math.floor(size * 0.55);
  const arrowHalfW = Math.floor(size * 0.22);
  const shaftHalfW = Math.floor(size * 0.07);

  for (let i = 0; i <= arrowH; i++) {
    const t = i / arrowH;
    const w = arrowHalfW - Math.floor((arrowHalfW - shaftHalfW) * 0.5 * t);
    const capped = i < arrowH * 0.5 ? Math.floor(arrowHalfW * (1 - t * 2)) : shaftHalfW;
    for (let x = cx - Math.max(capped, shaftHalfW); x <= cx + Math.max(capped, shaftHalfW); x++) {
      image.setPixelColor(fg, x, i + 1);
    }
    void w;
  }
}

function paintPen(image, size, fg, _outline) {
  const scale = size / 32;
  const tipX = Math.round(4 * scale);
  const tipY = Math.round(28 * scale);

  for (let i = 0; i < Math.round(20 * scale); i++) {
    const x = tipX + i;
    const y = tipY - i;
    if (x >= 0 && x < size && y >= 0 && y < size) {
      image.setPixelColor(fg, x, y);
      image.setPixelColor(fg, x + 1, y);
    }
  }
}

// ─── Extra pointer shapes (user-selectable) ───────────────────────────────────

function paintThickArrow(image, size, fg, outline) {
  // Bold chunky arrow, upper-left pointing
  const s = size / 32;
  const tip = Math.round(2 * s);
  const arrowLen = Math.round(24 * s);
  const shaftW = Math.round(12 * s);   // wider than standard arrow

  for (let y = tip; y < arrowLen; y++) {
    const frac = (y - tip) / (arrowLen - tip);
    const halfW = Math.round(frac * shaftW / 2);
    for (let x = tip; x <= tip + halfW * 2; x++) {
      image.setPixelColor(fg, x, y);
    }
  }
  // Thick shaft
  const shaftLeft  = tip + Math.round(shaftW * 0.22);
  const shaftRight = tip + Math.round(shaftW * 0.78);
  for (let y = Math.round(arrowLen * 0.5); y < Math.round(arrowLen * 0.97); y++) {
    for (let x = shaftLeft; x <= shaftRight; x++) {
      image.setPixelColor(fg, x, y);
    }
  }
  // Outline pass
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (Jimp.intToRGBA(image.getPixelColor(x, y)).a === 0) {
        const nbrs = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
        for (const [nx, ny] of nbrs) {
          if (nx >= 0 && ny >= 0 && nx < size && ny < size &&
              Jimp.intToRGBA(image.getPixelColor(nx, ny)).a > 0) {
            image.setPixelColor(outline, x, y);
            break;
          }
        }
      }
    }
  }
}

function paintStar(image, size, fg, outline) {
  // 5-pointed star centred in the bitmap
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.46;
  const innerR = outerR * 0.4;
  const points = 5;

  // Build star polygon vertices
  const verts = [];
  for (let i = 0; i < points * 2; i++) {
    const angle = (i * Math.PI / points) - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    verts.push({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  }

  // Scanline fill
  for (let y = 0; y < size; y++) {
    const intersections = [];
    for (let i = 0; i < verts.length; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % verts.length];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        const t = (y - a.y) / (b.y - a.y);
        intersections.push(a.x + t * (b.x - a.x));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length - 1; i += 2) {
      for (let x = Math.ceil(intersections[i]); x <= Math.floor(intersections[i + 1]); x++) {
        if (x >= 0 && x < size) image.setPixelColor(fg, x, y);
      }
    }
  }
  // Outline pass
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (Jimp.intToRGBA(image.getPixelColor(x, y)).a === 0) {
        const nbrs = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
        for (const [nx, ny] of nbrs) {
          if (nx >= 0 && ny >= 0 && nx < size && ny < size &&
              Jimp.intToRGBA(image.getPixelColor(nx, ny)).a > 0) {
            image.setPixelColor(outline, x, y);
            break;
          }
        }
      }
    }
  }
}

function paintCirclePointer(image, size, fg, outline) {
  // Filled circle with a small contrasting dot at center
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);
  const outerR = size * 0.44;
  const dotR   = Math.max(2, size * 0.08);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= outerR) {
        image.setPixelColor(fg, x, y);
      }
    }
  }
  // Outline ring
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > outerR && d <= outerR + Math.max(2, size * 0.05)) {
        image.setPixelColor(outline, x, y);
      }
    }
  }
  // Center dot (contrasting — transparent hole)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      if (Math.sqrt(dx * dx + dy * dy) <= dotR) {
        image.setPixelColor(outline, x, y);
      }
    }
  }
}

function paintDiamond(image, size, fg, outline) {
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);
  const r = Math.floor(size * 0.44);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (Math.abs(x - cx) + Math.abs(y - cy) <= r) {
        image.setPixelColor(fg, x, y);
      }
    }
  }
  // Outline (1-2px border outside diamond)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (Jimp.intToRGBA(image.getPixelColor(x, y)).a === 0) {
        const nbrs = [[x-1,y],[x+1,y],[x,y-1],[x,y+1],[x-1,y-1],[x+1,y+1],[x-1,y+1],[x+1,y-1]];
        for (const [nx, ny] of nbrs) {
          if (nx >= 0 && ny >= 0 && nx < size && ny < size &&
              Jimp.intToRGBA(image.getPixelColor(nx, ny)).a > 0) {
            image.setPixelColor(outline, x, y);
            break;
          }
        }
      }
    }
  }
}

function paintCrossPointer(image, size, fg, outline) {
  // Plus/cross shape that fills most of the canvas
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);
  const arm  = Math.floor(size * 0.46);
  const half = Math.max(2, Math.floor(size * 0.14));

  for (let i = -arm; i <= arm; i++) {
    for (let t = -half; t <= half; t++) {
      if (cx + i >= 0 && cx + i < size && cy + t >= 0 && cy + t < size)
        image.setPixelColor(fg, cx + i, cy + t);
      if (cx + t >= 0 && cx + t < size && cy + i >= 0 && cy + i < size)
        image.setPixelColor(fg, cx + t, cy + i);
    }
  }
  // Rounded ends via outline pass
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (Jimp.intToRGBA(image.getPixelColor(x, y)).a === 0) {
        const nbrs = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
        for (const [nx, ny] of nbrs) {
          if (nx >= 0 && ny >= 0 && nx < size && ny < size &&
              Jimp.intToRGBA(image.getPixelColor(nx, ny)).a > 0) {
            image.setPixelColor(outline, x, y);
            break;
          }
        }
      }
    }
  }
}

function paintHandPointer(image, size, fg, outline) {
  // Reuse existing hand painter (already defined above)
  paintHand(image, size, fg, outline);
}

// Map of shape id → { painter, hotX, hotY }
// hotX/hotY are fractions of (size-1)
const POINTER_SHAPES = {
  'arrow':       { painter: paintArrow,        hotX: 0,   hotY: 0   },
  'thick-arrow': { painter: paintThickArrow,   hotX: 0,   hotY: 0   },
  'star':        { painter: paintStar,          hotX: 0.5, hotY: 0.5 },
  'circle':      { painter: paintCirclePointer, hotX: 0.5, hotY: 0.5 },
  'diamond':     { painter: paintDiamond,       hotX: 0.5, hotY: 0.5 },
  'cross':       { painter: paintCrossPointer,  hotX: 0.5, hotY: 0.5 },
  'hand':        { painter: paintHandPointer,   hotX: 0.3, hotY: 0.1 },
};

// ─── Cursor Slot Definitions ─────────────────────────────────────────────────
// Slots marked isPointer:true get the user-chosen shape.
// All others keep their functional shape (resize arrows, I-beam, etc.)

const CURSOR_SLOTS = [
  { name: 'Arrow',       reg: 'Arrow',      isPointer: true,  hotX: 0,   hotY: 0   },
  { name: 'Help',        reg: 'Help',        isPointer: true,  hotX: 0,   hotY: 0   },
  { name: 'AppStarting', reg: 'AppStarting', isPointer: false, painter: paintHourglass, hotX: 0.5, hotY: 0.5 },
  { name: 'Wait',        reg: 'Wait',        isPointer: false, painter: paintHourglass, hotX: 0.5, hotY: 0.5 },
  { name: 'Crosshair',   reg: 'Crosshair',   isPointer: false, painter: paintCross,     hotX: 0.5, hotY: 0.5 },
  { name: 'IBeam',       reg: 'IBeam',       isPointer: false, painter: paintIBeam,     hotX: 0.5, hotY: 0.5 },
  { name: 'NWPen',       reg: 'NWPen',       isPointer: false, painter: paintPen,       hotX: 0,   hotY: 1   },
  { name: 'No',          reg: 'No',          isPointer: false, painter: paintNoBan,     hotX: 0.5, hotY: 0.5 },
  { name: 'SizeNS',      reg: 'SizeNS',      isPointer: false, painter: paintResizeNS,  hotX: 0.5, hotY: 0.5 },
  { name: 'SizeWE',      reg: 'SizeWE',      isPointer: false, painter: paintResizeWE,  hotX: 0.5, hotY: 0.5 },
  { name: 'SizeNWSE',    reg: 'SizeNWSE',    isPointer: false, painter: (img, s, fg, ol) => paintDiagArrow(img, s, fg, ol, false), hotX: 0.5, hotY: 0.5 },
  { name: 'SizeNESW',    reg: 'SizeNESW',    isPointer: false, painter: (img, s, fg, ol) => paintDiagArrow(img, s, fg, ol, true),  hotX: 0.5, hotY: 0.5 },
  { name: 'SizeAll',     reg: 'SizeAll',     isPointer: false, painter: paintResizeAll, hotX: 0.5, hotY: 0.5 },
  { name: 'UpArrow',     reg: 'UpArrow',     isPointer: false, painter: paintUpArrow,   hotX: 0.5, hotY: 0   },
  { name: 'Hand',        reg: 'Hand',        isPointer: false, painter: paintHand,      hotX: 0.3, hotY: 0.1 },
];

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate all 15 cursor .cur files for a given color, size, and pointer shape.
 * @param {string} color   Hex color e.g. "#00ff66"
 * @param {number} size    Cursor bitmap size in pixels (24–256)
 * @param {string} outputDir  Directory to write .cur files into
 * @param {string} [shape='arrow']  Shape id from POINTER_SHAPES
 */
async function generateCursorSet(color, size, outputDir, shape = 'arrow') {
  fs.mkdirSync(outputDir, { recursive: true });

  const { r, g, b } = hexToRgb(color);
  const outR = Math.floor(r * 0.25);
  const outG = Math.floor(g * 0.25);
  const outB = Math.floor(b * 0.25);
  const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
  const ol = brightness < 60
    ? rgba(220, 220, 220, 255)
    : rgba(outR, outG, outB, 255);

  const fg = rgba(r, g, b, 255);

  // Look up the user-chosen pointer shape (fallback to arrow)
  const pointerShape = POINTER_SHAPES[shape] || POINTER_SHAPES['arrow'];

  const filePaths = {};

  for (const slot of CURSOR_SLOTS) {
    const image = new Jimp(size, size, TRANSPARENT);

    let painter, hotXpx, hotYpx;

    if (slot.isPointer) {
      painter  = pointerShape.painter;
      hotXpx   = Math.round(pointerShape.hotX * (size - 1));
      hotYpx   = Math.round(pointerShape.hotY * (size - 1));
    } else {
      painter  = slot.painter;
      hotXpx   = Math.round(slot.hotX * (size - 1));
      hotYpx   = Math.round(slot.hotY * (size - 1));
    }

    painter(image, size, fg, ol);

    const curBuf = jimpToCurBuffer(image, hotXpx, hotYpx);
    const filePath = path.join(outputDir, `${slot.name}.cur`);
    fs.writeFileSync(filePath, curBuf);
    filePaths[slot.reg] = filePath;
  }

  return filePaths;
}

module.exports = { generateCursorSet, CURSOR_SLOTS, POINTER_SHAPES };
