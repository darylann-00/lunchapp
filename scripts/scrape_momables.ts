#!/usr/bin/env tsx
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve paths from this script's location
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, 'seed/momables_recipes.csv');
const CACHE_DIR = resolve(__dirname, 'seed/.momables_cache');

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// ISO-8601 duration parser: PT5M, PT1H30M, PT1H, etc.
function parseIsoDuration(duration: string): number | null {
  if (!duration || typeof duration !== 'string') return null;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return null;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  return hours * 60 + minutes;
}

// Escape CSV field: wrap in quotes if contains comma/quote/newline, double-escape quotes
function escapeCsvField(field: string): string {
  if (!field || (!field.includes(',') && !field.includes('"') && !field.includes('\n'))) {
    return field;
  }
  return `"${field.replace(/"/g, '""')}"`;
}

// Generate cache key from URL pathname
function getCacheKey(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return pathname.replace(/[^a-z0-9]/gi, '_').slice(0, 100) || 'index';
  } catch {
    return `url_${Math.random().toString(36).slice(2, 10)}`;
  }
}

// Fetch with cache
async function fetchWithCache(url: string): Promise<string> {
  const key = getCacheKey(url);
  const cachePath = resolve(CACHE_DIR, `${key}.html`);

  if (existsSync(cachePath)) {
    return readFileSync(cachePath, 'utf-8');
  }

  // Throttle ONLY real network requests (cache misses) — keeps us polite to the
  // origin while letting fully-cached re-runs finish in seconds.
  await new Promise((r) => setTimeout(r, 1000));
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cachePath, html, 'utf-8');
  return html;
}

// Extract JSON-LD nodes from HTML
function extractJsonLdNodes(html: string): Record<string, unknown>[] {
  const nodes: Record<string, unknown>[] = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    try {
      const value = JSON.parse(match[1]!) as Record<string, unknown>;
      if (Array.isArray(value['@graph'])) {
        nodes.push(...(value['@graph'] as Record<string, unknown>[]));
      } else {
        nodes.push(value);
      }
    } catch {
      // Malformed JSON-LD, skip
    }
  }

  return nodes;
}

// Check if node is a Recipe
function isRecipeNode(node: Record<string, unknown>): boolean {
  const type = node['@type'];
  if (typeof type === 'string') return type === 'Recipe';
  if (Array.isArray(type)) return type.includes('Recipe');
  return false;
}

// Flatten recipeInstructions array (handles HowToStep and HowToSection)
function flattenInstructions(instructions: unknown): string {
  if (!Array.isArray(instructions)) return '';

  const steps: string[] = [];

  for (const item of instructions) {
    if (typeof item === 'string') {
      if (item.trim()) steps.push(item.trim());
    } else if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      if (obj['@type'] === 'HowToStep' && typeof obj['text'] === 'string') {
        steps.push(obj['text']);
      } else if (obj['@type'] === 'HowToSection' && Array.isArray(obj['itemListElement'])) {
        for (const subitem of obj['itemListElement'] as unknown[]) {
          if (typeof subitem === 'object' && subitem !== null) {
            const sub = subitem as Record<string, unknown>;
            if (typeof sub['text'] === 'string') {
              steps.push(sub['text']);
            }
          }
        }
      }
    }
  }

  return steps.join(' ');
}

// Extract recipe data from JSON-LD node
function extractRecipe(
  node: Record<string, unknown>,
  pageUrl: string,
): { name: string; ingredients: string; instructions: string; prepTime: string; source: string } | null {
  const name = typeof node['name'] === 'string' ? node['name'] : null;
  if (!name) return null;

  const ingredients = Array.isArray(node['recipeIngredient'])
    ? node['recipeIngredient']
        .filter((ing): ing is string => typeof ing === 'string')
        .join(' | ')
    : '';

  const instructions = flattenInstructions(node['recipeInstructions']);

  // Parse prep time: prefer totalTime, else prepTime, else cookTime
  let prepTime = '';
  const duration =
    typeof node['totalTime'] === 'string'
      ? node['totalTime']
      : typeof node['prepTime'] === 'string'
        ? node['prepTime']
        : typeof node['cookTime'] === 'string'
          ? node['cookTime']
          : null;

  if (duration) {
    const minutes = parseIsoDuration(duration);
    if (minutes !== null) {
      prepTime = `${minutes} minutes`;
    }
  }

  return { name, ingredients, instructions, prepTime, source: pageUrl };
}

async function scrapeRecipes(): Promise<void> {
  console.log('🔗 Fetching sitemap...');
  const sitemapRes = await fetch('https://www.momables.com/post-sitemap.xml', {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!sitemapRes.ok) throw new Error(`Failed to fetch sitemap: HTTP ${sitemapRes.status}`);

  const sitemapXml = await sitemapRes.text();
  const urlMatches = [...sitemapXml.matchAll(/<loc>(.*?)<\/loc>/gi)];
  const urls = urlMatches.map((m) => m[1]!);

  console.log(`Found ${urls.length} posts. Scraping recipes...\n`);

  const recipes: Array<{ name: string; ingredients: string; instructions: string; prepTime: string; source: string }> = [];
  let skipped = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;
    try {
      const html = await fetchWithCache(url);
      const nodes = extractJsonLdNodes(html);
      const recipeNode = nodes.find((n) => isRecipeNode(n));

      if (!recipeNode) {
        skipped++;
        continue;
      }

      const recipe = extractRecipe(recipeNode, url);
      if (!recipe) {
        skipped++;
        continue;
      }

      recipes.push(recipe);
      console.log(`✓ [${i + 1}/${urls.length}] ${recipe.name}`);
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${url}: ${err}`);
    }
  }

  // Write CSV
  console.log(`\n📝 Writing ${recipes.length} recipes to ${OUTPUT_PATH}...`);

  const csvLines: string[] = ['recipe_name,ingredients,instructions,prep_time,source'];
  for (const recipe of recipes) {
    const row = [
      escapeCsvField(recipe.name),
      escapeCsvField(recipe.ingredients),
      escapeCsvField(recipe.instructions),
      escapeCsvField(recipe.prepTime),
      escapeCsvField(recipe.source),
    ].join(',');
    csvLines.push(row);
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, csvLines.join('\n'), 'utf-8');

  console.log(`✅ Done! Written ${recipes.length} recipes, skipped ${skipped} pages.`);
  console.log(`📍 Output: ${OUTPUT_PATH}`);
  console.log(`\nNext: npm run import-recipes:momables\n`);
}

scrapeRecipes().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
