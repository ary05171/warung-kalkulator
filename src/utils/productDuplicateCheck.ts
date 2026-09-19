import { Product } from '../types';

export interface SimilarProductMatch {
  product: Product;
  matchType: 'exact' | 'similar';
  similarityPercent: number;
}

/**
 * Normalizes string for fair comparison:
 * - lowercase
 * - removes multiple spaces
 * - removes punctuation
 * - standardizes common unit spacing (e.g., '1 kg' -> '1kg', '600 ml' -> '600ml')
 */
export function normalizeProductName(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/(\d+)\s+(kg|g|gr|gram|ml|l|liter|pcs|btl|bks|sachet)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate similarity between two strings using bigram / Dice coefficient
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeProductName(str1);
  const s2 = normalizeProductName(str2);

  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  // If one contains the other completely and length ratio is reasonable
  if (s1.includes(s2) || s2.includes(s1)) {
    const minLen = Math.min(s1.length, s2.length);
    const maxLen = Math.max(s1.length, s2.length);
    if (minLen / maxLen >= 0.5) {
      return 0.85;
    }
  }

  // Word token overlap
  const words1 = new Set(s1.split(' ').filter(Boolean));
  const words2 = new Set(s2.split(' ').filter(Boolean));
  if (words1.size > 0 && words2.size > 0) {
    let intersection = 0;
    words1.forEach((w) => {
      if (words2.has(w)) intersection++;
    });
    const wordScore = (2 * intersection) / (words1.size + words2.size);
    if (wordScore >= 0.7) {
      return wordScore;
    }
  }

  // Bigram similarity
  const getBigrams = (s: string) => {
    const bigrams = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.substring(i, i + 2));
    }
    return bigrams;
  };

  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);

  if (bg1.size === 0 || bg2.size === 0) return 0;

  let common = 0;
  bg1.forEach((bg) => {
    if (bg2.has(bg)) common++;
  });

  return (2 * common) / (bg1.size + bg2.size);
}

/**
 * Finds duplicate or similar products from the catalog
 */
export function findSimilarProducts(
  inputName: string,
  existingProducts: Product[],
  excludeId?: string
): SimilarProductMatch[] {
  const cleanInput = inputName.trim();
  if (cleanInput.length < 2) return [];

  const normalizedInput = normalizeProductName(cleanInput);
  const matches: SimilarProductMatch[] = [];

  for (const prod of existingProducts) {
    if (excludeId && prod.id === excludeId) continue;

    const normalizedProd = normalizeProductName(prod.name);

    if (normalizedInput === normalizedProd) {
      matches.push({
        product: prod,
        matchType: 'exact',
        similarityPercent: 100,
      });
      continue;
    }

    const similarity = calculateSimilarity(cleanInput, prod.name);
    if (similarity >= 0.65) {
      matches.push({
        product: prod,
        matchType: 'similar',
        similarityPercent: Math.round(similarity * 100),
      });
    }
  }

  // Sort by similarity descending
  return matches.sort((a, b) => b.similarityPercent - a.similarityPercent);
}
