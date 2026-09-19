import { useState } from 'react';
import { Transaction, WarungDatabase } from '../types';
import { formatRupiah } from '../utils/storage';
import { Check, Copy, Printer, Share2, X, ShoppingBag } from 'lucide-react';

interface ReceiptModalProps {
  transaction: Transaction;
  db: WarungDatabase;
  onClose: () => void;
}

export function ReceiptModal({ transaction, db, onClose }: ReceiptModalProps) {
  const [copied, setCopied] = useState(false);

  const formattedDate = new Date(transaction.timestamp).toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const generateReceiptText = () => {
    let text = `*${db.settings.storeName.toUpperCase()}*\n`;
    if (db.settings.storeAddress) text += `${db.settings.storeAddress}\n`;
    if (db.settings.storePhone) text += `Telp/WA: ${db.settings.storePhone}\n`;
    text += `================================\n`;
    text += `No. Struk : ${transaction.invoiceNumber}\n`;
    text += `Waktu     : ${formattedDate}\n`;
    if (transaction.customerName) {
      text += `Pelanggan : ${transaction.customerName}\n`;
    }
    text += `--------------------------------\n`;
    transaction.items.forEach((item, idx) => {
      text += `${idx + 1}. ${item.name}\n`;
      text += `   ${item.quantity} ${item.unit || 'pcs'} x ${formatRupiah(item.price)} = ${formatRupiah(item.subtotal)}\n`;
    });
    if (transaction.otherFees && transaction.otherFees.length > 0) {
      text += `--------------------------------\n`;
      text += `Subtotal Barang: ${formatRupiah(transaction.subtotalAmount || (transaction.totalAmount - (transaction.otherFeeTotal || 0)))}\n`;
      transaction.otherFees.forEach((fee) => {
        text += `+ ${fee.name}: ${formatRupiah(fee.amount)}\n`;
      });
    }
    text += `--------------------------------\n`;
    text += `*TOTAL BELANJA : ${formatRupiah(transaction.totalAmount)}*\n`;
    if (transaction.paymentType === 'cash') {
      text += `BAYAR TUNAI   : ${formatRupiah(transaction.cashGiven)}\n`;
      text += `*KEMBALIAN     : ${formatRupiah(transaction.change)}*\n`;
      text += `STATUS        : LUNAS (TUNAI)\n`;
    } else {
      if (transaction.debtPaidAmount && transaction.debtPaidAmount > 0) {
        text += `STATUS        : BON (BAYAR SEBAGIAN)\n`;
        text += `UANG MUKA (DP): ${formatRupiah(transaction.debtPaidAmount)}\n`;
        text += `*SISA HUTANG   : ${formatRupiah(transaction.totalAmount - transaction.debtPaidAmount)}*\n`;
      } else {
        text += `STATUS        : BON / HUTANG PENUH\n`;
      }
      if (transaction.debtDueDate) {
        text += `Jatuh Tempo   : ${transaction.debtDueDate}\n`;
      }
    }
    if (transaction.notes) {
      text += `Catatan       : ${transaction.notes}\n`;
    }
    text += `================================\n`;
    text += `${db.settings.receiptFooter || 'Terima kasih atas kunjungan Anda!'}\n`;
    return text;
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generateReceiptText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy receipt text', err);
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(generateReceiptText());
    let url = `https://wa.me/?text=${text}`;
    if (transaction.customerPhone) {
      const cleanPhone = transaction.customerPhone.replace(/\D/g, '');
      const waNumber = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
      url = `https://wa.me/${waNumber}?text=${text}`;
    }
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        id="receipt-modal-card"
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Top Header */}
        <div className="px-4 py-3 bg-stone-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-sm">Struk Transaksi</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Paper Printable Body */}
        <div className="p-4 overflow-y-auto flex-1 bg-stone-50 font-mono text-xs text-stone-800">
          <div className="bg-white p-4 rounded-xl border border-dashed border-stone-300 shadow-xs space-y-2">
            <div className="text-center pb-2 border-b border-dashed border-stone-300">
              <h3 className="font-bold text-sm tracking-wide text-stone-900 uppercase">
                {db.settings.storeName}
              </h3>
              {db.settings.storeAddress && (
                <p className="text-[11px] text-stone-500 font-sans">{db.settings.storeAddress}</p>
              )}
              {db.settings.storePhone && (
                <p className="text-[11px] text-stone-500 font-sans">WA: {db.settings.storePhone}</p>
              )}
            </div>

            <div className="text-[11px] space-y-0.5 text-stone-600">
              <div className="flex justify-between">
                <span>No. Struk:</span>
                <span className="font-semibold text-stone-900">{transaction.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span>{formattedDate}</span>
              </div>
              {transaction.customerName && (
                <div className="flex justify-between">
                  <span>Pelanggan:</span>
                  <span className="font-semibold text-stone-800">{transaction.customerName}</span>
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-stone-300 pt-2 space-y-1.5">
              {transaction.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                    <div className="font-semibold text-stone-900">{item.name}</div>
                    <div className="text-[10px] text-stone-500">
                      {item.quantity} {item.unit || 'pcs'} x {formatRupiah(item.price)}
                    </div>
                  </div>
                  <div className="font-bold text-stone-900">{formatRupiah(item.subtotal)}</div>
                </div>
              ))}

              {transaction.otherFees && transaction.otherFees.length > 0 && (
                <div className="pt-1 border-t border-dotted border-stone-300 space-y-1 text-[11px] text-stone-600">
                  <div className="flex justify-between">
                    <span>Subtotal Barang:</span>
                    <span>
                      {formatRupiah(
                        transaction.subtotalAmount ||
                          transaction.totalAmount - (transaction.otherFeeTotal || 0)
                      )}
                    </span>
                  </div>
                  {transaction.otherFees.map((fee) => (
                    <div key={fee.id} className="flex justify-between text-amber-900 font-medium">
                      <span>+ {fee.name}:</span>
                      <span>{formatRupiah(fee.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-stone-300 pt-2 space-y-1">
              <div className="flex justify-between text-sm font-bold text-stone-900">
                <span>TOTAL:</span>
                <span className="text-emerald-700">{formatRupiah(transaction.totalAmount)}</span>
              </div>

              {transaction.paymentType === 'cash' ? (
                <>
                  <div className="flex justify-between text-stone-600">
                    <span>Uang Diterima:</span>
                    <span>{formatRupiah(transaction.cashGiven)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    <span>KEMBALIAN:</span>
                    <span>{formatRupiah(transaction.change)}</span>
                  </div>
                  <div className="text-center pt-1 font-bold text-emerald-800 text-[11px]">
                    *** LUNAS (TUNAI) ***
                  </div>
                </>
              ) : (
                <div className="bg-amber-50 p-2 rounded-xl border border-amber-200 text-amber-900 space-y-1">
                  <div className="font-bold text-center text-xs">
                    {transaction.debtPaidAmount && transaction.debtPaidAmount > 0
                      ? '*** BON (BAYAR SEBAGIAN) ***'
                      : '*** CATATAN HUTANG / BON ***'}
                  </div>
                  {transaction.debtPaidAmount && transaction.debtPaidAmount > 0 && (
                    <div className="space-y-0.5 pt-0.5 text-xs">
                      <div className="flex justify-between text-stone-600">
                        <span>Uang Muka (DP):</span>
                        <span className="font-semibold text-emerald-700">
                          {formatRupiah(transaction.debtPaidAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-amber-900">
                        <span>Sisa Hutang:</span>
                        <span>
                          {formatRupiah(transaction.totalAmount - transaction.debtPaidAmount)}
                        </span>
                      </div>
                    </div>
                  )}
                  {transaction.debtDueDate && (
                    <div className="text-[10px] text-center text-amber-800/80">
                      Jatuh Tempo: {transaction.debtDueDate}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-dashed border-stone-300 pt-2 text-center text-[10px] text-stone-500 italic">
              {db.settings.receiptFooter || 'Terima kasih atas kunjungan Anda!'}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-3 bg-stone-100 border-t border-stone-200 grid grid-cols-3 gap-2">
          <button
            id="btn-receipt-copy"
            onClick={handleCopyText}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 active:scale-95 transition-all text-xs font-medium"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600 mb-0.5" /> : <Copy className="w-4 h-4 mb-0.5" />}
            <span>{copied ? 'Tersalin' : 'Salin Teks'}</span>
          </button>

          <button
            id="btn-receipt-whatsapp"
            onClick={handleShareWhatsApp}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95 transition-all text-xs font-medium shadow-xs"
          >
            <Share2 className="w-4 h-4 mb-0.5" />
            <span>Kirim WA</span>
          </button>

          <button
            id="btn-receipt-print"
            onClick={handlePrint}
            className="flex flex-col items-center justify-center p-2 rounded-xl bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 active:scale-95 transition-all text-xs font-medium"
          >
            <Printer className="w-4 h-4 mb-0.5" />
            <span>Cetak</span>
          </button>
        </div>

        <div className="p-2.5 bg-stone-900 border-t border-stone-800">
          <button
            id="btn-receipt-close"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-bold text-sm transition-all shadow-md active:scale-98"
          >
            Transaksi Baru
          </button>
        </div>
      </div>
    </div>
  );
}
