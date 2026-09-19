import { useState, useMemo, useEffect, useRef } from 'react';
import { Product, CartItem } from '../types';
import { formatRupiah } from '../utils/storage';
import { ProductSortOption, SORT_OPTIONS, sortProducts } from '../utils/productSort';
import { findSimilarProducts } from '../utils/productDuplicateCheck';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  ArrowRight,
  PackagePlus,
  X,
  Sparkles,
  ArrowUpDown,
  Check,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface KasirViewProps {
  products: Product[];
  cart: CartItem[];
  onAddToCart: (product: Product) => void;
  onUpdateQuantity: (productId: string, delta: number) => void;
  onRemoveFromCart: (productId: string) => void;
  onClearCart: () => void;
  onOpenPayment: () => void;
}

export function KasirView({
  products,
  cart,
  onAddToCart,
  onUpdateQuantity,
  onRemoveFromCart,
  onClearCart,
  onOpenPayment,
}: KasirViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [sortBy, setSortBy] = useState<ProductSortOption>('newest');
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [showConfirmClearCart, setShowConfirmClearCart] = useState(false);

  // Manual Quick Item State
  const [showManualItemModal, setShowManualItemModal] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualPrice, setManualPrice] = useState('');

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['Semua', ...Array.from(set)];
  }, [products]);

  // Controls auto-hide on scroll down
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(54);
  const lastScrollY = useRef(0);

  // Measure header height dynamically so sticky is 100% pixel-perfect under header
  useEffect(() => {
    const updateHeaderHeight = () => {
      const headerEl = document.getElementById('warung-header');
      if (headerEl) {
        setHeaderHeight(headerEl.offsetHeight);
      }
    };
    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
    return () => window.removeEventListener('resize', updateHeaderHeight);
  }, []);

  // Listen to scroll direction: hide when scrolling down, show when scrolling up
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const diff = currentScrollY - lastScrollY.current;

          // Don't auto-hide if an input or textarea is active
          const activeTag = document.activeElement?.tagName;
          const isInputActive = activeTag === 'INPUT' || activeTag === 'TEXTAREA';

          if (!isInputActive) {
            // Scrolled down by more than 10px and past 50px
            if (diff > 10 && currentScrollY > 50) {
              setIsControlsVisible(false);
            } else if (diff < -10 || currentScrollY <= 30) {
              // Scrolled up or returned near top
              setIsControlsVisible(true);
            }
          }

          lastScrollY.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Filtered and Sorted Products
  const sortedAndFilteredProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      const matchCat = selectedCategory === 'Semua' || p.category === selectedCategory;
      const matchQuery =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchQuery;
    });
    return sortProducts(filtered, sortBy);
  }, [products, selectedCategory, searchQuery, sortBy]);

  // Cart total calculations
  const totalCartQty = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  const totalCartAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cart]);

  // Map of quantities in cart for quick display
  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((c) => {
      map.set(c.product.id, c.quantity);
    });
    return map;
  }, [cart]);

  // Check if manual item name matches an existing product in catalog
  const similarManualProducts = useMemo(() => {
    if (!manualName.trim()) return [];
    return findSimilarProducts(manualName, products);
  }, [manualName, products]);

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(manualPrice);
    if (!manualName.trim() || isNaN(priceNum) || priceNum <= 0) return;

    const customProduct: Product = {
      id: `manual-${Date.now()}`,
      name: manualName.trim(),
      price: priceNum,
      category: 'Item Bebas',
      unit: 'item',
      image: '✨',
    };

    onAddToCart(customProduct);
    setManualName('');
    setManualPrice('');
    setShowManualItemModal(false);
  };

  return (
    <div className="flex flex-col flex-1 pb-24">
      {/* Floating pill to reopen controls when hidden and scrolled down */}
      {!isControlsVisible && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-25 transition-all duration-200"
          style={{ top: `${headerHeight + 8}px` }}
        >
          <button
            id="btn-show-hidden-controls"
            type="button"
            onClick={() => setIsControlsVisible(true)}
            className="bg-stone-900/90 hover:bg-stone-900 text-white text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-lg border border-stone-700/80 flex items-center gap-1.5 backdrop-blur-md active:scale-95 transition-all cursor-pointer"
          >
            <Search className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cari / Filter</span>
            {selectedCategory !== 'Semua' && (
              <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                {selectedCategory}
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
          </button>
        </div>
      )}

      {/* Top Search & Category Filter Toolbar (Auto-hides on scroll down) */}
      <div
        id="kasir-toolbar-controls"
        style={{
          top: `${headerHeight}px`,
          transform: isControlsVisible ? 'translateY(0)' : 'translateY(-125%)',
        }}
        className={`bg-white p-3 border-b border-stone-200 sticky z-20 shadow-xs space-y-2 transition-transform duration-250 ease-out ${
          isControlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Search Bar + Quick Manual Item Button + Collapse Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            <input
              id="input-search-product"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari barang / scan nama..."
              className="w-full bg-stone-100 border border-stone-300 rounded-xl pl-9 pr-8 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            id="btn-add-manual-item"
            onClick={() => setShowManualItemModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-semibold whitespace-nowrap active:scale-95 transition-all"
            title="Tambah barang bebas tanpa daftar"
          >
            <PackagePlus className="w-4 h-4 text-emerald-600" />
            <span className="hidden xs:inline">Item Bebas</span>
          </button>

          <button
            id="btn-collapse-controls"
            type="button"
            onClick={() => setIsControlsVisible(false)}
            title="Sembunyikan Pengatur List"
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 active:scale-95 transition-all shrink-0"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>

        {/* Category Horizontal Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-emerald-700 text-white shadow-xs'
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
                  id={`btn-sort-kasir-${opt.value}`}
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

      {/* Product List / Table Section */}
      <div className="p-3">
        {sortedAndFilteredProducts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-stone-200 p-6">
            <p className="text-stone-500 text-sm mb-2">Tidak ditemukan produk "{searchQuery}"</p>
            <button
              onClick={() => {
                setManualName(searchQuery);
                setShowManualItemModal(true);
              }}
              className="text-xs text-emerald-700 font-bold underline"
            >
              + Buat item "{searchQuery}" langsung
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {sortedAndFilteredProducts.map((prod) => {
              const qtyInCart = cartQtyMap.get(prod.id) || 0;
              const isSelected = qtyInCart > 0;

              return (
                <div
                  key={prod.id}
                  id={`product-card-${prod.id}`}
                  className={`bg-white rounded-2xl border transition-all duration-150 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-sm ${
                    isSelected
                      ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/15'
                      : 'border-stone-200 hover:border-stone-300'
                  }`}
                >
                  {/* Top info and Image */}
                  <div
                    onClick={() => onAddToCart(prod)}
                    className="p-2.5 cursor-pointer active:scale-98 transition-transform select-none"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      {/* Image / Emoji */}
                      <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-xl overflow-hidden shrink-0 shadow-inner">
                        {prod.image && prod.image.startsWith('data:') ? (
                          <img
                            src={prod.image}
                            alt={prod.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : prod.image && prod.image.startsWith('http') ? (
                          <img
                            src={prod.image}
                            alt={prod.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{prod.image || '📦'}</span>
                        )}
                      </div>

                      {/* Category tag */}
                      <span className="text-[10px] font-medium text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                        {prod.category}
                      </span>
                    </div>

                    {/* Name */}
                    <h3 className="font-bold text-stone-900 text-xs sm:text-sm line-clamp-2 leading-tight mb-1">
                      {prod.name}
                    </h3>

                    {/* Price & Unit */}
                    <div className="flex items-baseline justify-between">
                      <span className="font-extrabold text-emerald-700 text-sm sm:text-base">
                        {formatRupiah(prod.price)}
                      </span>
                      <span className="text-[10px] text-stone-400">/{prod.unit || 'pcs'}</span>
                    </div>
                  </div>

                  {/* Ergonomic Stepper (+ / - Button) */}
                  <div className="px-2.5 pb-2 pt-1 border-t border-stone-100 bg-stone-50/50 flex items-center justify-between">
                    {qtyInCart === 0 ? (
                      <button
                        id={`btn-add-${prod.id}`}
                        onClick={() => onAddToCart(prod)}
                        className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1 active:scale-95 transition-all shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah</span>
                      </button>
                    ) : (
                      <div className="w-full flex items-center justify-between bg-white border border-emerald-400 rounded-lg overflow-hidden shadow-inner">
                        <button
                          onClick={() => onUpdateQuantity(prod.id, -1)}
                          className="w-8 h-8 flex items-center justify-center bg-emerald-100 hover:bg-emerald-200 text-emerald-800 active:scale-90 transition-all"
                          title="Kurangi"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>

                        <span className="font-black text-sm text-emerald-950 px-2">
                          {qtyInCart}
                        </span>

                        <button
                          onClick={() => onUpdateQuantity(prod.id, 1)}
                          className="w-8 h-8 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white active:scale-90 transition-all"
                          title="Tambah"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Bottom Sticky Checkout Bar (Mobile First Thumb Friendly) */}
      {totalCartQty > 0 && (
        <div
          id="sticky-cart-bar"
          className="fixed bottom-0 left-0 right-0 z-40 bg-stone-900 text-white border-t border-stone-800 shadow-2xl p-2.5 sm:p-3 transition-transform"
        >
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
            {/* Left: Cart details click to toggle drawer */}
            <button
              onClick={() => setCartDrawerOpen(true)}
              className="flex items-center gap-2.5 text-left p-1 rounded-xl hover:bg-stone-800 active:scale-98 transition-all"
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-stone-950 font-black text-[11px] w-5 h-5 rounded-full flex items-center justify-center shadow-xs">
                  {totalCartQty}
                </span>
              </div>
              <div>
                <div className="text-[11px] text-stone-400 font-medium leading-none mb-0.5">
                  Total Belanja ({totalCartQty} item)
                </div>
                <div className="text-base sm:text-lg font-black text-lime-300 leading-tight">
                  {formatRupiah(totalCartAmount)}
                </div>
              </div>
            </button>

            {/* Right: Bayar Button & Hapus Keranjang */}
            <div className="flex items-center gap-1.5">
              <button
                id="btn-clear-cart"
                type="button"
                onClick={() => setShowConfirmClearCart(true)}
                title="Kosongkan Keranjang Belanja"
                className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-rose-400 active:scale-95 transition-all flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                id="btn-checkout-bayar"
                type="button"
                onClick={onOpenPayment}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-black text-sm flex items-center gap-1.5 shadow-lg active:scale-95 transition-all"
              >
                <span>BAYAR</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Detail Drawer Modal (View / Edit Cart Items) */}
      {cartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="px-4 py-3 bg-stone-100 border-b border-stone-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-emerald-700" />
                <span className="font-bold text-sm text-stone-900">
                  Rincian Keranjang ({totalCartQty} barang)
                </span>
              </div>
              <button
                onClick={() => setCartDrawerOpen(false)}
                className="p-1 rounded-full text-stone-500 hover:text-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 overflow-y-auto flex-1 divide-y divide-stone-100">
              {cart.map((item) => (
                <div key={item.product.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center text-lg overflow-hidden shrink-0 shadow-xs">
                    {item.product.image && (item.product.image.startsWith('data:') || item.product.image.startsWith('http')) ? (
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{item.product.image || '📦'}</span>
                    )}
                  </div>

                  <div className="flex-1 pr-2 min-w-0">
                    <div className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                      {item.product.name}
                    </div>
                    <div className="text-[11px] text-stone-500">
                      {formatRupiah(item.product.price)} x {item.quantity} ={' '}
                      <span className="font-bold text-emerald-700">
                        {formatRupiah(item.subtotal)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center bg-stone-100 rounded-lg border border-stone-300">
                      <button
                        onClick={() => onUpdateQuantity(item.product.id, -1)}
                        className="w-7 h-7 flex items-center justify-center text-stone-700 hover:bg-stone-200 rounded-l-lg"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center font-bold text-xs text-stone-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.product.id, 1)}
                        className="w-7 h-7 flex items-center justify-center text-stone-700 hover:bg-stone-200 rounded-r-lg"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => onRemoveFromCart(item.product.id)}
                      className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-stone-50 border-t border-stone-200 space-y-2">
              <div className="flex justify-between items-center text-sm font-bold text-stone-900">
                <span>Total Belanja:</span>
                <span className="text-emerald-700 text-lg">{formatRupiah(totalCartAmount)}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmClearCart(true)}
                  className="py-3 px-3.5 rounded-xl bg-stone-100 hover:bg-rose-50 text-stone-600 hover:text-rose-700 border border-stone-200 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Kosongkan</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCartDrawerOpen(false);
                    onOpenPayment();
                  }}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 active:scale-98 transition-all"
                >
                  <span>Lanjut ke Pembayaran</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-App Confirmation Modal to Clear Cart */}
      {showConfirmClearCart && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl space-y-4 border border-stone-200 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-stone-900">Kosongkan Keranjang?</h3>
              <p className="text-xs text-stone-500">
                Semua <strong>{totalCartQty} barang belanjaan</strong> senilai{' '}
                <strong className="text-stone-700">{formatRupiah(totalCartAmount)}</strong> akan dihapus dari transaksi saat ini.
              </p>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmClearCart(false)}
                className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs active:scale-95 transition-all"
              >
                Batal
              </button>
              <button
                type="button"
                id="btn-confirm-clear-cart"
                onClick={() => {
                  onClearCart();
                  setShowConfirmClearCart(false);
                  setCartDrawerOpen(false);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Ya, Kosongkan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Item Quick Modal */}
      {showManualItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <form
            onSubmit={handleAddManualItem}
            className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden"
          >
            <div className="px-4 py-3 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Tambah Item Bebas (Non-Daftar)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowManualItemModal(false)}
                className="text-emerald-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Nama Barang / Jasa:
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Misal: Es Batu, Kerupuk, Pulsa 10k"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-emerald-600"
                  autoFocus
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Harga Satuan (Rp):
                </label>
                <input
                  type="number"
                  value={manualPrice}
                  onChange={(e) => setManualPrice(e.target.value)}
                  placeholder="1000"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-base font-bold text-emerald-800 focus:outline-none focus:border-emerald-600"
                  required
                  min="1"
                />
              </div>

              {/* Duplicate/Similar product suggestion in Kasir */}
              {similarManualProducts.length > 0 && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-amber-950 font-bold text-[11px]">
                    <span>💡 Produk Serupa Sudah Ada:</span>
                    <span className="text-emerald-700 font-bold">
                      {formatRupiah(similarManualProducts[0].product.price)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-stone-700 text-xs truncate">
                      {similarManualProducts[0].product.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        onAddToCart(similarManualProducts[0].product);
                        setManualName('');
                        setManualPrice('');
                        setShowManualItemModal(false);
                      }}
                      className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold shrink-0 flex items-center gap-1 active:scale-95 transition-all"
                    >
                      <Check className="w-3 h-3" />
                      <span>Pakai Ini</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowManualItemModal(false)}
                  className="flex-1 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                >
                  Masukkan ke Kasir
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
