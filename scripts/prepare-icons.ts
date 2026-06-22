import sharp from 'sharp';
import { readdir, mkdir } from 'fs/promises';
import { join } from 'path';

const SOURCE_DIR = join(import.meta.dirname, '../PNGs');
const OUTPUT_DIR = join(import.meta.dirname, '../public/icons/food');
const SIZE = 48;

const SKIP = ['food icons preview.png'];
const RENAMES: Record<string, string> = { 'baccon.png': 'bacon.png' };

function toKebab(filename: string): string {
  const renamed = RENAMES[filename] ?? filename;
  return renamed.toLowerCase().replace(/\s+/g, '-');
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const files = await readdir(SOURCE_DIR);
  const pngs = files.filter(f => f.endsWith('.png') && !SKIP.includes(f));

  let count = 0;
  for (const file of pngs) {
    const outName = toKebab(file);
    await sharp(join(SOURCE_DIR, file))
      .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(join(OUTPUT_DIR, outName));
    count++;
  }
  console.log(`Processed ${count} icons → ${OUTPUT_DIR}`);
}

main().catch(console.error);
