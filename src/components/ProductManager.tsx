import { useState, useMemo, useRef } from 'react';
import { Product } from '../types';
import { formatRupiah } from '../utils/storage';
import { exportProductsAsZip, importProductsFromZip } from '../utils/zipExportImport';
import { ProductSortOption, SORT_OPTIONS, sortProducts } from '../utils/productSort';
import { findSimilarProducts, SimilarProductMatch } from '../utils/productDuplicateCheck';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Upload,
  Camera,
  Link,
  Smile,
  X,
  Check,
  Package,
  RotateCcw,
  Sparkles,
  FileArchive,
  Download,
  AlertTriangle,
  Loader2,
  ArrowUpDown,
} from 'lucide-react';

interface ProductManagerProps {
  products: Product[];
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onClearAllProducts: () => void;
  onImportProducts: (products: Product[], replaceMode?: boolean) => void;
}

const COMMON_EMOJIS = [
  '🍚', '🥚', '🌻', '🧂', '🍜', '🍲', '☕', '💧', '🧃', '🔥',
  '🚰', '🚬', '🍞', '🧼', '🍬', '🥛', '🥫', '🍪', '🧻', '🪙',
  '🧅', '🥔', '🥖', '🧊', '🧴', '🧹', '⚡', '📦'
];

export function ProductManager({
  products,
  onSaveProduct,
  onDeleteProduct,
  onClearAllProducts,
  onImportProducts,
}: ProductManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [sortBy, setSortBy] = useState<ProductSortOption>('newest');
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isImportingZip, setIsImportingZip] = useState(false);
  const [zipNotification, setZipNotification] = useState<string | null>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [duplicateConfirmation, setDuplicateConfirmation] = useState<SimilarProductMatch | null>(null);
  const [dismissSimilarBanner, setDismissSimilarBanner] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [category, setCategory] = useState('Sembako');
  const [unit, setUnit] = useState('pcs');
  const [stock, setStock] = useState('50');
  const [image, setImage] = useState('📦');

  // Fitur Jual Ecer (Contoh: Rokok per Batang / Telur per Butir)
  const [allowRetail, setAllowRetail] = useState(false);
  const [retailUnit, setRetailUnit] = useState('Batang');
  const [retailPrice, setRetailPrice] = useState('');
  const [retailCostPrice, setRetailCostPrice] = useState('');
  const [retailRatio, setRetailRatio] = useState('16');

  // Image Tab in Modal: 'upload' (Galeri/Kamera) | 'url' (Link Web) | 'icon' (Emoji Warung)
  const [imageTab, setImageTab] = useState<'upload' | 'url' | 'icon'>('upload');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageError, setImageError] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['Semua', ...Array.from(set)];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      const matchCat = selectedCategory === 'Semua' || p.category === selectedCategory;
      const matchQuery =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchQuery;
    });
    return sortProducts(filtered, sortBy);
  }, [products, selectedCategory, searchQuery, sortBy]);

  // Real-time check for duplicate or similar existing products
  const similarMatches = useMemo(() => {
    if (editingProduct || !name.trim()) return [];
    return findSimilarProducts(name, products);
  }, [name, products, editingProduct]);

  const openAddModal = () => {
    setEditingProduct(null);
    setName('');
    setPrice('');
    setCostPrice('');
    setCategory('Sembako');
    setUnit('pcs');
    setStock('50');
    setImage('📦');
    setImageTab('upload');
    setImageUrlInput('');
    setImageError(false);
    setDismissSimilarBanner(false);
    setDuplicateConfirmation(null);
    setAllowRetail(false);
    setRetailUnit('Batang');
    setRetailPrice('');
    setRetailCostPrice('');
    setRetailRatio('16');
    setModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setName(prod.name);
    setPrice(prod.price.toString());
    setCostPrice(prod.costPrice ? prod.costPrice.toString() : '');
    setCategory(prod.category || 'Lainnya');
    setUnit(prod.unit || 'pcs');
    setStock(prod.stock !== undefined ? prod.stock.toString() : '50');
    setImage(prod.image || '📦');
    setImageError(false);
    setDismissSimilarBanner(true);
    setDuplicateConfirmation(null);
    setAllowRetail(!!prod.allowRetail);
    setRetailUnit(prod.retailUnit || (prod.category === 'Rokok' ? 'Batang' : 'Pcs'));
    setRetailPrice(prod.retailPrice !== undefined ? prod.retailPrice.toString() : '');
    setRetailCostPrice(prod.retailCostPrice !== undefined ? prod.retailCostPrice.toString() : '');
    setRetailRatio(prod.retailRatio !== undefined ? prod.retailRatio.toString() : '16');
    if (prod.image && prod.image.startsWith('http')) {
      setImageTab('url');
      setImageUrlInput(prod.image);
    } else {
      setImageTab('upload');
      setImageUrlInput('');
    }
    setModalOpen(true);
  };

  // Helper to process and compress images from File (Gallery or Camera)
  const processImageFile = (file: File) => {
    setImageError(false);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 240;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setImage(compressedDataUrl);
        }
      };
      img.onerror = () => {
        alert('Gagal memproses gambar foto.');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle Photo Upload from Gallery or File explorer
  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    // reset input so same file can be re-selected if needed
    e.target.value = '';
  };

  // Handle Camera Capture directly from device
  const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    e.target.value = '';
  };

  // Handle Web URL image apply
  const handleApplyUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) {
      alert('Masukkan link alamat gambar (URL)');
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      alert('Alamat link harus diawali dengan http:// atau https://');
      return;
    }
    setImageError(false);
    setImage(trimmed);
  };

  const handleUpdateExistingPrice = (targetMatch: SimilarProductMatch) => {
    const existingProd = targetMatch.product;
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      alert('Silakan masukkan harga baru pada kolom Harga Jual terlebih dahulu.');
      return;
    }

    const costNum = costPrice ? parseFloat(costPrice) : existingProd.costPrice;
    const stockNum = stock ? parseInt(stock, 10) : existingProd.stock;
    const customImage = image && image !== '📦' ? image : existingProd.image;
    const retPriceNum = retailPrice ? parseFloat(retailPrice) : undefined;
    const retCostNum = retailCostPrice ? parseFloat(retailCostPrice) : undefined;
    const retRatioNum = retailRatio ? parseInt(retailRatio, 10) : undefined;

    const updated: Product = {
      ...existingProd,
      price: priceNum,
      costPrice: costNum,
      stock: stockNum,
      image: customImage,
      allowRetail: allowRetail,
      retailUnit: allowRetail ? (retailUnit.trim() || 'Batang') : undefined,
      retailPrice: allowRetail ? retPriceNum : undefined,
      retailCostPrice: allowRetail ? retCostNum : undefined,
      retailRatio: allowRetail ? retRatioNum : undefined,
    };

    onSaveProduct(updated);
    setDuplicateConfirmation(null);
    setModalOpen(false);

    setZipNotification(
      `Harga "${existingProd.name}" berhasil diperbarui dari ${formatRupiah(existingProd.price)} menjadi ${formatRupiah(priceNum)}!`
    );
    setTimeout(() => setZipNotification(null), 4500);
  };

  const handleKeepBoth = (targetMatch: SimilarProductMatch) => {
    const priceNum = parseFloat(price);
    if (!name.trim() || isNaN(priceNum) || priceNum <= 0) {
      alert('Nama produk dan harga jual harus diisi dengan benar');
      return;
    }

    const costNum = costPrice ? parseFloat(costPrice) : undefined;
    const stockNum = stock ? parseInt(stock, 10) : undefined;
    const retPriceNum = retailPrice ? parseFloat(retailPrice) : undefined;
    const retCostNum = retailCostPrice ? parseFloat(retailCostPrice) : undefined;
    const retRatioNum = retailRatio ? parseInt(retailRatio, 10) : undefined;

    const newProd: Product = {
      id: `prod-${Date.now()}`,
      name: name.trim(),
      price: priceNum,
      costPrice: costNum,
      category: category.trim() || 'Lainnya',
      unit: unit.trim() || 'pcs',
      stock: stockNum,
      image: image || '📦',
      createdAt: new Date().toISOString(),
      allowRetail: allowRetail,
      retailUnit: allowRetail ? (retailUnit.trim() || 'Batang') : undefined,
      retailPrice: allowRetail ? retPriceNum : undefined,
      retailCostPrice: allowRetail ? retCostNum : undefined,
      retailRatio: allowRetail ? retRatioNum : undefined,
    };

    onSaveProduct(newProd);
    setDuplicateConfirmation(null);
    setModalOpen(false);

    setZipNotification(
      `Produk baru "${newProd.name}" berhasil ditambahkan berdampingan dengan "${targetMatch.product.name}".`
    );
    setTimeout(() => setZipNotification(null), 4500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(price);
    if (!name.trim() || isNaN(priceNum) || priceNum <= 0) {
      alert('Nama produk dan harga jual harus diisi dengan benar');
      return;
    }

    // Jika sedang menambah produk baru dan terdeteksi produk serupa/kembar, munculkan konfirmasi pilihan
    if (!editingProduct && similarMatches.length > 0) {
      setDuplicateConfirmation(similarMatches[0]);
      return;
    }

    const costNum = costPrice ? parseFloat(costPrice) : undefined;
    const stockNum = stock ? parseInt(stock, 10) : undefined;
    const retPriceNum = retailPrice ? parseFloat(retailPrice) : undefined;
    const retCostNum = retailCostPrice ? parseFloat(retailCostPrice) : undefined;
    const retRatioNum = retailRatio ? parseInt(retailRatio, 10) : undefined;

    const newProd: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      name: name.trim(),
      price: priceNum,
      costPrice: costNum,
      category: category.trim() || 'Lainnya',
      unit: unit.trim() || 'pcs',
      stock: stockNum,
      image: image || '📦',
      createdAt: editingProduct?.createdAt || new Date().toISOString(),
      allowRetail: allowRetail,
      retailUnit: allowRetail ? (retailUnit.trim() || 'Batang') : undefined,
      retailPrice: allowRetail ? retPriceNum : undefined,
      retailCostPrice: allowRetail ? retCostNum : undefined,
      retailRatio: allowRetail ? retRatioNum : undefined,
    };

    onSaveProduct(newProd);
    setModalOpen(false);
  };

  const handleExportZip = async () => {
    if (products.length === 0) {
      alert('Belum ada produk di katalog untuk diekspor.');
      return;
    }
    setIsExportingZip(true);
    try {
      await exportProductsAsZip(products);
      setZipNotification(`File ZIP berhasil dibuat & didownload (${products.length} produk + foto)!`);
      setTimeout(() => setZipNotification(null), 4000);
    } catch (err) {
      alert('Gagal mengekspor file ZIP: ' + (err as Error).message);
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleImportZipFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingZip(true);
    try {
      const result = await importProductsFromZip(file);
      if (result.products.length === 0) {
        alert('Tidak ada data produk yang valid di dalam file ZIP.');
        return;
      }
      const shouldReplace = confirm(
        `Ditemukan ${result.products.length} produk dan ${result.imageCount} file foto di dalam arsip ZIP.\n\n` +
        `• Klik "OK" untuk MENGGANTIKAN seluruh produk saat ini.\n` +
        `• Klik "Batal" untuk MENGGABUNGKAN dengan produk yang sudah ada.`
      );
      onImportProducts(result.products, shouldReplace);
      setZipNotification(
        `Sukses! ${result.products.length} produk & ${result.imageCount} foto berhasil dimuat dari ZIP!`
      );
      setTimeout(() => setZipNotification(null), 4000);
    } catch (err) {
      alert('Gagal mengimpor file ZIP: ' + (err as Error).message);
    } finally {
      setIsImportingZip(false);
      if (zipInputRef.current) zipInputRef.current.value = '';
    }
  };

  const handleClearAll = () => {
    if (products.length === 0) {
      alert('Katalog produk sudah kosong.');
      return;
    }
    if (
      confirm(
        `PERINGATAN KERAS:\nApakah Anda yakin ingin MENGHAPUS SEMUA (${products.length}) BARANG dari tabel harga warung?\n\n` +
        `Semua data nama produk, harga, stok, dan foto barang akan dihapus. Tindakan ini permanen.`
      )
    ) {
      onClearAllProducts();
      setZipNotification('Semua barang berhasil dibersihkan dari katalog warung.');
      setTimeout(() => setZipNotification(null), 3500);
    }
  };

  return (
    <div className="flex flex-col flex-1 p-3 pb-24 space-y-3">
      {/* Top Action Header */}
      <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-1.5">
            <Package className="w-5 h-5 text-emerald-700" />
            <span>Tabel Harga & Katalog</span>
          </h2>
          <p className="text-xs text-stone-500">
            Total {products.length} produk terdaftar di database
          </p>
        </div>

        <button
          id="btn-tambah-produk"
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Produk</span>
        </button>
      </div>

      {/* ZIP Export / Import & Clear All Toolbar */}
      <div className="bg-white p-2.5 rounded-2xl border border-stone-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between gap-1.5 flex-wrap">
          {/* ZIP Operations */}
          <div className="flex items-center gap-1.5">
            {/* Hidden file input for zip */}
            <input
              type="file"
              ref={zipInputRef}
              onChange={handleImportZipFile}
              accept=".zip,application/zip,application/x-zip-compressed"
              className="hidden"
            />

            <button
              id="btn-ekspor-zip"
              onClick={handleExportZip}
              disabled={isExportingZip}
              title="Ekspor daftar produk dan semua foto ke arsip ZIP"
              className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center gap-1.5 border border-stone-200 active:scale-95 transition-all"
            >
              {isExportingZip ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              ) : (
                <FileArchive className="w-3.5 h-3.5 text-emerald-700" />
              )}
              <span>Ekspor ZIP</span>
            </button>

            <button
              id="btn-impor-zip"
              onClick={() => zipInputRef.current?.click()}
              disabled={isImportingZip}
              title="Import file ZIP berisi products.json dan folder gambar"
              className="px-2.5 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold flex items-center gap-1.5 border border-stone-200 active:scale-95 transition-all"
            >
              {isImportingZip ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
              ) : (
                <Upload className="w-3.5 h-3.5 text-emerald-700" />
              )}
              <span>Impor ZIP</span>
            </button>
          </div>

          {/* Bersihkan Semua Barang */}
          <button
            id="btn-bersihkan-semua-barang"
            onClick={handleClearAll}
            className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-1.5 border border-rose-200 active:scale-95 transition-all"
            title="Hapus seluruh barang di katalog produk"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Bersihkan Semua Barang</span>
          </button>
        </div>

        {/* Zip Notification alert */}
        {zipNotification && (
          <div className="p-2 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-medium flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{zipNotification}</span>
            </span>
            <button
              onClick={() => setZipNotification(null)}
              className="p-1 text-emerald-700 hover:text-emerald-950"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Search and Category Filter */}
      <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-xs space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama barang atau kategori..."
            className="w-full bg-stone-50 border border-stone-300 rounded-xl pl-9 pr-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-emerald-600"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-emerald-700 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Sort Controls Bar: Termurah, Termahal, Huruf, Terakhir Ditambahkan */}
        <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-stone-100">
          <div className="flex items-center gap-1 text-stone-500 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-emerald-700" />
            <span className="text-[11px] font-semibold text-stone-600 hidden xs:inline">Urutan:</span>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {SORT_OPTIONS.map((opt) => {
              const active = sortBy === opt.value;
              return (
                <button
                  key={opt.value}
                  id={`btn-sort-manage-${opt.value}`}
                  onClick={() => setSortBy(opt.value)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap active:scale-95 transition-all ${
                    active
                      ? 'bg-stone-800 text-white shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200 border border-stone-200/80'
                  }`}
                  title={opt.label}
                >
                  {opt.shortLabel}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Product Table / Mobile Cards */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="divide-y divide-stone-100">
          {filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-stone-500 text-xs">
              Belum ada produk yang cocok dengan pencarian
            </div>
          ) : (
            filteredProducts.map((p) => {
              const profitMargin =
                p.costPrice && p.price > p.costPrice ? p.price - p.costPrice : null;

              return (
                <div
                  key={p.id}
                  className="p-3 flex items-center justify-between gap-2 hover:bg-stone-50/80 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Image / Emoji */}
                    <div className="w-12 h-12 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-2xl overflow-hidden shrink-0 shadow-xs">
                      {p.image && (p.image.startsWith('data:') || p.image.startsWith('http')) ? (
                        <img
                          src={p.image}
                          alt={p.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{p.image || '📦'}</span>
                      )}
                    </div>

                    {/* Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-stone-900 truncate">{p.name}</span>
                        <span className="text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.2 rounded shrink-0">
                          {p.category}
                        </span>
                        {p.allowRetail && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-300 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5">
                            <span>Ecer:</span>
                            <span className="text-amber-900 font-extrabold">
                              {p.retailPrice ? formatRupiah(p.retailPrice) : '-'}
                            </span>
                            <span className="text-amber-700 font-medium">/{p.retailUnit || 'Batang'}</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs mt-0.5">
                        <span className="font-extrabold text-emerald-700 text-sm">
                          {formatRupiah(p.price)}
                        </span>
                        <span className="text-[11px] text-stone-400">/{p.unit || 'pcs'}</span>

                        {p.costPrice ? (
                          <span className="text-[10px] text-stone-500 hidden xs:inline">
                            (Modal: {formatRupiah(p.costPrice)})
                          </span>
                        ) : null}

                        {profitMargin !== null && (
                          <span className="text-[10px] text-lime-700 font-semibold bg-lime-50 px-1 rounded hidden sm:inline">
                            +Untung {formatRupiah(profitMargin)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEditModal(p)}
                      title="Edit Produk"
                      className="p-2 rounded-lg bg-stone-100 hover:bg-emerald-50 text-stone-600 hover:text-emerald-700 active:scale-95 transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Hapus produk "${p.name}" dari katalog?`)) {
                          onDeleteProduct(p.id);
                        }
                      }}
                      title="Hapus Produk"
                      className="p-2 rounded-lg bg-stone-100 hover:bg-rose-50 text-stone-400 hover:text-rose-600 active:scale-95 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Add / Edit Product */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden relative"
          >
            {/* Modal Dialog: Pilihan Jika Produk Sudah Ada / Serupa */}
            {duplicateConfirmation && (
              <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-4 shadow-2xl max-w-sm w-full space-y-3 border border-stone-200 animate-in fade-in zoom-in-95">
                  <div className="flex items-center gap-2 text-amber-800 pb-1 border-b border-stone-100">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <h4 className="font-bold text-sm text-stone-900">
                      {duplicateConfirmation.matchType === 'exact'
                        ? 'Produk Sudah Terdaftar!'
                        : 'Produk Serupa Ditemukan!'}
                    </h4>
                  </div>

                  <p className="text-xs text-stone-600 leading-relaxed">
                    Produk serupa <strong>"{duplicateConfirmation.product.name}"</strong> sudah ada di katalog warung Anda.
                  </p>

                  {/* Comparison cards */}
                  <div className="space-y-2 bg-stone-50 p-3 rounded-2xl border border-stone-200/80 text-xs">
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-stone-200/60">
                      <span className="text-stone-500 text-[11px]">Di Katalog:</span>
                      <div className="text-right">
                        <div className="font-bold text-stone-900 truncate max-w-[170px]">
                          {duplicateConfirmation.product.name}
                        </div>
                        <div className="text-emerald-700 font-bold">
                          {formatRupiah(duplicateConfirmation.product.price)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-2 pt-0.5">
                      <span className="text-stone-500 text-[11px]">Input Baru:</span>
                      <div className="text-right">
                        <div className="font-bold text-stone-900 truncate max-w-[170px]">{name}</div>
                        <div className="text-emerald-700 font-bold">
                          {formatRupiah(parseFloat(price) || 0)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-stone-600 font-semibold text-center">
                    Apakah hanya ingin memperbarui harga produk tersebut atau tambah keduanya?
                  </p>

                  <div className="space-y-2">
                    <button
                      type="button"
                      id="btn-confirm-update-price"
                      onClick={() => handleUpdateExistingPrice(duplicateConfirmation)}
                      className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all"
                    >
                      <Check className="w-4 h-4" />
                      <span>Perbarui Harga Produk Ini</span>
                    </button>

                    <button
                      type="button"
                      id="btn-confirm-keep-both"
                      onClick={() => handleKeepBoth(duplicateConfirmation)}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Tambah Keduanya (Produk Baru)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDuplicateConfirmation(null)}
                      className="w-full py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 font-semibold text-xs transition-all text-center"
                    >
                      Batal & Periksa Kembali
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Header */}
            <div className="px-4 py-3 bg-emerald-800 text-white flex items-center justify-between">
              <span className="font-bold text-sm">
                {editingProduct ? 'Edit Data Produk' : 'Tambah Produk Baru'}
              </span>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-full text-emerald-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3.5">
              {/* Product Image / Icon Selection */}
              <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Gambar Produk (Kostum):</span>
                  </label>
                  {image && image !== '📦' && (
                    <button
                      type="button"
                      onClick={() => {
                        setImage('📦');
                        setImageUrlInput('');
                      }}
                      className="text-[11px] text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-0.5 active:scale-95 transition-all"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Hapus Foto</span>
                    </button>
                  )}
                </div>

                {/* Main Preview & Quick Actions */}
                <div className="flex items-center gap-3">
                  {/* Current Preview Box */}
                  <div className="relative group">
                    <div className="w-20 h-20 rounded-2xl bg-white border-2 border-dashed border-emerald-500/60 flex items-center justify-center text-4xl overflow-hidden shrink-0 shadow-sm">
                      {image && (image.startsWith('data:') || image.startsWith('http')) ? (
                        <img
                          src={image}
                          alt="Preview Produk"
                          referrerPolicy="no-referrer"
                          onError={() => setImageError(true)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>{image || '📦'}</span>
                      )}
                    </div>
                    {imageError && (
                      <span className="absolute inset-0 bg-rose-900/80 text-white text-[9px] p-1 flex items-center justify-center text-center font-bold rounded-2xl">
                        Gambar error
                      </span>
                    )}
                  </div>

                  {/* Mode Buttons Switcher */}
                  <div className="flex-1 space-y-1.5">
                    <div className="grid grid-cols-3 gap-1 bg-stone-200/80 p-0.5 rounded-xl text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setImageTab('upload')}
                        className={`py-1 rounded-lg flex items-center justify-center gap-1 transition-all ${
                          imageTab === 'upload'
                            ? 'bg-white text-emerald-800 shadow-xs font-bold'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        <Upload className="w-3 h-3" />
                        <span>Foto/Galeri</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageTab('url')}
                        className={`py-1 rounded-lg flex items-center justify-center gap-1 transition-all ${
                          imageTab === 'url'
                            ? 'bg-white text-emerald-800 shadow-xs font-bold'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        <Link className="w-3 h-3" />
                        <span>Link URL</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setImageTab('icon')}
                        className={`py-1 rounded-lg flex items-center justify-center gap-1 transition-all ${
                          imageTab === 'icon'
                            ? 'bg-white text-emerald-800 shadow-xs font-bold'
                            : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        <Smile className="w-3 h-3" />
                        <span>Ikon</span>
                      </button>
                    </div>

                    <div className="text-[10px] text-stone-500 italic">
                      {imageTab === 'upload' && 'Pilih foto dari Galeri HP atau jepret langsung lewat Kamera'}
                      {imageTab === 'url' && 'Gunakan tautan gambar dari internet atau katalog suplier'}
                      {imageTab === 'icon' && 'Pilih simbol/ikon warung praktis'}
                    </div>
                  </div>
                </div>

                {/* Sub Tab: Upload / Camera */}
                {imageTab === 'upload' && (
                  <div className="pt-1 space-y-2">
                    {/* Hidden inputs for gallery & camera */}
                    <input
                      type="file"
                      ref={galleryInputRef}
                      onChange={handleGalleryChange}
                      accept="image/*"
                      className="hidden"
                    />
                    <input
                      type="file"
                      ref={cameraInputRef}
                      onChange={handleCameraChange}
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        id="btn-pick-gallery"
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="py-2 px-3 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all"
                      >
                        <Upload className="w-4 h-4 text-emerald-600" />
                        <span>Pilih dari Galeri</span>
                      </button>

                      <button
                        id="btn-take-camera"
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="py-2 px-3 rounded-xl bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition-all"
                      >
                        <Camera className="w-4 h-4 text-emerald-600" />
                        <span>Foto dari Kamera</span>
                      </button>
                    </div>
                    <div className="text-[10px] text-stone-400 text-center">
                      *Foto otomatis dikompresi ringan agar database tetap cepat dan hemat memori HP
                    </div>
                  </div>
                )}

                {/* Sub Tab: Web Image URL */}
                {imageTab === 'url' && (
                  <div className="pt-1 space-y-1.5">
                    <div className="flex gap-1.5">
                      <input
                        type="url"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        placeholder="https://contoh.com/gambar-produk.jpg"
                        className="flex-1 bg-white border border-stone-300 rounded-xl px-3 py-1.5 text-xs text-stone-900 focus:outline-none focus:border-emerald-600 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleApplyUrl}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 active:scale-95 transition-all"
                      >
                        Pakai
                      </button>
                    </div>
                    <div className="text-[10px] text-stone-500">
                      Tempel link gambar produk dari Google Image atau situs distributor/grosir.
                    </div>
                  </div>
                )}

                {/* Sub Tab: Icon / Emoji Warung */}
                {imageTab === 'icon' && (
                  <div className="pt-1">
                    <div className="flex flex-wrap gap-1 p-2 bg-white rounded-xl border border-stone-200 max-h-28 overflow-y-auto">
                      {COMMON_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            setImage(emoji);
                            setImageUrlInput('');
                          }}
                          className={`w-8 h-8 flex items-center justify-center text-lg rounded-xl transition-all ${
                            image === emoji
                              ? 'bg-emerald-600 text-white scale-110 shadow-xs'
                              : 'hover:bg-stone-100 text-stone-800'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Product Name */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Nama Produk:
                </label>
                <input
                  id="input-product-name"
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setDismissSimilarBanner(false);
                  }}
                  placeholder="Contoh: Beras Ramos 1kg"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-emerald-600"
                  required
                />

                {/* Live Duplicate / Similar Suggestion Banner */}
                {!editingProduct && similarMatches.length > 0 && !dismissSimilarBanner && (
                  <div className="mt-2 p-3 bg-amber-50/95 border border-amber-300 rounded-2xl space-y-2 text-stone-800 shadow-2xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-bold text-amber-950">
                            {similarMatches[0].matchType === 'exact'
                              ? 'Produk sudah ada di katalog!'
                              : `Ditemukan produk serupa (${similarMatches[0].similarityPercent}% kemiripan)`}
                          </p>
                          <p className="text-[11px] text-amber-800">
                            Perbarui harga produk yang sudah ada, atau tetap simpan keduanya?
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDismissSimilarBanner(true)}
                        className="p-1 text-amber-700 hover:text-amber-950 rounded-lg"
                        title="Tutup saran sementara"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Matched Product Details Card */}
                    <div className="flex items-center gap-2.5 bg-white p-2 rounded-xl border border-amber-200/90 shadow-2xs">
                      <div className="w-9 h-9 rounded-lg bg-stone-100 flex items-center justify-center text-lg shrink-0 overflow-hidden border border-stone-200">
                        {similarMatches[0].product.image &&
                        (similarMatches[0].product.image.startsWith('data:') ||
                          similarMatches[0].product.image.startsWith('http')) ? (
                          <img
                            src={similarMatches[0].product.image}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{similarMatches[0].product.image || '📦'}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs text-stone-900 truncate">
                          {similarMatches[0].product.name}
                        </div>
                        <div className="text-[11px] text-stone-600 flex items-center gap-1.5 flex-wrap">
                          <span>
                            Harga saat ini:{' '}
                            <strong className="text-emerald-700 font-bold">
                              {formatRupiah(similarMatches[0].product.price)}
                            </strong>
                          </span>
                          <span className="text-stone-300">•</span>
                          <span>{similarMatches[0].product.category}</span>
                          {similarMatches[0].product.stock !== undefined && (
                            <>
                              <span className="text-stone-300">•</span>
                              <span>Stok: {similarMatches[0].product.stock}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <button
                        type="button"
                        id="btn-banner-update-price"
                        onClick={() => handleUpdateExistingPrice(similarMatches[0])}
                        className="py-1.5 px-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs active:scale-95 transition-all text-center leading-tight"
                        title="Perbarui harga produk lama dengan harga yang Anda ketik"
                      >
                        <Check className="w-3.5 h-3.5 shrink-0" />
                        <span>Perbarui Harga Ini</span>
                      </button>

                      <button
                        type="button"
                        id="btn-banner-keep-both"
                        onClick={() => handleKeepBoth(similarMatches[0])}
                        className="py-1.5 px-2 rounded-xl bg-white hover:bg-stone-50 text-stone-800 font-bold text-[11px] border border-stone-300 flex items-center justify-center gap-1 shadow-2xs active:scale-95 transition-all text-center leading-tight"
                        title="Simpan sebagai barang baru (keduanya ada di katalog)"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
                        <span>Tambah Keduanya</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Prices: Harga Jual & Harga Modal */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-emerald-800 block mb-1">
                    Harga Jual (Rp):
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="15000"
                    className="w-full border border-emerald-400 bg-emerald-50/20 rounded-xl px-3 py-2 text-sm font-bold text-emerald-900 focus:outline-none focus:border-emerald-600"
                    required
                    min="100"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-600 block mb-1">
                    Harga Modal/Beli (Rp):
                  </label>
                  <input
                    type="number"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="13000 (opsional)"
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm text-stone-700 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    Kategori:
                  </label>
                  <input
                    type="text"
                    list="category-suggestions"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Sembako"
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800 focus:outline-none focus:border-emerald-600"
                  />
                  <datalist id="category-suggestions">
                    <option value="Sembako" />
                    <option value="Makanan & Mie" />
                    <option value="Minuman" />
                    <option value="Rokok" />
                    <option value="Gas & Galon" />
                    <option value="Bumbu Dapur" />
                    <option value="Sabun & Kebersihan" />
                    <option value="Camilan / Snack" />
                  </datalist>
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    Satuan:
                  </label>
                  <input
                    type="text"
                    list="unit-suggestions"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="pcs / kg / bks"
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800 focus:outline-none focus:border-emerald-600"
                  />
                  <datalist id="unit-suggestions">
                    <option value="pcs" />
                    <option value="kg" />
                    <option value="bks" />
                    <option value="btl" />
                    <option value="sachet" />
                    <option value="renceng" />
                    <option value="dus" />
                    <option value="liter" />
                  </datalist>
                </div>
              </div>

              {/* Fitur Jual Ecer / Satuan Kecil (Rokok per Batang, Kopi Sachet, Telur Butir, dll) */}
              <div className="bg-amber-50/60 rounded-2xl border border-amber-200/80 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">✂️</span>
                    <div>
                      <h4 className="text-xs font-bold text-amber-950">
                        Izinkan Jual Ecer / Satuan Kecil
                      </h4>
                      <p className="text-[10px] text-amber-800">
                        Contoh: Rokok per batang, Kopi per sachet, Telur per butir
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !allowRetail;
                      setAllowRetail(next);
                      if (next && !retailUnit) {
                        setRetailUnit(category === 'Rokok' || name.toLowerCase().includes('rokok') ? 'Batang' : 'Pcs');
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      allowRetail ? 'bg-amber-600' : 'bg-stone-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        allowRetail ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {allowRetail && (
                  <div className="space-y-2.5 pt-1 border-t border-amber-200/60 animate-in fade-in duration-200">
                    {/* Satuan Ecer Selector */}
                    <div>
                      <label className="text-[11px] font-bold text-amber-900 block mb-1">
                        Nama Satuan Ecer:
                      </label>
                      <div className="flex flex-wrap gap-1.5 mb-1.5">
                        {['Batang', 'Butir', 'Sachet', 'Pcs', 'Keping', 'Bungkus', 'Potong'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setRetailUnit(preset)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all ${
                              retailUnit.toLowerCase() === preset.toLowerCase()
                                ? 'bg-amber-700 text-white shadow-xs'
                                : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-100'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={retailUnit}
                        onChange={(e) => setRetailUnit(e.target.value)}
                        placeholder="Batang"
                        className="w-full border border-amber-300 bg-white rounded-xl px-3 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-amber-600"
                        required={allowRetail}
                      />
                    </div>

                    {/* Harga Ecer & Modal Ecer */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-bold text-amber-900 block mb-1">
                          Harga Jual Ecer (Rp):
                        </label>
                        <input
                          type="number"
                          value={retailPrice}
                          onChange={(e) => setRetailPrice(e.target.value)}
                          placeholder="2500"
                          className="w-full border border-amber-400 bg-amber-50/50 rounded-xl px-3 py-1.5 text-xs font-bold text-amber-950 focus:outline-none focus:border-amber-600"
                          required={allowRetail}
                          min="100"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                          Modal Ecer (Rp) - Opsional:
                        </label>
                        <input
                          type="number"
                          value={retailCostPrice}
                          onChange={(e) => setRetailCostPrice(e.target.value)}
                          placeholder="2000"
                          className="w-full border border-stone-300 bg-white rounded-xl px-3 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-amber-600"
                        />
                      </div>
                    </div>

                    {/* Rasio: Isi per Satuan Utama */}
                    <div>
                      <label className="text-[11px] font-medium text-amber-900 block mb-1">
                        Isi per 1 {unit || 'Bungkus/Pack'} (Jumlah {retailUnit || 'Batang'}):
                      </label>
                      <input
                        type="number"
                        value={retailRatio}
                        onChange={(e) => setRetailRatio(e.target.value)}
                        placeholder="16 (contoh 1 bungkus isi 16 batang)"
                        className="w-full border border-amber-300 bg-white rounded-xl px-3 py-1.5 text-xs text-stone-800 focus:outline-none focus:border-amber-600"
                        min="1"
                      />
                    </div>

                    {/* Kalkulasi Potensi Untung Ecer */}
                    {retailPrice && parseFloat(retailPrice) > 0 && price && parseFloat(price) > 0 && (
                      <div className="bg-amber-100/80 rounded-xl p-2 text-[11px] text-amber-950 border border-amber-300/80 space-y-0.5">
                        <div className="font-bold flex items-center gap-1 text-amber-900">
                          <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                          <span>Perbandingan Harga:</span>
                        </div>
                        <div>
                          1 {unit || 'Bungkus'} = <strong>{formatRupiah(parseFloat(price))}</strong>
                        </div>
                        <div>
                          1 {retailUnit || 'Batang'} = <strong>{formatRupiah(parseFloat(retailPrice))}</strong>
                        </div>
                        {retailRatio && parseInt(retailRatio, 10) > 0 && (
                          <div className="pt-0.5 font-semibold text-emerald-800">
                            Jika 1 {unit || 'Bungkus'} habis diecer ({retailRatio} {retailUnit}):{' '}
                            <strong>{formatRupiah(parseFloat(retailPrice) * parseInt(retailRatio, 10))}</strong>{' '}
                            <span className="text-emerald-700 text-[10px]">
                              (+{formatRupiah((parseFloat(retailPrice) * parseInt(retailRatio, 10)) - parseFloat(price))})
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Bottom Action */}
            <div className="p-3 bg-stone-50 border-t border-stone-200 flex gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold text-xs"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
              >
                {editingProduct ? 'Perbarui Produk' : 'Simpan Produk'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
