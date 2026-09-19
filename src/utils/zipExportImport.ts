import JSZip from 'jszip';
import { Product } from '../types';

/**
 * Export product catalog and images as a structured ZIP file
 * Structure:
 * - products.json
 * - images/
 *   - [productId].png or [productId].jpg
 * - README.txt
 */
export async function exportProductsAsZip(products: Product[]): Promise<void> {
  const zip = new JSZip();

  const imgFolder = zip.folder('images');
  const exportableProducts: Product[] = [];
  let imageCounter = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const prodCopy = { ...p };

    if (p.image && p.image.startsWith('data:image/')) {
      // Extract mime type and base64 content
      // e.g. "data:image/png;base64,iVBORw0KGgo..."
      const match = p.image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (match) {
        let ext = match[1].toLowerCase();
        if (ext === 'jpeg') ext = 'jpg';
        if (ext === 'svg+xml') ext = 'svg';
        const base64Data = match[2];

        // Safe filename based on ID or sanitized product name
        const safeName = (p.name || 'product')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .slice(0, 20);
        const fileName = `${safeName}_${p.id || i}.${ext}`;
        const relativePath = `images/${fileName}`;

        // Add binary to images/ in zip
        if (imgFolder) {
          imgFolder.file(fileName, base64Data, { base64: true });
          imageCounter++;
        }

        // Set reference in JSON
        prodCopy.image = relativePath;
      }
    }

    exportableProducts.push(prodCopy);
  }

  // Add products.json
  const jsonContent = JSON.stringify(exportableProducts, null, 2);
  zip.file('products.json', jsonContent);

  // Add README.txt
  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const readme = `PAKET KONFIGURASI LIST PRODUK WARUNG
Tanggal Ekspor: ${dateStr}
Jumlah Produk: ${products.length}
Jumlah File Gambar: ${imageCounter}

Isi Paket:
1. products.json  : File konfigurasi data produk lengkap (nama, harga, kategori, barcode, stok, unit).
2. images/        : Folder berisi file foto asli produk dalam format gambar.

Cara Import:
Gunakan tombol "Import Paket ZIP Produk" di menu Kelola Produk atau Pusat Data Warung Kasir.
`;
  zip.file('README.txt', readme);

  // Generate zip file and trigger browser download
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const fileDate = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `produk_warung_${fileDate}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ZipImportResult {
  products: Product[];
  imageCount: number;
}

/**
 * Import products and associated images from a ZIP file
 */
export async function importProductsFromZip(file: File): Promise<ZipImportResult> {
  const zip = await JSZip.loadAsync(file);

  // 1. Locate products.json or any *.json file in root
  let jsonFile = zip.file('products.json');
  if (!jsonFile) {
    // Try to find any json file in the archive
    const jsonEntries = zip.file(/.*\.json$/i);
    if (jsonEntries.length > 0) {
      jsonFile = jsonEntries[0];
    }
  }

  if (!jsonFile) {
    throw new Error('File "products.json" tidak ditemukan di dalam arsip ZIP.');
  }

  const jsonStr = await jsonFile.async('string');
  const rawList = JSON.parse(jsonStr);

  if (!Array.isArray(rawList)) {
    throw new Error('Format products.json tidak valid (harus berupa array produk).');
  }

  let imageCount = 0;
  const resolvedProducts: Product[] = [];

  for (const rawProd of rawList) {
    const prod: Product = {
      id: rawProd.id || `prod_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      name: String(rawProd.name || 'Produk Tanpa Nama'),
      price: Number(rawProd.price) || 0,
      costPrice: rawProd.costPrice !== undefined ? Number(rawProd.costPrice) : undefined,
      category: rawProd.category || 'Lainnya',
      unit: rawProd.unit || 'pcs',
      stock: rawProd.stock !== undefined ? Number(rawProd.stock) : 50,
      image: rawProd.image || '📦',
      favorite: rawProd.favorite ? Boolean(rawProd.favorite) : undefined,
      createdAt: rawProd.createdAt || undefined,
    };

    // If image points to a relative path inside the zip, e.g. "images/xxx.png"
    if (prod.image && (prod.image.startsWith('images/') || prod.image.includes('/'))) {
      const imgPath = prod.image;
      let targetFile = zip.file(imgPath);

      // If not found directly, try finding by basename
      if (!targetFile) {
        const basename = imgPath.split('/').pop();
        if (basename) {
          const matched = zip.file(new RegExp(basename + '$', 'i'));
          if (matched.length > 0) {
            targetFile = matched[0];
          }
        }
      }

      if (targetFile) {
        try {
          const base64 = await targetFile.async('base64');
          const ext = imgPath.split('.').pop()?.toLowerCase() || 'png';
          let mime = 'image/png';
          if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
          if (ext === 'webp') mime = 'image/webp';
          if (ext === 'svg') mime = 'image/svg+xml';
          if (ext === 'gif') mime = 'image/gif';

          prod.image = `data:${mime};base64,${base64}`;
          imageCount++;
        } catch (err) {
          console.warn(`Gagal memuat gambar ${imgPath} dari ZIP:`, err);
        }
      }
    }

    resolvedProducts.push(prod);
  }

  return {
    products: resolvedProducts,
    imageCount,
  };
}
