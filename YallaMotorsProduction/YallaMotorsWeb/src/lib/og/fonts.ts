import 'server-only';

import fs from 'node:fs/promises';
import path from 'node:path';

export interface OgFontConfig {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600 | 700;
  style: 'normal';
}

let cachedFontsPromise: Promise<OgFontConfig[]> | null = null;

export async function getCairoOgFonts(): Promise<OgFontConfig[]> {
  if (!cachedFontsPromise) {
    cachedFontsPromise = (async () => {
      const fontsDir = path.join(process.cwd(), 'public/fonts');
      const [boldData, semiBoldData, regularData] = await Promise.all([
        fs.readFile(path.join(fontsDir, 'Cairo-Bold.ttf')),
        fs.readFile(path.join(fontsDir, 'Cairo-SemiBold.ttf')),
        fs.readFile(path.join(fontsDir, 'Cairo-Regular.ttf')),
      ]);

      const toArrayBuffer = (buf: Buffer): ArrayBuffer => {
        const ab = new ArrayBuffer(buf.byteLength);
        const view = new Uint8Array(ab);
        view.set(buf);
        return ab;
      };

      return [
        {
          name: 'Cairo',
          data: toArrayBuffer(boldData),
          weight: 700 as const,
          style: 'normal' as const,
        },
        {
          name: 'Cairo',
          data: toArrayBuffer(semiBoldData),
          weight: 600 as const,
          style: 'normal' as const,
        },
        {
          name: 'Cairo',
          data: toArrayBuffer(regularData),
          weight: 400 as const,
          style: 'normal' as const,
        },
      ];
    })().catch((error) => {
      cachedFontsPromise = null;
      throw error;
    });
  }

  return cachedFontsPromise;
}
