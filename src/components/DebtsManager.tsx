import { useState, useMemo } from 'react';
import { DebtItem, DebtPayment, WarungDatabase } from '../types';
import { formatRupiah } from '../utils/storage';
import {
  BookOpen,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  MessageCircle,
  DollarSign,
  User,
  Trash2,
  X,
  Calendar,
} from 'lucide-react';

interface DebtsManagerProps {
  db: WarungDatabase;
  onAddDebt: (debt: DebtItem) => void;
  onPayDebt: (debtId: string, payment: DebtPayment) => void;
  onDeleteDebt: (debtId: string) => void;
}

export function DebtsManager({
  db,
  onAddDebt,
  onPayDebt,
  onDeleteDebt,
}: DebtsManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'paid'>('unpaid');

  // Modal Pay Debt State
  const [payingDebt, setPayingDebt] = useState<DebtItem | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');

  // Modal Add Manual Debt
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [itemsSummary, setItemsSummary] = useState('');
  const [notes, setNotes] = useState('');

  // Calculations
  const totalHutangBelumLunas = useMemo(() => {
    return db.debts
      .filter((d) => d.status !== 'paid')
      .reduce((sum, d) => sum + (d.amount - d.paidAmount), 0);
  }, [db.debts]);

  const filteredDebts = useMemo(() => {
    return db.debts.filter((d) => {
      const matchSearch =
        d.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.customerPhone && d.customerPhone.includes(searchQuery)) ||
        (d.itemsSummary && d.itemsSummary.toLowerCase().includes(searchQuery.toLowerCase()));

      let matchStatus = true;
      if (filterStatus === 'unpaid') matchStatus = d.status !== 'paid';
      if (filterStatus === 'paid') matchStatus = d.status === 'paid';

      return matchSearch && matchStatus;
    });
  }, [db.debts, searchQuery, filterStatus]);

  const handleOpenPayModal = (debt: DebtItem) => {
    setPayingDebt(debt);
    const sisa = debt.amount - debt.paidAmount;
    setPayAmount(sisa.toString());
    setPayNote('Cicilan / Pelunasan bon warung');
  };

  const handleExecutePayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingDebt) return;
    const amountNum = parseFloat(payAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Masukkan nominal pembayaran dengan benar');
      return;
    }

    const sisa = payingDebt.amount - payingDebt.paidAmount;
    if (amountNum > sisa) {
      alert(`Pembayaran maksimal sebesar sisa hutang: ${formatRupiah(sisa)}`);
      return;
    }

    const payment: DebtPayment = {
      id: `pay-${Date.now()}`,
      date: new Date().toISOString(),
      amount: amountNum,
      note: payNote.trim(),
    };

    onPayDebt(payingDebt.id, payment);
    setPayingDebt(null);
  };

  const handleSendReminderWA = (debt: DebtItem) => {
    const sisa = debt.amount - debt.paidAmount;
    const cleanPhone = debt.customerPhone ? debt.customerPhone.replace(/\D/g, '') : '';
    const waNumber = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;

    const message = `Halo Bpk/Ibu ${debt.customerName},\n\nSalam dari *${db.settings.storeName}*.\nKami menginfokan sisa bon/kasbon warung sebesar *${formatRupiah(sisa)}*.\n${debt.itemsSummary ? `(Rincian: ${debt.itemsSummary})\n` : ''}${debt.dueDate ? `Jatuh tempo: ${debt.dueDate}\n` : ''}\nTerima kasih banyak atas kerjasamanya 🙏`;

    const encoded = encodeURIComponent(message);
    if (waNumber) {
      window.open(`https://wa.me/${waNumber}?text=${encoded}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    }
  };

  const handleCreateManualDebt = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(debtAmount);
    if (!customerName.trim() || isNaN(amountNum) || amountNum <= 0) {
      alert('Nama pelanggan dan total nominal hutang harus diisi');
      return;
    }

    const newDebt: DebtItem = {
      id: `debt-${Date.now()}`,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || undefined,
      amount: amountNum,
      paidAmount: 0,
      status: 'unpaid',
      createdAt: new Date().toISOString(),
      dueDate: dueDate || undefined,
      itemsSummary: itemsSummary.trim() || 'Barang warung',
      notes: notes.trim(),
      payments: [],
    };

    onAddDebt(newDebt);
    setAddModalOpen(false);
    setCustomerName('');
    setCustomerPhone('');
    setDebtAmount('');
    setItemsSummary('');
    setNotes('');
  };

  return (
    <div className="flex flex-col flex-1 p-3 pb-24 space-y-3">
      {/* Header Summary */}
      <div className="bg-amber-900 text-amber-100 p-4 rounded-2xl shadow-xs border border-amber-800 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-amber-300 font-semibold mb-1">
            <BookOpen className="w-4 h-4" />
            <span>Buku Kasbon & Hutang Warung</span>
          </div>
          <div className="text-2xl font-black text-amber-300 tracking-tight">
            {formatRupiah(totalHutangBelumLunas)}
          </div>
          <div className="text-[11px] text-amber-200 mt-0.5">
            Total piutang yang belum dilunasi pelanggan
          </div>
        </div>

        <button
          id="btn-tambah-hutang-manual"
          onClick={() => setAddModalOpen(true)}
          className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>+ Catat Bon</span>
        </button>
      </div>

      {/* Search and Status Filters */}
      <div className="bg-white p-3 rounded-2xl border border-stone-200 shadow-xs space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama penghutang / no telepon..."
            className="w-full bg-stone-50 border border-stone-300 rounded-xl pl-9 pr-3 py-2 text-sm text-stone-800 placeholder-stone-400 focus:outline-none focus:border-amber-600"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {[
            { id: 'unpaid', label: 'Belum Lunas' },
            { id: 'paid', label: 'Sudah Lunas' },
            { id: 'all', label: 'Semua Riwayat' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                filterStatus === tab.id
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Debts List */}
      <div className="space-y-2.5">
        {filteredDebts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-500 text-xs">
            Tidak ada data catatan kasbon / hutang
          </div>
        ) : (
          filteredDebts.map((debt) => {
            const sisa = debt.amount - debt.paidAmount;
            const isLunas = debt.status === 'paid' || sisa <= 0;

            return (
              <div
                key={debt.id}
                id={`debt-card-${debt.id}`}
                className={`bg-white rounded-2xl border p-3.5 shadow-xs transition-all ${
                  isLunas
                    ? 'border-stone-200 opacity-75'
                    : 'border-amber-200 ring-1 ring-amber-400/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-stone-900">{debt.customerName}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isLunas
                            ? 'bg-emerald-100 text-emerald-800'
                            : debt.paidAmount > 0
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isLunas ? 'Lunas' : debt.paidAmount > 0 ? 'Dicicil' : 'Belum Dibayar'}
                      </span>
                    </div>

                    {debt.customerPhone && (
                      <div className="text-xs text-stone-500 mt-0.5">WA: {debt.customerPhone}</div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs text-stone-400">Sisa Bon:</div>
                    <div
                      className={`text-base font-extrabold ${
                        isLunas ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {formatRupiah(sisa)}
                    </div>
                  </div>
                </div>

                {/* Items & Dates */}
                <div className="bg-stone-50 p-2 rounded-xl text-xs space-y-1 text-stone-600 mb-2.5">
                  {debt.itemsSummary && (
                    <div>
                      <span className="font-semibold text-stone-700">Barang: </span>
                      <span>{debt.itemsSummary}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap justify-between gap-1 text-[11px] text-stone-400 pt-0.5 border-t border-stone-200/50">
                    <span>Tgl Bon: {debt.createdAt.slice(0, 10)}</span>
                    {debt.dueDate && (
                      <span className="text-amber-800 font-medium">Jatuh Tempo: {debt.dueDate}</span>
                    )}
                  </div>

                  {debt.notes && (
                    <div className="text-[11px] text-stone-500 italic">"{debt.notes}"</div>
                  )}

                  {debt.paidAmount > 0 && (
                    <div className="text-[11px] text-emerald-700 font-semibold">
                      Total Bon: {formatRupiah(debt.amount)} | Sudah Dibayar:{' '}
                      {formatRupiah(debt.paidAmount)}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleSendReminderWA(debt)}
                      className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs flex items-center gap-1 active:scale-95"
                      title="Kirim Pesan WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Ingatkan WA</span>
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Hapus catatan bon "${debt.customerName}"?`)) {
                          onDeleteDebt(debt.id);
                        }
                      }}
                      className="p-1.5 text-stone-300 hover:text-rose-600 rounded-lg"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {!isLunas && (
                    <button
                      onClick={() => handleOpenPayModal(debt)}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Bayar / Cicil</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Pay Debt */}
      {payingDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs">
          <form
            onSubmit={handleExecutePayment}
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 bg-amber-800 text-white flex items-center justify-between">
              <span className="font-bold text-sm">
                Bayar Bon: {payingDebt.customerName}
              </span>
              <button
                type="button"
                onClick={() => setPayingDebt(null)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-center">
                <div className="text-xs text-amber-800 font-semibold">Sisa Bon yang Harus Dibayar:</div>
                <div className="text-2xl font-black text-amber-900 mt-0.5">
                  {formatRupiah(payingDebt.amount - payingDebt.paidAmount)}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Nominal Pembayaran Diterima (Rp):
                </label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-lg font-bold text-emerald-800 focus:outline-none focus:border-emerald-600"
                  required
                  autoFocus
                />
              </div>

              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setPayAmount((payingDebt.amount - payingDebt.paidAmount).toString())}
                  className="flex-1 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold rounded-lg"
                >
                  Lunasi Penuh
                </button>
                <button
                  type="button"
                  onClick={() => setPayAmount('10000')}
                  className="py-1.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg"
                >
                  10rb
                </button>
                <button
                  type="button"
                  onClick={() => setPayAmount('20000')}
                  className="py-1.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg"
                >
                  20rb
                </button>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Catatan Pembayaran:
                </label>
                <input
                  type="text"
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="Misal: Dititipkan anaknya"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800"
                />
              </div>

              <div className="text-[11px] text-stone-500 italic">
                *Pembayaran ini otomatis tercatat ke <b>Uang Masuk Hari Ini</b> di buku kas.
              </div>
            </div>

            <div className="p-3 bg-stone-50 border-t border-stone-200 flex gap-2">
              <button
                type="button"
                onClick={() => setPayingDebt(null)}
                className="flex-1 py-2.5 rounded-xl bg-stone-200 text-stone-700 font-semibold text-xs"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md"
              >
                Simpan Pembayaran
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Add Manual Debt */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs">
          <form
            onSubmit={handleCreateManualDebt}
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="px-4 py-3 bg-stone-900 text-white flex items-center justify-between">
              <span className="font-bold text-sm">Catat Hutang / Bon Baru</span>
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="text-white/80 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Nama Pelanggan:
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Misal: Bu RT 03"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-500"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Nominal Bon (Rp):
                </label>
                <input
                  type="number"
                  value={debtAmount}
                  onChange={(e) => setDebtAmount(e.target.value)}
                  placeholder="35000"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-base font-bold text-amber-900 focus:outline-none focus:border-stone-500"
                  required
                  min="1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    No. WhatsApp:
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="w-full border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    Jatuh Tempo:
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full border border-stone-300 rounded-xl px-2.5 py-1.5 text-xs text-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Rincian Barang yang Diambil:
                </label>
                <input
                  type="text"
                  value={itemsSummary}
                  onChange={(e) => setItemsSummary(e.target.value)}
                  placeholder="Misal: 1kg beras, 1 minyak bimoli"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Catatan:
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Janji bayar tgl 25"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800"
                />
              </div>
            </div>

            <div className="p-3 bg-stone-50 border-t border-stone-200 flex gap-2">
              <button
                type="button"
                onClick={() => setAddModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-stone-200 text-stone-700 font-semibold text-xs"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
              >
                Simpan Bon
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
