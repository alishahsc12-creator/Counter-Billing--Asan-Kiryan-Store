import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from './db.ts';

export const PRODUCTS_IMG_DIR = path.resolve(process.cwd(), 'src/assets/images/products');

function ensureProductsImgDir(): void {
  if (!fs.existsSync(PRODUCTS_IMG_DIR)) {
    fs.mkdirSync(PRODUCTS_IMG_DIR, { recursive: true });
  }
}

export const OLD_GROUP_IMAGES = new Set([
  '/src/assets/images/kiryana_sugar_rice_1794331152278.jpg',
  '/src/assets/images/kiryana_atta_flour_1794331152849.jpg',
  '/src/assets/images/kiryana_cooking_oil_1794331152495.jpg',
  '/src/assets/images/kiryana_tea_milk_1794331153531.jpg',
  '/src/assets/images/kiryana_biscuits_cola_1794331153557.jpg',
  '/src/assets/images/kiryana_soap_detergent_1794331154312.jpg',
  '/src/assets/images/kiryana_spices_salt_1794331154537.jpg',
  '/src/assets/images/kiryana_pulses_lentils_1794331154837.jpg',
]);

// Curated search terms for known Pakistani Kiryana products to guarantee exact single-pack matches
const QUERY_OVERRIDES: Array<{ match: RegExp; query: string }> = [
  { match: /\bolper'?s?\b/i, query: "Olpers Full Cream Milk 1 Litre single pack white background" },
  { match: /\bshan\b.*\bbiryani\b/i, query: 'Shan Bombay Biryani Masala 50g single box pakistan' },
  { match: /\btapal\b.*\bdanedar\b/i, query: 'Tapal Danedar Tea 190g pack pakistan' },
  { match: /\bprince\b.*\bbiscuit/i, query: 'LU Prince Chocolate Biscuits single half roll pack pakistan' },
  { match: /\bsooper\b/i, query: 'Peek Freans Sooper Egg Milk Biscuits Family Pack yellow' },
  { match: /\bdalda\b.*\boil\b/i, query: 'Dalda Cooking Oil 1 Litre pouch pakistan' },
  { match: /\bhabib\b.*\bghee\b/i, query: 'Habib Banaspati Ghee 1 Kg pack pakistan' },
  { match: /\bcoca[\s-]*cola\b|\bcoke\b/i, query: 'Coca Cola 1.5 Litre bottle pakistan' },
  { match: /\blux\b.*\bsoap\b/i, query: 'Lux Velvet Glow Soap 115g single bar pack pakistan' },
  { match: /\bsurf\s*excel\b/i, query: 'Surf Excel Washing Powder 500g pack pakistan' },
  { match: /\bsunsilk\b/i, query: 'Sunsilk Black Shine Shampoo 170ml bottle pakistan' },
  { match: /\bnational\b.*\bsalt\b/i, query: 'National Iodized Refined Salt 800g packet' },
  { match: /\bnational\b.*\bchilli\b/i, query: 'National Red Chilli Powder 200g pack pakistan' },
  { match: /\blifebuoy\b.*\bsoap\b/i, query: 'Lifebuoy Total 10 Soap 115g red pack' },
  { match: /\btang\b.*\bmango\b/i, query: 'Tang Mango Drink 375g pack pakistan' },
  { match: /\bchini\b|\bwhite\s*sugar\b/i, query: 'White Sugar 1kg packet pakistan grocery' },
  { match: /\bbasmati\b.*\brice\b/i, query: 'Super Kernel Basmati Rice 1kg pack pakistan' },
  { match: /\bchakki\b.*\batta\b/i, query: 'Chakki Atta 10 Kg Bag pakistan' },
  { match: /\bdaal\s*chana\b/i, query: 'Daal Chana 1kg pack pakistan' },
  { match: /\bdaal\s*masoor\b/i, query: 'Daal Masoor red lentils 1kg pack' },
];

const PREFERRED_DOMAINS = [
  'static-01.daraz.pk',
  'img.drz.lazcdn.com',
  'dsmonline.pk',
  'cdn.mafrservices.com',
  'cdnprod.mafretailproxy.com',
  'gradeonemart.pk',
  'nazarjanssupermarket.com',
  'qne.com.pk',
  'springs.com.pk',
  'dhamart.pk',
  'ishopping.pk',
  'gomart.pk',
  'pictures.grocerapps.com',
  'images.openfoodfacts.org',
  'm.media-amazon.com',
  'images.othoba.com',
];

const BLOCKED_DOMAINS = [
  'media.naheed.pk',
  'royalhyper.com',
  'shutterstock.com',
  'alamy.com',
  'istockphoto.com',
  'gettyimages.com',
  'depositphotos.com',
  '123rf.com',
  'dreamstime.com',
  'vecteezy.com',
  'facebook.com',
  'instagram.com',
  'youtube.com',
];

function scoreUrl(url: string): number {
  const lower = url.toLowerCase();
  if (BLOCKED_DOMAINS.some((d) => lower.includes(d))) return -100;
  if (
    lower.includes('placeholder') ||
    lower.includes('no-image') ||
    lower.includes('noimage') ||
    lower.includes('/default.')
  ) {
    return -100;
  }
  let score = 0;
  for (let i = 0; i < PREFERRED_DOMAINS.length; i++) {
    if (lower.includes(PREFERRED_DOMAINS[i])) {
      score += 50 - i * 2;
      break;
    }
  }
  if (lower.startsWith('https://')) score += 5;
  if (/\.(jpe?g|png|webp)(\?|$)/i.test(lower)) score += 10;
  if (lower.includes('bundle') || lower.includes('combo') || lower.includes('pack-of') || lower.includes('12-pack')) {
    score -= 15;
  }
  return score;
}

function buildSearchQuery(productName: string, category?: string): string {
  const clean = productName.trim();
  for (const rule of QUERY_OVERRIDES) {
    if (rule.match.test(clean)) {
      return rule.query;
    }
  }
  const catHint = category && category !== 'General' ? ` ${category}` : '';
  return `${clean}${catHint} pack pakistan`.trim();
}

function detectImageExtension(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length < 2000 || buf.length > 4 * 1024 * 1024) return null;
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  // PNG: 89 50 4E 47
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  // WEBP: RIFF....WEBP
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

async function fetchWithTimeout(url: string, timeoutMs = 6000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/*;q=0.8,*/*;q=0.7',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function searchBingImageCandidates(query: string): Promise<string[]> {
  try {
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&qft=+filterui:imagesize-medium`;
    const res = await fetchWithTimeout(searchUrl, 6000);
    if (!res.ok) return [];
    const html = await res.text();
    const urls = [...html.matchAll(/murl&quot;:&quot;(https?:\/\/[^&]+)&quot;/g)].map((m) =>
      m[1].replace(/&amp;/g, '&')
    );
    const unique = Array.from(new Set(urls));
    return unique
      .map((u) => ({ u, s: scoreUrl(u) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.u)
      .slice(0, 10);
  } catch {
    return [];
  }
}

async function searchOpenFoodFactsCandidates(query: string): Promise<string[]> {
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      query
    )}&search_simple=1&action=process&json=1&page_size=5`;
    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      products?: Array<{ image_front_url?: string; image_url?: string }>;
    };
    const imgs: string[] = [];
    for (const p of data.products ?? []) {
      const candidate = p.image_front_url || p.image_url;
      if (candidate) imgs.push(candidate);
    }
    return imgs;
  } catch {
    return [];
  }
}

function slugifyName(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36);
  return s || 'product';
}

export async function resolveAndCacheProductImage(
  productName: string,
  category?: string,
  options?: { skipIndex?: number; forceRefresh?: boolean }
): Promise<string> {
  const cleanName = productName.trim();
  if (!cleanName) return '';

  ensureProductsImgDir();

  const skipIndex = Math.max(0, options?.skipIndex ?? 0);
  const slug = slugifyName(cleanName);
  const hash = crypto.createHash('md5').update(`${cleanName.toLowerCase()}|${skipIndex}`).digest('hex').slice(0, 8);

  // Reuse already cached local image for the same name unless forceRefresh is set
  if (!options?.forceRefresh) {
    for (const ext of ['jpg', 'png', 'webp']) {
      const fileName = `${slug}_${hash}.${ext}`;
      const absPath = path.join(PRODUCTS_IMG_DIR, fileName);
      if (fs.existsSync(absPath) && fs.statSync(absPath).size > 2000) {
        return `/src/assets/images/products/${fileName}`;
      }
    }
  }

  const query = buildSearchQuery(cleanName, category);
  let candidates = await searchBingImageCandidates(query);

  if (candidates.length === 0) {
    candidates = await searchOpenFoodFactsCandidates(cleanName);
  }

  // Rotate starting candidate if skipIndex > 0 (allows picking next matching photo)
  if (skipIndex > 0 && candidates.length > 1) {
    const start = skipIndex % candidates.length;
    candidates = [...candidates.slice(start), ...candidates.slice(0, start)];
  }

  for (const imgUrl of candidates) {
    try {
      const res = await fetchWithTimeout(imgUrl, 5500);
      if (!res.ok) continue;
      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType && !contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
        continue;
      }
      const arrBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrBuf);
      const ext = detectImageExtension(buf);
      if (!ext) continue;

      const fileName = `${slug}_${hash}.${ext}`;
      const absPath = path.join(PRODUCTS_IMG_DIR, fileName);
      fs.writeFileSync(absPath, buf);
      return `/src/assets/images/products/${fileName}`;
    } catch {
      // Try next candidate
    }
  }

  return '';
}

export function isMissingOrGroupImage(imageData: unknown): boolean {
  const val = String(imageData ?? '').trim();
  if (!val) return true;
  if (OLD_GROUP_IMAGES.has(val)) return true;
  if (val.startsWith('/src/assets/images/')) {
    const rel = val.replace(/^\/+/, '');
    const abs = path.resolve(process.cwd(), rel);
    if (!fs.existsSync(abs)) return true;
  }
  return false;
}

let autoBackfillPromise: Promise<{ updated: number; totalChecked: number }> | null = null;

export async function autoAssignMissingProductImages(forceAll = false): Promise<{ updated: number; totalChecked: number }> {
  const rows = db
    .prepare('SELECT id, name, category, image_data, is_demo FROM products ORDER BY is_demo DESC, id ASC')
    .all() as Array<{ id: number; name: string; category: string; image_data: string; is_demo: number }>;

  const targets = forceAll ? rows : rows.filter((r) => isMissingOrGroupImage(r.image_data));
  if (targets.length === 0) {
    return { updated: 0, totalChecked: rows.length };
  }

  const updateStmt = db.prepare('UPDATE products SET image_data = ?, updated_at = ? WHERE id = ?');
  let updated = 0;

  // Process in small concurrent batches of 4 so startup/sync stays fast
  const batchSize = 4;
  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = targets.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (prod) => {
        const localUrl = await resolveAndCacheProductImage(prod.name, prod.category, { forceRefresh: forceAll });
        if (localUrl) {
          const now = new Date().toISOString().slice(0, 19);
          updateStmt.run(localUrl, now, prod.id);
          updated++;
        }
      })
    );
  }

  return { updated, totalChecked: rows.length };
}

export function triggerStartupImageBackfill(): void {
  if (!autoBackfillPromise) {
    autoBackfillPromise = autoAssignMissingProductImages(false)
      .then((res) => {
        if (res.updated > 0) {
          console.log(`[ProductImages] Auto-assigned exact product images for ${res.updated} products.`);
        }
        return res;
      })
      .catch((err) => {
        console.error('[ProductImages] Background auto-assign failed:', err);
        return { updated: 0, totalChecked: 0 };
      });
  }
}
