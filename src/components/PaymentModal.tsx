import { useState, useMemo } from 'react';
import { CartItem, Transaction, WarungDatabase } from '../types';
import { formatRupiah } from '../utils/storage';
import {
  X,
  Check,
  Banknote,
  BookOpen,
  AlertCircle,
  ArrowRight,
  User,
  Edit3,
  RotateCcw,
  Sparkles,
  Delete,
  WalletCards,
  Calendar,
  Phone,
  MessageSquare,
} from 'lucide-react';

interface PaymentModalProps {
  cart: CartItem[];
  db: WarungDatabase;
  onClose: () => void;
  onComplete: (trx: Transaction) => void;
}

export function PaymentModal({ cart, db, onClose, onComplete }: PaymentModalProps) {
  // Original cart total
  const totalCartAmount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.subtotal, 0);
  }, [cart]);

  // Kostum / Penyesuaian Total Belanja
  const [isCustomTotal, setIsCustomTotal] = useState(false);
  const [customTotalStr, setCustomTotalStr] = useState<string>(totalCartAmount.toString());

  const totalAmount = useMemo(() => {
    if (isCustomTotal) {
      const parsed = parseFloat(customTotalStr);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    return totalCartAmount;
  }, [isCustomTotal, customTotalStr, totalCartAmount]);

  // Payment type: 'cash' (tunai lunas), 'debt' (hutang penuh), 'partial_debt' (kostum DP + sisa hutang)
  const [paymentType, setPaymentType] = useState<'cash' | 'debt' | 'partial_debt'>('cash');
  const [cashGivenStr, setCashGivenStr] = useState<string>(totalAmount.toString());

  // Customer & Debt state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [debtDueDate, setDebtDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [notes, setNotes] = useState('');

  const cashGiven = parseFloat(cashGivenStr) || 0;
  const change = Math.max(0, cashGiven - totalAmount);
  const isShort = cashGiven < totalAmount && paymentType === 'cash';
  const shortage = Math.max(0, totalAmount - cashGiven);

  // Sisa hutang jika bayar sebagian (partial_debt)
  const remainingDebt = Math.max(0, totalAmount - cashGiven);

  // Suggested amounts with zeros for quick tap & insert
  const zeroSuggestions = useMemo(() => {
    const list: Array<{ label: string; value: number; badge?: string }> = [];

    // 1. Uang Pas
    list.push({ label: `Pas (${formatRupiah(totalAmount)})`, value: totalAmount, badge: 'Uang Pas' });

    // 2. Jika kasir sedang mengetik angka kecil (misal: 2, 5, 20, 35, 100)
    const rawDigits = cashGivenStr.replace(/\D/g, '');
    const currentNum = parseInt(rawDigits, 10);

    if (!isNaN(currentNum) && currentNum > 0 && currentNum < 1000) {
      const s2 = currentNum * 100; // 2 nol
      const s3 = currentNum * 1000; // 3 nol
      const s4 = currentNum * 10000; // 4 nol
      const s5 = currentNum * 100000; // 5 nol

      if (s2 >= 100 && s2 !== totalAmount) list.push({ label: formatRupiah(s2), value: s2, badge: '+00 (2 nol)' });
      if (s3 >= 1000 && s3 !== totalAmount) list.push({ label: formatRupiah(s3), value: s3, badge: '+000 (3 nol)' });
      if (s4 >= 10000 && s4 !== totalAmount) list.push({ label: formatRupiah(s4), value: s4, badge: '+0000 (4 nol)' });
      if (s5 >= 100000 && s5 !== totalAmount) list.push({ label: formatRupiah(s5), value: s5, badge: '+00000 (5 nol)' });
    }

    // 3. Pecahan umum pembulatan uang Indonesia di atas totalAmount
    const commonBills = [5000, 10000, 20000, 50000, 100000, 200000, 500000];
    for (const bill of commonBills) {
      if (bill > totalAmount && !list.some((item) => item.value === bill)) {
        list.push({ label: formatRupiah(bill), value: bill, badge: 'Pecahan' });
      }
      if (list.length >= 7) break;
    }

    return list;
  }, [totalAmount, cashGivenStr]);

  // Quick cash input handler
  const handleQuickCash = (amount: number) => {
    setCashGivenStr(amount.toString());
  };

  // Keypad press handler with support for 0, 00, 000, 0000, 00000
  const handleKeypadPress = (val: string) => {
    if (val === 'C') {
      setCashGivenStr('0');
    } else if (val === 'backspace') {
      setCashGivenStr((prev) => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    } else if (val === '0' || val === '00' || val === '000' || val === '0000' || val === '00000') {
      if (cashGivenStr === '0' || !cashGivenStr) {
        setCashGivenStr('0');
        return;
      }
      setCashGivenStr((prev) => prev + val);
    } else {
      setCashGivenStr((prev) => (prev === '0' ? val : prev + val));
    }
  };

  const handleFinish = () => {
    if ((paymentType === 'debt' || paymentType === 'partial_debt') && !customerName.trim()) {
      alert('Mohon isi Nama Pelanggan untuk catatan Hutang / Bon!');
      return;
    }

    const now = new Date();
    const dateCode = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomHex = Math.floor(100 + Math.random() * 900);
    const invoiceNumber = `WRG-${dateCode}-${randomHex}`;

    const itemsSummary = cart.map((c) => `${c.quantity}x ${c.product.name}`).join(', ');

    let paidAmount = 0;
    let actualPaymentType: 'cash' | 'debt' = 'cash';

    if (paymentType === 'cash') {
      paidAmount = cashGiven;
      actualPaymentType = 'cash';
    } else if (paymentType === 'debt') {
      paidAmount = 0;
      actualPaymentType = 'debt';
    } else if (paymentType === 'partial_debt') {
      paidAmount = Math.min(totalAmount, Math.max(0, cashGiven));
      actualPaymentType = 'debt';
    }

    let customNotes = notes.trim();
    if (paymentType === 'partial_debt') {
      const dpNote = `Bayar DP: ${formatRupiah(paidAmount)}, Sisa Hutang: ${formatRupiah(totalAmount - paidAmount)}`;
      customNotes = customNotes ? `${customNotes} (${dpNote})` : dpNote;
    } else if (!customNotes && paymentType === 'debt') {
      customNotes = itemsSummary;
    }

    const newTransaction: Transaction = {
      id: `trx-${Date.now()}`,
      invoiceNumber,
      timestamp: now.toISOString(),
      items: cart.map((c) => ({
        productId: c.product.id,
        name: c.product.name,
        price: c.product.price,
        costPrice: c.product.costPrice,
        quantity: c.quantity,
        unit: c.product.unit,
        subtotal: c.subtotal,
      })),
      totalAmount,
      cashGiven: paymentType === 'cash' ? cashGiven : paidAmount,
      change: paymentType === 'cash' ? change : 0,
      paymentType: actualPaymentType,
      customerName: customerName.trim() || (actualPaymentType === 'debt' ? 'Pelanggan Bon' : 'Pelanggan Umum'),
      customerPhone: customerPhone.trim() || undefined,
      debtDueDate: actualPaymentType === 'debt' ? debtDueDate : undefined,
      debtStatus: actualPaymentType === 'debt' ? (paidAmount > 0 ? 'partial' : 'unpaid') : undefined,
      debtPaidAmount: actualPaymentType === 'debt' ? paidAmount : 0,
      notes: customNotes || undefined,
    };

    onComplete(newTransaction);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-3 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="payment-modal-card"
        className="w-full max-w-lg bg-stone-900 text-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden border border-stone-800"
      >
        {/* Header */}
        <div className="px-4 py-3 bg-stone-950 border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-emerald-400">Kasir & Pembayaran</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-stone-800 text-stone-300">
              {cart.reduce((s, i) => s + i.quantity, 0)} barang
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-3.5">
          {/* Total Display with Customization Option */}
          <div className="bg-stone-950/90 p-3.5 rounded-2xl border border-stone-800 shadow-inner">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider font-bold text-stone-400">
                Total Pembayaran
              </span>
              <button
                type="button"
                id="btn-toggle-custom-total"
                onClick={() => {
                  if (!isCustomTotal) {
                    setCustomTotalStr(totalCartAmount.toString());
                  }
                  setIsCustomTotal(!isCustomTotal);
                }}
                className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
                  isCustomTotal
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isCustomTotal ? 'Batal Kostum' : 'Kostum Total / Diskon'}</span>
              </button>
            </div>

            {/* Main Total Number */}
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-3xl sm:text-4xl font-black text-amber-400 tracking-tight">
                {formatRupiah(totalAmount)}
              </span>
            </div>

            {/* Custom Total Editor Panel */}
            {isCustomTotal ? (
              <div className="mt-2.5 pt-2.5 border-t border-stone-800 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs text-stone-400">
                  <span>Total Belanja Normal:</span>
                  <span className="line-through text-stone-500 font-semibold">
                    {formatRupiah(totalCartAmount)}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-stone-400 font-bold">Rp</span>
                  <input
                    type="number"
                    value={customTotalStr}
                    onChange={(e) => setCustomTotalStr(e.target.value)}
                    placeholder="Ketik total baru..."
                    className="w-full bg-stone-900 border border-amber-500/60 rounded-xl pl-10 pr-3 py-2 text-base font-bold text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setCustomTotalStr(totalCartAmount.toString())}
                    className="text-[11px] px-2 py-1 rounded-md bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Normal</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const rounded = Math.floor(totalCartAmount / 1000) * 1000;
                      setCustomTotalStr(rounded.toString());
                    }}
                    className="text-[11px] px-2 py-1 rounded-md bg-stone-800 hover:bg-stone-700 text-amber-300"
                  >
                    Bulatkan Ribuan ({formatRupiah(Math.floor(totalCartAmount / 1000) * 1000)})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const rounded = Math.floor(totalCartAmount / 500) * 500;
                      setCustomTotalStr(rounded.toString());
                    }}
                    className="text-[11px] px-2 py-1 rounded-md bg-stone-800 hover:bg-stone-700 text-stone-300"
                  >
                    Bulatkan 500
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Payment Type Switcher: Tunai vs Bayar Sebagian (Kostum DP) vs Hutang Penuh */}
          <div>
            <div className="text-[11px] text-stone-400 font-medium mb-1.5">
              Pilih Metode / Mode Pembayaran:
            </div>
            <div className="grid grid-cols-3 gap-1.5 bg-stone-950 p-1.5 rounded-xl border border-stone-800">
              <button
                id="btn-pay-cash"
                type="button"
                onClick={() => {
                  setPaymentType('cash');
                  setCashGivenStr(totalAmount.toString());
                }}
                className={`py-2 px-1.5 rounded-lg text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
                  paymentType === 'cash'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <Banknote className="w-4 h-4 shrink-0" />
                <span className="text-center">Tunai Lunas</span>
              </button>

              <button
                id="btn-pay-partial-debt"
                type="button"
                onClick={() => {
                  setPaymentType('partial_debt');
                  setCashGivenStr('0');
                }}
                className={`py-2 px-1.5 rounded-lg text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
                  paymentType === 'partial_debt'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <WalletCards className="w-4 h-4 shrink-0" />
                <span className="text-center">Bayar DP + Bon</span>
              </button>

              <button
                id="btn-pay-debt"
                type="button"
                onClick={() => {
                  setPaymentType('debt');
                  setCashGivenStr('0');
                }}
                className={`py-2 px-1.5 rounded-lg text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all ${
                  paymentType === 'debt'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                <BookOpen className="w-4 h-4 shrink-0" />
                <span className="text-center">Hutang Penuh</span>
              </button>
            </div>
          </div>

          {/* Conditional Sections based on Payment Type */}
          {paymentType === 'cash' || paymentType === 'partial_debt' ? (
            <div className="space-y-3">
              {/* Uang Diterima Input */}
              <div>
                <label className="text-xs text-stone-300 font-medium mb-1 flex items-center justify-between">
                  <span>
                    {paymentType === 'cash'
                      ? 'Pecahan Uang Tunai Diterima (Rp):'
                      : 'Uang Muka / DP Tunai Dibayar Sekarang (Rp):'}
                  </span>
                  {cashGiven > 0 && (
                    <span className="text-emerald-400 font-bold">
                      {formatRupiah(cashGiven)}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    id="input-cash-given"
                    type="number"
                    value={cashGivenStr}
                    onChange={(e) => setCashGivenStr(e.target.value)}
                    className={`w-full bg-stone-950 border rounded-xl px-4 py-2.5 text-2xl font-black text-white text-right focus:outline-none ${
                      paymentType === 'cash'
                        ? 'border-stone-700 focus:border-emerald-500'
                        : 'border-amber-700 focus:border-amber-500'
                    }`}
                    placeholder="0"
                  />
                  <span className="absolute left-3 top-3 text-sm text-stone-400 font-bold">Rp</span>
                </div>
              </div>

              {/* Saran Jumlah 0 & Cepat: TAP MAKA MASUKKAN */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-stone-400 font-medium mb-1.5">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Saran Jumlah Uang (Tap untuk Masukkan):</span>
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {zeroSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickCash(sug.value)}
                      className={`py-1.5 px-2.5 rounded-lg text-xs font-bold border transition-all active:scale-95 flex items-center gap-1.5 ${
                        cashGiven === sug.value
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-xs'
                          : 'bg-stone-800 hover:bg-stone-700 border-stone-700 text-stone-200'
                      }`}
                    >
                      <span>{sug.label}</span>
                      {sug.badge && (
                        <span className="text-[10px] px-1 py-0.2 rounded bg-stone-900 text-amber-300 font-normal">
                          {sug.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Display: Kembalian vs Uang Kurang vs Sisa Hutang */}
              {paymentType === 'cash' ? (
                isShort ? (
                  <div className="bg-rose-950/70 border border-rose-700 p-3 rounded-xl flex items-center justify-between text-rose-200 text-xs animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                      <div>
                        <div className="font-bold text-rose-100">Uang Kurang: {formatRupiah(shortage)}</div>
                        <div className="text-[11px] text-rose-300">Kurang dari total belanja</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaymentType('partial_debt')}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-800 hover:bg-rose-700 text-white font-bold text-[11px]"
                    >
                      Jadikan Bon
                    </button>
                  </div>
                ) : (
                  <div className="bg-emerald-950/80 border border-emerald-600/70 p-3 rounded-xl flex items-center justify-between animate-in fade-in">
                    <div className="text-emerald-200 text-xs">
                      <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-300">
                        Harus Kembalian:
                      </div>
                      <div className="text-2xl font-black text-lime-300 tracking-tight">
                        {formatRupiah(change)}
                      </div>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-emerald-800/80 flex items-center justify-center text-lime-300">
                      <Check className="w-5 h-5" />
                    </div>
                  </div>
                )
              ) : (
                /* Mode Partial Debt: Tampilkan DP & Sisa Bon */
                <div className="bg-amber-950/60 border border-amber-700/80 p-3 rounded-xl space-y-1.5 text-xs text-amber-200">
                  <div className="flex justify-between items-center">
                    <span className="text-stone-300">Total Belanja:</span>
                    <span className="font-bold text-white">{formatRupiah(totalAmount)}</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-300">
                    <span>Uang Muka (DP Tunai):</span>
                    <span className="font-bold">{formatRupiah(cashGiven)}</span>
                  </div>
                  <div className="border-t border-amber-800/60 pt-1.5 flex justify-between items-center font-bold text-sm">
                    <span className="text-amber-300">Sisa Dicatat Hutang:</span>
                    <span className="text-amber-400 text-base">{formatRupiah(remainingDebt)}</span>
                  </div>
                </div>
              )}

              {/* Tombol 0 dari 2 sampai 5 dan Keypad Angka */}
              <div className="space-y-1.5 pt-1">
                {/* Dedicated Multi-Zero Button Row: 0, 00, 000, 0000, 00000 */}
                <div>
                  <div className="text-[11px] text-stone-400 font-medium mb-1">
                    Tombol Cepat Nol (Tap untuk Tambah Nol):
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { val: '0', label: '0', sub: '1 nol' },
                      { val: '00', label: '00', sub: '2 nol' },
                      { val: '000', label: '000', sub: '3 nol' },
                      { val: '0000', label: '0000', sub: '4 nol' },
                      { val: '00000', label: '00000', sub: '5 nol' },
                    ].map((item) => (
                      <button
                        key={item.val}
                        id={`btn-zero-${item.val}`}
                        type="button"
                        onClick={() => handleKeypadPress(item.val)}
                        className="py-2 px-1 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 active:bg-amber-600 border border-amber-700/50 hover:border-amber-500 text-amber-200 active:text-white font-black text-sm flex flex-col items-center justify-center transition-all active:scale-95 shadow-xs"
                      >
                        <span>{item.label}</span>
                        <span className="text-[9px] font-normal text-amber-300/80">{item.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main Numeric Keypad (1-9, C, Backspace, Uang Pas) */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {['1', '2', '3'].map((btn) => (
                    <button
                      key={btn}
                      type="button"
                      onClick={() => handleKeypadPress(btn)}
                      className="py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 active:bg-emerald-600 text-stone-100 font-bold text-base transition-all"
                    >
                      {btn}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('backspace')}
                    title="Hapus Satu Karakter"
                    className="py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 active:bg-rose-600 text-stone-300 font-bold text-sm flex items-center justify-center transition-all"
                  >
                    <Delete className="w-5 h-5" />
                  </button>

                  {['4', '5', '6'].map((btn) => (
                    <button
                      key={btn}
                      type="button"
                      onClick={() => handleKeypadPress(btn)}
                      className="py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 active:bg-emerald-600 text-stone-100 font-bold text-base transition-all"
                    >
                      {btn}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('C')}
                    title="Reset Nol"
                    className="py-2.5 rounded-xl bg-rose-950/50 hover:bg-rose-900/60 active:bg-rose-700 border border-rose-800/40 text-rose-300 font-bold text-sm transition-all"
                  >
                    C (Clear)
                  </button>

                  {['7', '8', '9'].map((btn) => (
                    <button
                      key={btn}
                      type="button"
                      onClick={() => handleKeypadPress(btn)}
                      className="py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 active:bg-emerald-600 text-stone-100 font-bold text-base transition-all"
                    >
                      {btn}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCashGivenStr(totalAmount.toString())}
                    title="Masukkan Uang Pas"
                    className="py-2.5 rounded-xl bg-emerald-950/60 hover:bg-emerald-900/80 active:bg-emerald-600 border border-emerald-700/50 text-emerald-300 font-bold text-xs flex items-center justify-center transition-all"
                  >
                    Uang Pas
                  </button>
                </div>
              </div>

              {/* If partial debt, also display customer info input */}
              {paymentType === 'partial_debt' && (
                <div className="space-y-2.5 bg-stone-950 p-3 rounded-2xl border border-stone-800 animate-in fade-in">
                  <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <User className="w-4 h-4" />
                    <span>Identitas Pelanggan Bon:</span>
                  </div>

                  <div>
                    <label className="text-[11px] text-stone-300 font-medium mb-1 block">
                      Nama Pelanggan <span className="text-rose-400 font-bold">*Wajib</span>:
                    </label>
                    <input
                      id="input-partial-debt-customer-name"
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Contoh: Pak RT / Bu Siti"
                      className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-stone-400 font-medium mb-1 block">
                        No. HP / WA:
                      </label>
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="08xxxxxxxxxx"
                        className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-stone-400 font-medium mb-1 block">
                        Jatuh Tempo:
                      </label>
                      <input
                        type="date"
                        value={debtDueDate}
                        onChange={(e) => setDebtDueDate(e.target.value)}
                        className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Mode Hutang Penuh (Bon 100%) */
            <div className="space-y-3 bg-stone-950/80 p-3.5 rounded-2xl border border-stone-800 animate-in fade-in">
              <div>
                <label className="text-xs text-stone-300 font-medium mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Nama Pelanggan <span className="text-rose-400 font-bold">*Wajib</span>:
                  </span>
                </label>
                <input
                  id="input-debt-customer-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Contoh: Bu Siti / Mas Dani Tetangga"
                  className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-stone-300 font-medium mb-1 block">
                    No. WhatsApp / HP:
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="081234567xxx"
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-300 font-medium mb-1 block">
                    Jatuh Tempo Janji Bayar:
                  </label>
                  <input
                    type="date"
                    value={debtDueDate}
                    onChange={(e) => setDebtDueDate(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-300 font-medium mb-1 block">
                  Catatan Tambahan (Opsional):
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Janji bayar pas gajian suaminya"
                  className="w-full bg-stone-900 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="p-2.5 bg-amber-950/40 rounded-xl border border-amber-800/50 text-[11px] text-amber-200">
                Total bon senilai <b>{formatRupiah(totalAmount)}</b> akan otomatis tercatat ke buku kasbon & hutang pelanggan, dan dapat dicicil sewaktu-waktu.
              </div>
            </div>
          )}
        </div>

        {/* Bottom Action Button */}
        <div className="p-3 bg-stone-950 border-t border-stone-800">
          <button
            id="btn-complete-payment"
            type="button"
            disabled={isShort}
            onClick={handleFinish}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
              isShort
                ? 'bg-stone-800 text-stone-500 cursor-not-allowed'
                : paymentType === 'cash'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 active:scale-98'
                : paymentType === 'partial_debt'
                ? 'bg-amber-500 hover:bg-amber-400 text-stone-950 active:scale-98'
                : 'bg-rose-500 hover:bg-rose-400 text-stone-950 active:scale-98'
            }`}
          >
            <span>
              {paymentType === 'cash'
                ? `Simpan Transaksi Tunai (${formatRupiah(totalAmount)})`
                : paymentType === 'partial_debt'
                ? `Simpan Bon Sebagian (DP ${formatRupiah(cashGiven)}, Sisa ${formatRupiah(remainingDebt)})`
                : `Simpan Bon Hutang Penuh (${formatRupiah(totalAmount)})`}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
