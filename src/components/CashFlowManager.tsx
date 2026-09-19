import { useState, useMemo } from 'react';
import { CashEntry, Supplier, WarungDatabase } from '../types';
import { formatRupiah } from '../utils/storage';
import { CashFlowChart } from './CashFlowChart';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  DollarSign,
  Calendar,
  X,
  Truck,
  Trash2,
} from 'lucide-react';

interface CashFlowManagerProps {
  db: WarungDatabase;
  onAddCashEntry: (entry: CashEntry) => void;
  onDeleteCashEntry: (id: string) => void;
  onResetAllHistory?: () => void;
}

export function CashFlowManager({
  db,
  onAddCashEntry,
  onDeleteCashEntry,
  onResetAllHistory,
}: CashFlowManagerProps) {
  const [filterPeriod, setFilterPeriod] = useState<'today' | 'yesterday' | 'week' | 'all'>('today');

  // Modal State
  const [modalType, setModalType] = useState<'out' | 'in' | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterdayDate = new Date(Date.now() - 86400000);
  const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);
  const sevenDaysAgoDate = new Date(Date.now() - 7 * 86400000);
  const sevenDaysAgoStr = sevenDaysAgoDate.toISOString().slice(0, 10);

  // Helper date filter
  const isDateInPeriod = (dateStr: string) => {
    const day = dateStr.slice(0, 10);
    if (filterPeriod === 'today') return day === todayStr;
    if (filterPeriod === 'yesterday') return day === yesterdayStr;
    if (filterPeriod === 'week') return day >= sevenDaysAgoStr;
    return true; // 'all'
  };

  // 1. Transactions in period (Kasir Tunai)
  const periodCashTransactions = useMemo(() => {
    return db.transactions.filter(
      (t) => t.paymentType === 'cash' && isDateInPeriod(t.timestamp)
    );
  }, [db.transactions, filterPeriod]);

  const totalPenjualanKasir = periodCashTransactions.reduce((s, t) => s + t.totalAmount, 0);

  // 2. Debt repayments in period
  const periodDebtPayments = useMemo(() => {
    const list: Array<{ date: string; amount: number; customerName: string }> = [];
    db.debts.forEach((debt) => {
      (debt.payments || []).forEach((p) => {
        if (isDateInPeriod(p.date)) {
          list.push({ date: p.date, amount: p.amount, customerName: debt.customerName });
        }
      });
    });
    return list;
  }, [db.debts, filterPeriod]);

  const totalPelunasanHutang = periodDebtPayments.reduce((s, p) => s + p.amount, 0);

  // 3. Manual Cash Entries in period
  const periodManualEntries = useMemo(() => {
    return db.cashEntries.filter((c) => isDateInPeriod(c.timestamp));
  }, [db.cashEntries, filterPeriod]);

  const totalManualIn = periodManualEntries
    .filter((c) => c.type === 'in')
    .reduce((s, c) => s + c.amount, 0);

  const totalUangKeluar = periodManualEntries
    .filter((c) => c.type === 'out')
    .reduce((s, c) => s + c.amount, 0);

  const totalUangMasuk = totalPenjualanKasir + totalPelunasanHutang + totalManualIn;
  const saldoBersih = totalUangMasuk - totalUangKeluar;

  const handleOpenModal = (type: 'out' | 'in') => {
    setModalType(type);
    setAmount('');
    setCategory(type === 'out' ? 'Kulakan / Suplier' : 'Modal Awal Kas');
    setDescription('');
    setSelectedSupplierId('');
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Masukkan nominal uang dengan benar');
      return;
    }

    let supName: string | undefined;
    if (selectedSupplierId) {
      const found = db.suppliers.find((s) => s.id === selectedSupplierId);
      if (found) supName = found.name;
    }

    const newEntry: CashEntry = {
      id: `cash-${Date.now()}`,
      type: modalType!,
      amount: amountNum,
      category: category.trim() || (modalType === 'out' ? 'Pengeluaran Lain' : 'Pemasukan Lain'),
      description: description.trim(),
      supplierId: selectedSupplierId || undefined,
      supplierName: supName,
      timestamp: new Date().toISOString(),
    };

    onAddCashEntry(newEntry);
    setModalType(null);
  };

  return (
    <div className="flex flex-col flex-1 p-3 pb-24 space-y-3">
      {/* Visual Chart for Masuk, Keluar, Laci, Bon (Bisa diatur Jam, Bulan, Tahun) */}
      <CashFlowChart db={db} />

      {/* Quick Action Buttons: + Catat Uang Keluar / + Catat Uang Masuk */}
      <div className="grid grid-cols-2 gap-2">
        <button
          id="btn-catat-uang-keluar"
          onClick={() => handleOpenModal('out')}
          className="p-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-98 transition-all"
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>+ Catat Uang Keluar / Kulakan</span>
        </button>

        <button
          id="btn-catat-uang-masuk"
          onClick={() => handleOpenModal('in')}
          className="p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-98 transition-all"
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>+ Catat Pemasukan Kas Lain</span>
        </button>
      </div>

      {/* Period Filter for Itemized Log */}
      <div className="bg-white p-2.5 rounded-2xl border border-stone-200 shadow-xs flex items-center justify-between gap-1 overflow-x-auto">
        <span className="text-xs font-bold text-stone-500 pl-1">Rincian Riwayat:</span>
        <div className="flex items-center gap-1">
          {[
            { id: 'today', label: 'Hari Ini' },
            { id: 'yesterday', label: 'Kemarin' },
            { id: 'week', label: '7 Hari' },
            { id: 'all', label: 'Semua' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterPeriod(item.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterPeriod === item.id
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* History List */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
          <span className="font-bold text-xs text-stone-700 uppercase tracking-wider">
            Rincian Arus Kas ({periodManualEntries.length + periodCashTransactions.length} Aktivitas)
          </span>
          {onResetAllHistory && (
            <button
              id="btn-reset-history-cashflow"
              onClick={onResetAllHistory}
              className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 active:scale-95 transition-all"
              title="Reset seluruh riwayat kas dan transaksi"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Riwayat</span>
            </button>
          )}
        </div>

        <div className="divide-y divide-stone-100 max-h-[60vh] overflow-y-auto">
          {/* Combine and sort manual cash entries and sales transactions */}
          {[
            ...periodManualEntries.map((m) => ({
              id: m.id,
              type: m.type,
              title: m.category,
              subtitle: m.description || (m.supplierName ? `Suplier: ${m.supplierName}` : ''),
              amount: m.amount,
              timestamp: m.timestamp,
              isManual: true,
            })),
            ...periodCashTransactions.map((t) => ({
              id: t.id,
              type: 'in' as const,
              title: `Kasir: ${t.invoiceNumber}`,
              subtitle: t.customerName || `${t.items.length} macam barang`,
              amount: t.totalAmount,
              timestamp: t.timestamp,
              isManual: false,
            })),
            ...periodDebtPayments.map((p, idx) => ({
              id: `debt-pay-${idx}`,
              type: 'in' as const,
              title: `Pelunasan Bon: ${p.customerName}`,
              subtitle: 'Pembayaran hutang pelanggan',
              amount: p.amount,
              timestamp: p.date,
              isManual: false,
            })),
          ]
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .map((entry) => (
              <div
                key={entry.id}
                className="p-3 flex items-center justify-between hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      entry.type === 'in'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {entry.type === 'in' ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs sm:text-sm text-stone-900 truncate">
                      {entry.title}
                    </div>
                    <div className="text-[11px] text-stone-500 truncate">{entry.subtitle}</div>
                    <div className="text-[10px] text-stone-400">
                      {new Date(entry.timestamp).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      - {entry.timestamp.slice(0, 10)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div
                    className={`font-black text-sm text-right ${
                      entry.type === 'in' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {entry.type === 'in' ? '+' : '-'} {formatRupiah(entry.amount)}
                  </div>

                  {entry.isManual && (
                    <button
                      onClick={() => {
                        if (confirm('Hapus catatan arus kas ini?')) {
                          onDeleteCashEntry(entry.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-stone-300 hover:text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Modal Add Cash Entry (In or Out) */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs">
          <form
            onSubmit={handleFormSubmit}
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div
              className={`px-4 py-3 text-white flex items-center justify-between ${
                modalType === 'out' ? 'bg-rose-700' : 'bg-emerald-700'
              }`}
            >
              <span className="font-bold text-sm">
                {modalType === 'out'
                  ? 'Catat Uang Keluar / Kulakan'
                  : 'Catat Uang Masuk Kas Lain'}
              </span>
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Nominal Uang (Rp):
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="50000"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-lg font-bold text-stone-900 focus:outline-none focus:border-stone-500"
                  required
                  autoFocus
                  min="1"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Kategori:
                </label>
                <input
                  type="text"
                  list="cash-categories"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Kulakan / Suplier / Listrik"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800"
                  required
                />
                <datalist id="cash-categories">
                  {modalType === 'out' ? (
                    <>
                      <option value="Kulakan / Suplier" />
                      <option value="Beli Stok Gas & Galon" />
                      <option value="Listrik & Pulsa Warung" />
                      <option value="Gaji / Uang Makan" />
                      <option value="Transportasi & Bensin" />
                      <option value="Kantong Plastik & Perlengkapan" />
                    </>
                  ) : (
                    <>
                      <option value="Modal Awal Kasir" />
                      <option value="Pemasukan Non-Barang" />
                      <option value="Titipan Penjual Kue" />
                      <option value="Lain-lain" />
                    </>
                  )}
                </datalist>
              </div>

              {modalType === 'out' && db.suppliers.length > 0 && (
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-stone-500" />
                    Pilih Suplier (Opsional):
                  </label>
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => setSelectedSupplierId(e.target.value)}
                    className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800 bg-white"
                  >
                    <option value="">-- Bukan dari Suplier Terdaftar --</option>
                    {db.suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.goodsSupplied || 'Grosir'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Keterangan / Rincian:
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Misal: Beli 2 dus Indomie dan 1 bal rokok"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800"
                />
              </div>
            </div>

            <div className="p-3 bg-stone-50 border-t border-stone-200 flex gap-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="flex-1 py-2 rounded-xl bg-stone-200 text-stone-700 font-semibold text-xs"
              >
                Batal
              </button>
              <button
                type="submit"
                className={`flex-1 py-2 rounded-xl text-white font-bold text-xs ${
                  modalType === 'out'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                Simpan Catatan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
