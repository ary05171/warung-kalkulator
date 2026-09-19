import { Product } from '../types';

export type ProductSortOption = 'newest' | 'cheapest' | 'expensive' | 'az' | 'za' | 'oldest';

export interface SortOptionItem {
  value: ProductSortOption;
  label: string;
  shortLabel: string;
}

export const SORT_OPTIONS: SortOptionItem[] = [
  { value: 'newest', label: 'Terakhir Ditambahkan (Terbaru)', shortLabel: 'Terbaru' },
  { value: 'cheapest', label: 'Termurah (Harga Terendah)', shortLabel: 'Termurah' },
  { value: 'expensive', label: 'Termahal (Harga Tertinggi)', shortLabel: 'Termahal' },
  { value: 'az', label: 'Berdasarkan Huruf (A - Z)', shortLabel: 'Huruf A-Z' },
  { value: 'za', label: 'Berdasarkan Huruf (Z - A)', shortLabel: 'Huruf Z-A' },
  { value: 'oldest', label: 'Terlama Ditambahkan', shortLabel: 'Terlama' },
];

/**
 * Sorts products based on selected criteria
 */
export function sortProducts(products: Product[], sortOption: ProductSortOption): Product[] {
  const list = [...products];

  // Helper to extract creation timestamp safely
  const getCreatedTimestamp = (p: Product, originalIndex: number): number => {
    if (p.createdAt) {
      const t = new Date(p.createdAt).getTime();
      if (!isNaN(t)) return t;
    }
    // Check if id contains a timestamp like prod-1698234872342
    const match = p.id.match(/\d{10,14}/);
    if (match) {
      const t = parseInt(match[0], 10);
      if (!isNaN(t)) return t;
    }
    // Fallback to array index: higher index means added later
    return originalIndex;
  };

  const productTimes = new Map<string, number>();
  products.forEach((p, idx) => {
    productTimes.set(p.id, getCreatedTimestamp(p, idx));
  });

  switch (sortOption) {
    case 'cheapest':
      return list.sort((a, b) => a.price - b.price);
    case 'expensive':
      return list.sort((a, b) => b.price - a.price);
    case 'az':
      return list.sort((a, b) => a.name.localeCompare(b.name, 'id', { sensitivity: 'base' }));
    case 'za':
      return list.sort((a, b) => b.name.localeCompare(a.name, 'id', { sensitivity: 'base' }));
    case 'newest':
      return list.sort((a, b) => (productTimes.get(b.id) ?? 0) - (productTimes.get(a.id) ?? 0));
    case 'oldest':
      return list.sort((a, b) => (productTimes.get(a.id) ?? 0) - (productTimes.get(b.id) ?? 0));
    default:
      return list;
  }
}
