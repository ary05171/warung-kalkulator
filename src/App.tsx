import { useState, useEffect, useCallback } from 'react';
import {
  WarungDatabase,
  Product,
  CartItem,
  Transaction,
  CashEntry,
  Supplier,
  DebtItem,
  DebtPayment,
} from './types';
import {
  getLocalDatabase,
  saveLocalDatabase,
  fetchServerDatabase,
  syncDatabaseToServer,
} from './utils/storage';
import { HeaderStats } from './components/HeaderStats';
import { KasirView } from './components/KasirView';
import { PaymentModal } from './components/PaymentModal';
import { ReceiptModal } from './components/ReceiptModal';
import { ProductManager } from './components/ProductManager';
import { CashFlowManager } from './components/CashFlowManager';
import { DebtsManager } from './components/DebtsManager';
import { SuppliersManager } from './components/SuppliersManager';
import { TermuxLocalModal } from './components/TermuxLocalModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  Calculator,
  Package,
  Wallet,
  BookOpen,
  Truck,
} from 'lucide-react';

export default function App() {
  const [db, setDb] = useState<WarungDatabase>(() => getLocalDatabase());
  const [serverConnected, setServerConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Active Main Navigation Tab: 'kasir' | 'produk' | 'kas' | 'hutang' | 'suplier'
  const [currentTab, setCurrentTab] = useState<'kasir' | 'produk' | 'kas' | 'hutang' | 'suplier'>('kasir');

  // Cart State (In-Memory for ongoing checkout)
  const [cart, setCart] = useState<CartItem[]>([]);

  // Modals
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<Transaction | null>(null);
  const [isTermuxModalOpen, setIsTermuxModalOpen] = useState(false);

  // Initial Sync from Server on Load
  useEffect(() => {
    let isMounted = true;
    async function initCheck() {
      try {
        const serverData = await fetchServerDatabase();
        if (serverData && isMounted) {
          setDb(serverData);
          setServerConnected(true);
        } else {
          // Check health
          const h = await fetch('/api/health').catch(() => null);
          if (h && h.ok && isMounted) {
            setServerConnected(true);
          }
        }
      } catch {
        if (isMounted) setServerConnected(false);
      }
    }
    initCheck();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update DB Helper: saves locally & attempts background server sync
  const updateDatabase = useCallback((updater: (prev: WarungDatabase) => WarungDatabase) => {
    setDb((prev) => {
      const nextDb = updater(prev);
      saveLocalDatabase(nextDb);
      // Background sync to server
      syncDatabaseToServer(nextDb).then((ok) => {
        setServerConnected(ok);
      });
      return nextDb;
    });
  }, []);

  const handleManualRefreshSync = async () => {
    setIsSyncing(true);
    try {
      const serverData = await fetchServerDatabase();
      if (serverData) {
        setDb(serverData);
        setServerConnected(true);
      } else {
        const ok = await syncDatabaseToServer(db);
        setServerConnected(ok);
      }
    } catch {
      setServerConnected(false);
    } finally {
      setTimeout(() => setIsSyncing(false), 500);
    }
  };

  // Cart Handlers with Pack & Retail Support
  const handleAddToCart = (product: Product, unitType: 'pack' | 'retail' = 'pack') => {
    const isRetail = unitType === 'retail';
    const unitPrice = isRetail ? (product.retailPrice || product.price) : product.price;
    const unitName = isRetail ? (product.retailUnit || 'Batang') : (product.unit || 'pcs');
    const itemKey = `${product.id}-${unitType}`;

    setCart((prev) => {
      const existing = prev.find(
        (item) => (item.itemKey || `${item.product.id}-${item.unitType || 'pack'}`) === itemKey
      );
      if (existing) {
        return prev.map((item) => {
          const k = item.itemKey || `${item.product.id}-${item.unitType || 'pack'}`;
          if (k === itemKey) {
            const newQty = item.quantity + 1;
            return {
              ...item,
              quantity: newQty,
              subtotal: newQty * (item.unitPrice || unitPrice),
            };
          }
          return item;
        });
      }
      return [
        ...prev,
        {
          product,
          quantity: 1,
          subtotal: unitPrice,
          unitType,
          unitName,
          unitPrice,
          itemKey,
        },
      ];
    });
  };

  const handleUpdateQuantity = (itemKeyOrId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          const k = item.itemKey || `${item.product.id}-${item.unitType || 'pack'}`;
          if (k === itemKeyOrId || item.product.id === itemKeyOrId) {
            const newQty = item.quantity + delta;
            const price = item.unitPrice || item.product.price;
            return {
              ...item,
              quantity: newQty,
              subtotal: newQty * price,
            };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const handleRemoveFromCart = (itemKeyOrId: string) => {
    setCart((prev) =>
      prev.filter((item) => {
        const k = item.itemKey || `${item.product.id}-${item.unitType || 'pack'}`;
        return k !== itemKeyOrId && item.product.id !== itemKeyOrId;
      })
    );
  };

  const handleClearCart = () => {
    setCart([]);
  };

  // Complete Transaction Handler
  const handleCompleteTransaction = (newTransaction: Transaction) => {
    updateDatabase((prev) => {
      // 1. If stock is tracked, deduct stock (handling pack & retail fractions)
      const updatedProducts = prev.products.map((p) => {
        const cartItems = newTransaction.items.filter((i) => i.productId === p.id);
        if (cartItems.length > 0 && p.stock !== undefined) {
          let totalDeduction = 0;
          cartItems.forEach((ci) => {
            if (ci.unitType === 'retail' && p.retailRatio && p.retailRatio > 0) {
              totalDeduction += ci.quantity / p.retailRatio;
            } else {
              totalDeduction += ci.quantity;
            }
          });
          const newStock = Math.max(0, Math.round((p.stock - totalDeduction) * 100) / 100);
          return { ...p, stock: newStock };
        }
        return p;
      });

      // 2. If it is a debt transaction, also append to debts collection
      let updatedDebts = [...prev.debts];
      if (newTransaction.paymentType === 'debt') {
        const paidAmount = newTransaction.debtPaidAmount || 0;
        const newDebtItem: DebtItem = {
          id: `debt-${Date.now()}`,
          transactionId: newTransaction.id,
          customerName: newTransaction.customerName || 'Pelanggan Bon',
          customerPhone: newTransaction.customerPhone,
          amount: newTransaction.totalAmount,
          paidAmount: paidAmount,
          status:
            paidAmount >= newTransaction.totalAmount
              ? 'paid'
              : paidAmount > 0
              ? 'partial'
              : 'unpaid',
          createdAt: newTransaction.timestamp,
          dueDate: newTransaction.debtDueDate,
          itemsSummary: newTransaction.items.map((i) => `${i.quantity}x ${i.name}`).join(', '),
          notes: newTransaction.notes,
          payments:
            paidAmount > 0
              ? [
                  {
                    id: `pay-${Date.now()}`,
                    date: newTransaction.timestamp,
                    amount: paidAmount,
                    note: 'Uang Muka / Bayar Sebagian di Kasir',
                  },
                ]
              : [],
        };
        updatedDebts = [newDebtItem, ...updatedDebts];
      }

      return {
        ...prev,
        products: updatedProducts,
        transactions: [newTransaction, ...prev.transactions],
        debts: updatedDebts,
      };
    });

    setCart([]);
    setIsPaymentModalOpen(false);
    setActiveReceipt(newTransaction);
  };

  // Product Manager Handlers
  const handleSaveProduct = (product: Product) => {
    updateDatabase((prev) => {
      const idx = prev.products.findIndex((p) => p.id === product.id);
      if (idx >= 0) {
        const copy = [...prev.products];
        copy[idx] = product;
        return { ...prev, products: copy };
      }
      return { ...prev, products: [product, ...prev.products] };
    });
  };

  const handleDeleteProduct = (productId: string) => {
    updateDatabase((prev) => ({
      ...prev,
      products: prev.products.filter((p) => p.id !== productId),
    }));
  };

  // Cash Flow Handlers
  const handleAddCashEntry = (entry: CashEntry) => {
    updateDatabase((prev) => ({
      ...prev,
      cashEntries: [entry, ...prev.cashEntries],
    }));
  };

  const handleDeleteCashEntry = (id: string) => {
    updateDatabase((prev) => ({
      ...prev,
      cashEntries: prev.cashEntries.filter((c) => c.id !== id),
    }));
  };

  // Debt Handlers
  const handleAddDebt = (debt: DebtItem) => {
    updateDatabase((prev) => ({
      ...prev,
      debts: [debt, ...prev.debts],
    }));
  };

  const handlePayDebt = (debtId: string, payment: DebtPayment) => {
    updateDatabase((prev) => {
      let paidCustomerName = '';
      const updatedDebts = prev.debts.map((d) => {
        if (d.id === debtId) {
          paidCustomerName = d.customerName;
          const newPaid = d.paidAmount + payment.amount;
          const newStatus = (newPaid >= d.amount ? 'paid' : 'partial') as 'paid' | 'partial';
          return {
            ...d,
            paidAmount: newPaid,
            status: newStatus,
            payments: [...(d.payments || []), payment],
          };
        }
        return d;
      });

      // Automatically add to cash entries so today's uang masuk reflects it!
      const cashEntry: CashEntry = {
        id: `cash-debt-${Date.now()}`,
        type: 'in',
        amount: payment.amount,
        category: 'Pelunasan Hutang',
        description: `Pelunasan bon dari ${paidCustomerName} (${payment.note || 'Lunas/Cicil'})`,
        timestamp: payment.date,
      };

      return {
        ...prev,
        debts: updatedDebts,
        cashEntries: [cashEntry, ...prev.cashEntries],
      };
    });
  };

  const handleDeleteDebt = (debtId: string) => {
    updateDatabase((prev) => ({
      ...prev,
      debts: prev.debts.filter((d) => d.id !== debtId),
    }));
  };

  // Supplier Handlers
  const handleSaveSupplier = (supplier: Supplier) => {
    updateDatabase((prev) => {
      const idx = prev.suppliers.findIndex((s) => s.id === supplier.id);
      if (idx >= 0) {
        const copy = [...prev.suppliers];
        copy[idx] = supplier;
        return { ...prev, suppliers: copy };
      }
      return { ...prev, suppliers: [supplier, ...prev.suppliers] };
    });
  };

  const handleDeleteSupplier = (id: string) => {
    updateDatabase((prev) => ({
      ...prev,
      suppliers: prev.suppliers.filter((s) => s.id !== id),
    }));
  };

  const handleQuickExpenseForSupplier = (supplier: Supplier) => {
    // Switch to cash flow tab and trigger expense modal
    setCurrentTab('kas');
  };

  const handleUpdateSettings = (settings: WarungDatabase['settings']) => {
    updateDatabase((prev) => ({
      ...prev,
      settings,
    }));
  };

  const handleRestoreDatabase = (restoredDb: WarungDatabase) => {
    setDb(restoredDb);
    saveLocalDatabase(restoredDb);
    syncDatabaseToServer(restoredDb);
  };

  const handleClearAllProducts = () => {
    if (db.products.length === 0) {
      alert('Katalog produk sudah kosong.');
      return;
    }
    if (
      confirm(
        `PERINGATAN KERAS:\nApakah Anda yakin ingin MENGHAPUS SEMUA (${db.products.length}) BARANG dari katalog warung?\n\n` +
        `Semua data nama produk, harga, stok, dan foto barang akan dibersihkan. Riwayat penjualan kasir tetap aman.`
      )
    ) {
      updateDatabase((prev) => ({
        ...prev,
        products: [],
      }));
      setCart([]);
      alert('Semua barang berhasil dibersihkan dari katalog warung.');
    }
  };

  const handleImportProducts = (newProducts: Product[], replaceMode = true) => {
    updateDatabase((prev) => {
      if (replaceMode) {
        return {
          ...prev,
          products: newProducts,
        };
      }
      // Merge mode
      const existingMap = new Map(prev.products.map((p) => [p.id, p]));
      newProducts.forEach((np) => existingMap.set(np.id, np));
      return {
        ...prev,
        products: Array.from(existingMap.values()),
      };
    });
  };

  const handleResetAllHistory = () => {
    if (db.transactions.length === 0 && db.cashEntries.length === 0 && db.debts.length === 0) {
      alert('Riwayat transaksi, kas, dan hutang sudah kosong.');
      return;
    }
    const input = prompt(
      'PERINGATAN:\nIni akan mengosongkan seluruh riwayat penjualan kasir, buku kas masuk/keluar, dan catatan hutang secara permanen.\n\n' +
      'Ketik kata "RESET" (huruf besar) untuk melanjutkan:'
    );
    if (input === 'RESET') {
      updateDatabase((prev) => ({
        ...prev,
        transactions: [],
        cashEntries: [],
        debts: [],
      }));
      setCart([]);
      alert('Seluruh riwayat transaksi kasir, buku kas, dan catatan hutang berhasil direset menjadi nol.');
    } else if (input !== null) {
      alert('Reset dibatalkan. Kata konfirmasi tidak sesuai.');
    }
  };

  const handleFactoryResetAll = () => {
    const input = prompt(
      'PERINGATAN RESET TOTAL PABRIK:\nSemua data produk, foto barang, riwayat transaksi, buku kas, dan hutang akan DIHAPUS BERSIH.\n\n' +
      'Ketik "HAPUS TOTAL" untuk mengonfirmasi reset total:'
    );
    if (input === 'HAPUS TOTAL') {
      updateDatabase(() => ({
        products: [],
        transactions: [],
        cashEntries: [],
        suppliers: [],
        debts: [],
        settings: {
          storeName: 'Warung Kasir',
          storeAddress: '',
          storePhone: '',
          receiptFooter: 'Terima kasih atas kunjungan Anda!',
        },
      }));
      setCart([]);
      alert('Aplikasi telah direset total ke kondisi awal pabrik.');
    } else if (input !== null) {
      alert('Reset total pabrik dibatalkan.');
    }
  };

  const unpaidDebtCount = db.debts.filter((d) => d.status !== 'paid').length;

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col font-sans max-w-xl mx-auto shadow-2xl relative">
      <OfflineIndicator />
      {/* Top Header & Live Daily Stats */}
      <HeaderStats
        db={db}
        onOpenTermuxGuide={() => setIsTermuxModalOpen(true)}
        serverConnected={serverConnected}
        onRefreshSync={handleManualRefreshSync}
        isSyncing={isSyncing}
      />

      {/* Main View Display */}
      <main className="flex-1 flex flex-col">
        {currentTab === 'kasir' && (
          <KasirView
            products={db.products}
            cart={cart}
            onAddToCart={handleAddToCart}
            onUpdateQuantity={handleUpdateQuantity}
            onRemoveFromCart={handleRemoveFromCart}
            onClearCart={handleClearCart}
            onOpenPayment={() => setIsPaymentModalOpen(true)}
          />
        )}

        {currentTab === 'produk' && (
          <ProductManager
            products={db.products}
            onSaveProduct={handleSaveProduct}
            onDeleteProduct={handleDeleteProduct}
            onClearAllProducts={handleClearAllProducts}
            onImportProducts={handleImportProducts}
          />
        )}

        {currentTab === 'kas' && (
          <CashFlowManager
            db={db}
            onAddCashEntry={handleAddCashEntry}
            onDeleteCashEntry={handleDeleteCashEntry}
            onResetAllHistory={handleResetAllHistory}
          />
        )}

        {currentTab === 'hutang' && (
          <DebtsManager
            db={db}
            onAddDebt={handleAddDebt}
            onPayDebt={handlePayDebt}
            onDeleteDebt={handleDeleteDebt}
          />
        )}

        {currentTab === 'suplier' && (
          <SuppliersManager
            db={db}
            onSaveSupplier={handleSaveSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onQuickExpenseForSupplier={handleQuickExpenseForSupplier}
          />
        )}
      </main>

      {/* Primary Mobile Navigation Bottom Bar */}
      <nav
        id="main-bottom-nav"
        className="fixed bottom-0 left-0 right-0 z-30 bg-stone-900 border-t border-stone-800 text-stone-400 select-none shadow-2xl"
      >
        <div className="max-w-xl mx-auto grid grid-cols-5 h-16">
          {/* Kasir / Kalkulator */}
          <button
            id="nav-tab-kasir"
            onClick={() => setCurrentTab('kasir')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${
              currentTab === 'kasir'
                ? 'text-emerald-400 font-bold bg-stone-950/60'
                : 'hover:text-stone-200'
            }`}
          >
            <div className="relative">
              <Calculator className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-emerald-500 text-stone-950 font-black text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                  {cart.reduce((s, i) => s + i.quantity, 0)}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">Kasir</span>
          </button>

          {/* Produk / Tabel Harga */}
          <button
            id="nav-tab-produk"
            onClick={() => setCurrentTab('produk')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${
              currentTab === 'produk'
                ? 'text-emerald-400 font-bold bg-stone-950/60'
                : 'hover:text-stone-200'
            }`}
          >
            <Package className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">Harga</span>
          </button>

          {/* Buku Kas */}
          <button
            id="nav-tab-kas"
            onClick={() => setCurrentTab('kas')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${
              currentTab === 'kas'
                ? 'text-emerald-400 font-bold bg-stone-950/60'
                : 'hover:text-stone-200'
            }`}
          >
            <Wallet className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">Buku Kas</span>
          </button>

          {/* Hutang / Bon */}
          <button
            id="nav-tab-hutang"
            onClick={() => setCurrentTab('hutang')}
            className={`flex flex-col items-center justify-center gap-1 transition-all relative ${
              currentTab === 'hutang'
                ? 'text-amber-400 font-bold bg-stone-950/60'
                : 'hover:text-stone-200'
            }`}
          >
            <div className="relative">
              <BookOpen className="w-5 h-5" />
              {unpaidDebtCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-amber-400 text-stone-950 font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
                  {unpaidDebtCount}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">Hutang</span>
          </button>

          {/* Suplier */}
          <button
            id="nav-tab-suplier"
            onClick={() => setCurrentTab('suplier')}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${
              currentTab === 'suplier'
                ? 'text-emerald-400 font-bold bg-stone-950/60'
                : 'hover:text-stone-200'
            }`}
          >
            <Truck className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">Suplier</span>
          </button>
        </div>
      </nav>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <PaymentModal
          cart={cart}
          db={db}
          onClose={() => setIsPaymentModalOpen(false)}
          onComplete={handleCompleteTransaction}
        />
      )}

      {/* Receipt Modal */}
      {activeReceipt && (
        <ReceiptModal
          transaction={activeReceipt}
          db={db}
          onClose={() => setActiveReceipt(null)}
        />
      )}

      {/* Termux & Database Backup Modal */}
      {isTermuxModalOpen && (
        <TermuxLocalModal
          db={db}
          onUpdateSettings={handleUpdateSettings}
          onRestoreDatabase={handleRestoreDatabase}
          onClose={() => setIsTermuxModalOpen(false)}
          serverConnected={serverConnected}
          onClearAllProducts={handleClearAllProducts}
          onResetAllHistory={handleResetAllHistory}
          onFactoryResetAll={handleFactoryResetAll}
          onImportProducts={handleImportProducts}
        />
      )}
    </div>
  );
}
