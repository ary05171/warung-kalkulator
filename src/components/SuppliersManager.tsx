import { useState } from 'react';
import { Supplier, WarungDatabase } from '../types';
import { formatRupiah } from '../utils/storage';
import {
  Truck,
  Plus,
  Phone,
  MapPin,
  Package,
  Edit2,
  Trash2,
  X,
  MessageCircle,
  ArrowDownLeft,
} from 'lucide-react';

interface SuppliersManagerProps {
  db: WarungDatabase;
  onSaveSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (id: string) => void;
  onQuickExpenseForSupplier: (supplier: Supplier) => void;
}

export function SuppliersManager({
  db,
  onSaveSupplier,
  onDeleteSupplier,
  onQuickExpenseForSupplier,
}: SuppliersManagerProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [goodsSupplied, setGoodsSupplied] = useState('');
  const [notes, setNotes] = useState('');

  const openAddModal = () => {
    setEditingSupplier(null);
    setName('');
    setPhone('');
    setAddress('');
    setGoodsSupplied('');
    setNotes('');
    setModalOpen(true);
  };

  const openEditModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setName(sup.name);
    setPhone(sup.phone || '');
    setAddress(sup.address || '');
    setGoodsSupplied(sup.goodsSupplied || '');
    setNotes(sup.notes || '');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Nama suplier / agen harus diisi');
      return;
    }

    const newSup: Supplier = {
      id: editingSupplier ? editingSupplier.id : `sup-${Date.now()}`,
      name: name.trim(),
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      goodsSupplied: goodsSupplied.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    onSaveSupplier(newSup);
    setModalOpen(false);
  };

  // Helper to open WhatsApp to supplier
  const handleChatSupplier = (phoneNum: string, supName: string) => {
    const cleanPhone = phoneNum.replace(/\D/g, '');
    const waNumber = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
    const msg = encodeURIComponent(
      `Halo ${supName}, kami dari ${db.settings.storeName}. Ingin menanyakan ketersediaan stok & jadwal pengantaran barang warung 🙏`
    );
    window.open(`https://wa.me/${waNumber}?text=${msg}`, '_blank');
  };

  return (
    <div className="flex flex-col flex-1 p-3 pb-24 space-y-3">
      {/* Header */}
      <div className="bg-white p-3.5 rounded-2xl border border-stone-200 shadow-xs flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-1.5">
            <Truck className="w-5 h-5 text-emerald-700" />
            <span>Daftar Suplier & Agen Kulakan</span>
          </h2>
          <p className="text-xs text-stone-500">
            Total {db.suppliers.length} mitra agen dan suplier barang
          </p>
        </div>

        <button
          id="btn-tambah-suplier"
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Suplier</span>
        </button>
      </div>

      {/* Supplier Cards List */}
      <div className="space-y-2.5">
        {db.suppliers.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center text-stone-500 text-xs">
            Belum ada suplier terdaftar. Klik "+ Tambah Suplier" untuk mencatat.
          </div>
        ) : (
          db.suppliers.map((sup) => {
            // Calculate total expenses for this supplier from cash entries
            const totalSpent = db.cashEntries
              .filter((c) => c.type === 'out' && (c.supplierId === sup.id || c.supplierName === sup.name))
              .reduce((s, c) => s + c.amount, 0);

            return (
              <div
                key={sup.id}
                id={`supplier-card-${sup.id}`}
                className="bg-white rounded-2xl border border-stone-200 p-3.5 shadow-xs space-y-2.5 hover:border-emerald-300 transition-all"
              >
                {/* Top Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold text-stone-900 text-sm">{sup.name}</h3>
                    {sup.goodsSupplied && (
                      <div className="text-xs text-emerald-800 font-medium flex items-center gap-1 mt-0.5">
                        <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{sup.goodsSupplied}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-stone-400">Total Kulakan:</div>
                    <div className="text-xs font-black text-stone-900">
                      {formatRupiah(totalSpent)}
                    </div>
                  </div>
                </div>

                {/* Details: Phone & Address */}
                <div className="bg-stone-50 p-2.5 rounded-xl text-xs space-y-1 text-stone-600">
                  {sup.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span>{sup.phone}</span>
                    </div>
                  )}

                  {sup.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                      <span>{sup.address}</span>
                    </div>
                  )}

                  {sup.notes && (
                    <div className="text-[11px] text-stone-500 italic pt-0.5">
                      "{sup.notes}"
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100">
                  <div className="flex items-center gap-1.5">
                    {sup.phone && (
                      <button
                        onClick={() => handleChatSupplier(sup.phone!, sup.name)}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs flex items-center gap-1"
                        title="Chat WhatsApp Suplier"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Chat WA</span>
                      </button>
                    )}

                    <button
                      onClick={() => openEditModal(sup)}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-100"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Hapus suplier "${sup.name}"?`)) {
                          onDeleteSupplier(sup.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-stone-300 hover:text-rose-600 hover:bg-rose-50"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => onQuickExpenseForSupplier(sup)}
                    className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1 border border-rose-200"
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>Catat Kulakan</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Add/Edit Supplier */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-xs">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="px-4 py-3 bg-stone-900 text-white flex items-center justify-between">
              <span className="font-bold text-sm">
                {editingSupplier ? 'Edit Data Suplier' : 'Tambah Suplier / Agen'}
              </span>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Nama Suplier / Agen Toko:
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Misal: Toko Grosir Jaya Abadi"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-sm text-stone-900"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Barang yang Disuplai:
                </label>
                <input
                  type="text"
                  value={goodsSupplied}
                  onChange={(e) => setGoodsSupplied(e.target.value)}
                  placeholder="Misal: Gas LPG, Galon, Sembako"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  No. Telepon / WhatsApp:
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Alamat / Pasar:
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Misal: Pasar Pagi Blok C No. 5"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Catatan Tambahan:
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Misal: Minimal order 500rb gratis antar"
                  className="w-full border border-stone-300 rounded-xl px-3 py-2 text-xs text-stone-800"
                />
              </div>
            </div>

            <div className="p-3 bg-stone-50 border-t border-stone-200 flex gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-stone-200 text-stone-700 font-semibold text-xs"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
              >
                Simpan Suplier
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
