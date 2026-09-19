import { useState, useMemo } from 'react';
import { WarungDatabase } from '../types';
import { formatRupiah } from '../utils/storage';
import {
  Calendar,
  Clock,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Wallet,
  BookOpen,
  BarChart3,
  LineChart as LineChartIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export type TimeGranularity = 'jam' | 'bulan' | 'tahun';

interface CashFlowChartProps {
  db: WarungDatabase;
}

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function formatShortRupiah(val: number): string {
  if (Math.abs(val) >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(1)}jt`;
  }
  if (Math.abs(val) >= 1_000) {
    return `${(val / 1_000).toFixed(0)}rb`;
  }
  return val.toString();
}

export function CashFlowChart({ db }: CashFlowChartProps) {
  const currentDate = useMemo(() => new Date(), []);

  // Mode: 'jam' | 'bulan' | 'tahun'
  const [granularity, setGranularity] = useState<TimeGranularity>('jam');

  // Chart type: 'bar' | 'line'
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  // Time selections
  const [selectedDate, setSelectedDate] = useState(() => {
    return currentDate.toISOString().slice(0, 10); // YYYY-MM-DD
  });
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  // Visibility toggles for the 4 series: Masuk, Keluar, Laci, Bon
  const [showMasuk, setShowMasuk] = useState(true);
  const [showKeluar, setShowKeluar] = useState(true);
  const [showLaci, setShowLaci] = useState(true);
  const [showBon, setShowBon] = useState(true);

  // Active hover/tap index for tooltip
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Available years from data + current year
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    set.add(currentDate.getFullYear());
    db.transactions.forEach((t) => {
      const y = new Date(t.timestamp).getFullYear();
      if (!isNaN(y)) set.add(y);
    });
    db.cashEntries.forEach((c) => {
      const y = new Date(c.timestamp).getFullYear();
      if (!isNaN(y)) set.add(y);
    });
    db.debts.forEach((d) => {
      const y = new Date(d.createdAt).getFullYear();
      if (!isNaN(y)) set.add(y);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [db, currentDate]);

  // Aggregate Chart Data based on granularity
  const chartData = useMemo(() => {
    if (granularity === 'jam') {
      const hoursData: Array<{
        key: string;
        label: string;
        masuk: number;
        keluar: number;
        laci: number;
        bon: number;
      }> = [];

      for (let h = 0; h < 24; h++) {
        const hStr = h.toString().padStart(2, '0');
        hoursData.push({
          key: hStr,
          label: `${hStr}:00`,
          masuk: 0,
          keluar: 0,
          laci: 0,
          bon: 0,
        });
      }

      // 1. Transactions on selectedDate
      db.transactions.forEach((t) => {
        if (t.timestamp.startsWith(selectedDate)) {
          const hour = new Date(t.timestamp).getHours();
          if (hour >= 0 && hour < 24) {
            if (t.paymentType === 'cash') {
              hoursData[hour].masuk += t.totalAmount;
            } else if (t.paymentType === 'debt') {
              hoursData[hour].bon += t.totalAmount;
              if (t.debtPaidAmount && t.debtPaidAmount > 0) {
                hoursData[hour].masuk += t.debtPaidAmount;
              }
            }
          }
        }
      });

      // 2. Debt repayments on selectedDate
      db.debts.forEach((d) => {
        (d.payments || []).forEach((p) => {
          if (p.date.startsWith(selectedDate)) {
            const hour = new Date(p.date).getHours();
            if (hour >= 0 && hour < 24) {
              hoursData[hour].masuk += p.amount;
            }
          }
        });
      });

      // 3. Cash Entries on selectedDate
      db.cashEntries.forEach((c) => {
        if (c.timestamp.startsWith(selectedDate)) {
          const hour = new Date(c.timestamp).getHours();
          if (hour >= 0 && hour < 24) {
            if (c.type === 'in') {
              hoursData[hour].masuk += c.amount;
            } else {
              hoursData[hour].keluar += c.amount;
            }
          }
        }
      });

      hoursData.forEach((item) => {
        item.laci = item.masuk - item.keluar;
      });

      // Focus on active business hours (e.g. 06:00 to 22:00 or active bounds)
      const activeIndices = hoursData
        .map((item, idx) => (item.masuk > 0 || item.keluar > 0 || item.bon > 0 ? idx : -1))
        .filter((idx) => idx !== -1);

      const startHour = activeIndices.length > 0 ? Math.min(6, Math.min(...activeIndices)) : 6;
      const endHour = activeIndices.length > 0 ? Math.max(21, Math.max(...activeIndices)) : 21;

      return hoursData.slice(startHour, endHour + 1);
    }

    if (granularity === 'bulan') {
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const monthPrefix = `${selectedYear}-${(selectedMonth + 1).toString().padStart(2, '0')}`;

      const daysData: Array<{
        key: string;
        label: string;
        masuk: number;
        keluar: number;
        laci: number;
        bon: number;
      }> = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const dStr = d.toString().padStart(2, '0');
        const fullDate = `${monthPrefix}-${dStr}`;
        daysData.push({
          key: fullDate,
          label: `${d}`,
          masuk: 0,
          keluar: 0,
          laci: 0,
          bon: 0,
        });
      }

      db.transactions.forEach((t) => {
        if (t.timestamp.startsWith(monthPrefix)) {
          const day = new Date(t.timestamp).getDate();
          if (day >= 1 && day <= daysInMonth) {
            const idx = day - 1;
            if (t.paymentType === 'cash') {
              daysData[idx].masuk += t.totalAmount;
            } else if (t.paymentType === 'debt') {
              daysData[idx].bon += t.totalAmount;
              if (t.debtPaidAmount && t.debtPaidAmount > 0) {
                daysData[idx].masuk += t.debtPaidAmount;
              }
            }
          }
        }
      });

      db.debts.forEach((d) => {
        (d.payments || []).forEach((p) => {
          if (p.date.startsWith(monthPrefix)) {
            const day = new Date(p.date).getDate();
            if (day >= 1 && day <= daysInMonth) {
              daysData[day - 1].masuk += p.amount;
            }
          }
        });
      });

      db.cashEntries.forEach((c) => {
        if (c.timestamp.startsWith(monthPrefix)) {
          const day = new Date(c.timestamp).getDate();
          if (day >= 1 && day <= daysInMonth) {
            const idx = day - 1;
            if (c.type === 'in') {
              daysData[idx].masuk += c.amount;
            } else {
              daysData[idx].keluar += c.amount;
            }
          }
        }
      });

      daysData.forEach((item) => {
        item.laci = item.masuk - item.keluar;
      });

      return daysData;
    }

    // granularity === 'tahun'
    const yearPrefix = `${selectedYear}-`;
    const monthsData: Array<{
      key: string;
      label: string;
      masuk: number;
      keluar: number;
      laci: number;
      bon: number;
    }> = [];

    for (let m = 0; m < 12; m++) {
      monthsData.push({
        key: `${selectedYear}-${(m + 1).toString().padStart(2, '0')}`,
        label: MONTH_SHORT[m],
        masuk: 0,
        keluar: 0,
        laci: 0,
        bon: 0,
      });
    }

    db.transactions.forEach((t) => {
      if (t.timestamp.startsWith(yearPrefix)) {
        const m = new Date(t.timestamp).getMonth();
        if (m >= 0 && m < 12) {
          if (t.paymentType === 'cash') {
            monthsData[m].masuk += t.totalAmount;
          } else if (t.paymentType === 'debt') {
            monthsData[m].bon += t.totalAmount;
            if (t.debtPaidAmount && t.debtPaidAmount > 0) {
              monthsData[m].masuk += t.debtPaidAmount;
            }
          }
        }
      }
    });

    db.debts.forEach((d) => {
      (d.payments || []).forEach((p) => {
        if (p.date.startsWith(yearPrefix)) {
          const m = new Date(p.date).getMonth();
          if (m >= 0 && m < 12) {
            monthsData[m].masuk += p.amount;
          }
        }
      });
    });

    db.cashEntries.forEach((c) => {
      if (c.timestamp.startsWith(yearPrefix)) {
        const m = new Date(c.timestamp).getMonth();
        if (m >= 0 && m < 12) {
          if (c.type === 'in') {
            monthsData[m].masuk += c.amount;
          } else {
            monthsData[m].keluar += c.amount;
          }
        }
      }
    });

    monthsData.forEach((item) => {
      item.laci = item.masuk - item.keluar;
    });

    return monthsData;
  }, [db, granularity, selectedDate, selectedMonth, selectedYear]);

  // Aggregate totals for the chosen period
  const periodTotals = useMemo(() => {
    let totalMasuk = 0;
    let totalKeluar = 0;
    let totalBon = 0;

    chartData.forEach((d) => {
      totalMasuk += d.masuk;
      totalKeluar += d.keluar;
      totalBon += d.bon;
    });

    const saldoLaci = totalMasuk - totalKeluar;
    return { totalMasuk, totalKeluar, saldoLaci, totalBon };
  }, [chartData]);

  // Find maximum value to scale the Y-axis
  const maxYValue = useMemo(() => {
    let max = 0;
    chartData.forEach((d) => {
      if (showMasuk && d.masuk > max) max = d.masuk;
      if (showKeluar && d.keluar > max) max = d.keluar;
      if (showLaci && Math.abs(d.laci) > max) max = Math.abs(d.laci);
      if (showBon && d.bon > max) max = d.bon;
    });
    if (max === 0) return 100000;
    // Round up to nice number
    const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / magnitude) * magnitude;
  }, [chartData, showMasuk, showKeluar, showLaci, showBon]);

  // Quick navigation handlers
  const handlePrevPeriod = () => {
    if (granularity === 'jam') {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - 1);
      setSelectedDate(d.toISOString().slice(0, 10));
    } else if (granularity === 'bulan') {
      if (selectedMonth === 0) {
        setSelectedMonth(11);
        setSelectedYear((y) => y - 1);
      } else {
        setSelectedMonth((m) => m - 1);
      }
    } else {
      setSelectedYear((y) => y - 1);
    }
    setHoveredIndex(null);
  };

  const handleNextPeriod = () => {
    if (granularity === 'jam') {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 1);
      setSelectedDate(d.toISOString().slice(0, 10));
    } else if (granularity === 'bulan') {
      if (selectedMonth === 11) {
        setSelectedMonth(0);
        setSelectedYear((y) => y + 1);
      } else {
        setSelectedMonth((m) => m + 1);
      }
    } else {
      setSelectedYear((y) => y + 1);
    }
    setHoveredIndex(null);
  };

  const handleResetToCurrent = () => {
    const now = new Date();
    setSelectedDate(now.toISOString().slice(0, 10));
    setSelectedMonth(now.getMonth());
    setSelectedYear(now.getFullYear());
    setHoveredIndex(null);
  };

  // Human readable title of active period
  const periodTitle = useMemo(() => {
    if (granularity === 'jam') {
      const d = new Date(selectedDate);
      const isToday = selectedDate === currentDate.toISOString().slice(0, 10);
      return `${isToday ? 'Hari Ini, ' : ''}${d.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}`;
    }
    if (granularity === 'bulan') {
      return `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;
    }
    return `Tahun ${selectedYear}`;
  }, [granularity, selectedDate, selectedMonth, selectedYear, currentDate]);

  // Dimensions for custom SVG chart
  const svgWidth = 800;
  const svgHeight = 240;
  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 35;
  const chartInnerWidth = svgWidth - paddingLeft - paddingRight;
  const chartInnerHeight = svgHeight - paddingTop - paddingBottom;

  // Active series count for bar positioning
  const activeSeries = useMemo(() => {
    const list: Array<{ key: 'masuk' | 'keluar' | 'laci' | 'bon'; color: string; label: string }> = [];
    if (showMasuk) list.push({ key: 'masuk', color: '#10b981', label: 'Uang Masuk' });
    if (showKeluar) list.push({ key: 'keluar', color: '#f43f5e', label: 'Uang Keluar' });
    if (showLaci) list.push({ key: 'laci', color: '#f59e0b', label: 'Sisa Laci' });
    if (showBon) list.push({ key: 'bon', color: '#3b82f6', label: 'Bon / Hutang' });
    return list;
  }, [showMasuk, showKeluar, showLaci, showBon]);

  const activeItem = hoveredIndex !== null && chartData[hoveredIndex] ? chartData[hoveredIndex] : null;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden space-y-3 p-3.5">
      {/* Header: Granularity Switcher (Jam | Bulan | Tahun) & Chart Type */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-stone-900">
              Grafik Arus Kas Laci & Bon
            </h3>
          </div>
          <p className="text-[11px] text-stone-500">
            Visualisasi riwayat uang masuk, keluar, sisa laci, dan hutang
          </p>
        </div>

        {/* Granularity Tabs: Jam | Bulan | Tahun */}
        <div className="flex items-center gap-1 self-start sm:self-auto bg-stone-100 p-1 rounded-xl">
          <button
            id="btn-granularity-jam"
            type="button"
            onClick={() => {
              setGranularity('jam');
              setHoveredIndex(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              granularity === 'jam'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Per Jam</span>
          </button>

          <button
            id="btn-granularity-bulan"
            type="button"
            onClick={() => {
              setGranularity('bulan');
              setHoveredIndex(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              granularity === 'bulan'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Per Bulan</span>
          </button>

          <button
            id="btn-granularity-tahun"
            type="button"
            onClick={() => {
              setGranularity('tahun');
              setHoveredIndex(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
              granularity === 'tahun'
                ? 'bg-white text-emerald-700 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Per Tahun</span>
          </button>
        </div>
      </div>

      {/* Time Controls Bar: Prev, Selector, Next, Chart Style */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevPeriod}
            title="Periode Sebelumnya"
            className="p-1.5 rounded-lg bg-white hover:bg-stone-200 border border-stone-200 text-stone-600 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="font-bold text-xs text-stone-800 px-2 min-w-[120px] text-center">
            {periodTitle}
          </div>

          <button
            type="button"
            onClick={handleNextPeriod}
            title="Periode Berikutnya"
            className="p-1.5 rounded-lg bg-white hover:bg-stone-200 border border-stone-200 text-stone-600 transition-all cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleResetToCurrent}
            className="text-[10px] px-2 py-1 rounded-md bg-white border border-stone-200 text-emerald-700 hover:bg-emerald-50 font-semibold transition-all ml-1 cursor-pointer"
          >
            Sekarang
          </button>
        </div>

        {/* Specific Pickers for Mode */}
        <div className="flex items-center gap-1.5">
          {granularity === 'jam' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                  setHoveredIndex(null);
                }
              }}
              className="bg-white border border-stone-300 rounded-lg px-2 py-1 text-xs text-stone-700 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          )}

          {granularity === 'bulan' && (
            <div className="flex items-center gap-1">
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(parseInt(e.target.value, 10));
                  setHoveredIndex(null);
                }}
                className="bg-white border border-stone-300 rounded-lg px-2 py-1 text-xs text-stone-700 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(parseInt(e.target.value, 10));
                  setHoveredIndex(null);
                }}
                className="bg-white border border-stone-300 rounded-lg px-2 py-1 text-xs text-stone-700 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          {granularity === 'tahun' && (
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(parseInt(e.target.value, 10));
                setHoveredIndex(null);
              }}
              className="bg-white border border-stone-300 rounded-lg px-2 py-1 text-xs text-stone-700 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  Tahun {y}
                </option>
              ))}
            </select>
          )}

          {/* Bar vs Line View Switcher */}
          <div className="flex items-center bg-white border border-stone-200 rounded-lg p-0.5 ml-1">
            <button
              type="button"
              onClick={() => setChartType('bar')}
              title="Grafik Batang"
              className={`p-1 rounded-md transition-all cursor-pointer ${
                chartType === 'bar' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType('line')}
              title="Grafik Garis"
              className={`p-1 rounded-md transition-all cursor-pointer ${
                chartType === 'line' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              <LineChartIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Key Metric Summary Cards for the Chosen Period (Masuk, Keluar, Laci, Bon) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* 1. Uang Masuk */}
        <div
          onClick={() => setShowMasuk(!showMasuk)}
          className={`cursor-pointer p-2.5 rounded-xl border transition-all select-none ${
            showMasuk
              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-xs'
              : 'bg-stone-50 border-stone-200 text-stone-400 opacity-60'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] mb-0.5">
            <span className="font-semibold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              Uang Masuk
            </span>
            <span
              className={`w-2 h-2 rounded-full ${showMasuk ? 'bg-emerald-500' : 'bg-stone-300'}`}
            />
          </div>
          <div className="text-base font-black text-emerald-700 tracking-tight">
            {formatRupiah(periodTotals.totalMasuk)}
          </div>
          <div className="text-[10px] text-stone-500">Kasir + Bayar Bon</div>
        </div>

        {/* 2. Uang Keluar */}
        <div
          onClick={() => setShowKeluar(!showKeluar)}
          className={`cursor-pointer p-2.5 rounded-xl border transition-all select-none ${
            showKeluar
              ? 'bg-rose-50/80 border-rose-300 text-rose-950 shadow-xs'
              : 'bg-stone-50 border-stone-200 text-stone-400 opacity-60'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] mb-0.5">
            <span className="font-semibold flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
              Uang Keluar
            </span>
            <span
              className={`w-2 h-2 rounded-full ${showKeluar ? 'bg-rose-500' : 'bg-stone-300'}`}
            />
          </div>
          <div className="text-base font-black text-rose-700 tracking-tight">
            {formatRupiah(periodTotals.totalKeluar)}
          </div>
          <div className="text-[10px] text-stone-500">Kulakan + Operasional</div>
        </div>

        {/* 3. Saldo Bersih Laci */}
        <div
          onClick={() => setShowLaci(!showLaci)}
          className={`cursor-pointer p-2.5 rounded-xl border transition-all select-none ${
            showLaci
              ? 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-xs'
              : 'bg-stone-50 border-stone-200 text-stone-400 opacity-60'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] mb-0.5">
            <span className="font-semibold flex items-center gap-1">
              <Wallet className="w-3.5 h-3.5 text-amber-600" />
              Sisa Laci Kas
            </span>
            <span
              className={`w-2 h-2 rounded-full ${showLaci ? 'bg-amber-500' : 'bg-stone-300'}`}
            />
          </div>
          <div
            className={`text-base font-black tracking-tight ${
              periodTotals.saldoLaci >= 0 ? 'text-amber-800' : 'text-rose-700'
            }`}
          >
            {formatRupiah(periodTotals.saldoLaci)}
          </div>
          <div className="text-[10px] text-stone-500">Masuk dikurangi Keluar</div>
        </div>

        {/* 4. Bon / Hutang */}
        <div
          onClick={() => setShowBon(!showBon)}
          className={`cursor-pointer p-2.5 rounded-xl border transition-all select-none ${
            showBon
              ? 'bg-blue-50/80 border-blue-300 text-blue-950 shadow-xs'
              : 'bg-stone-50 border-stone-200 text-stone-400 opacity-60'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] mb-0.5">
            <span className="font-semibold flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              Bon Tercatat
            </span>
            <span
              className={`w-2 h-2 rounded-full ${showBon ? 'bg-blue-500' : 'bg-stone-300'}`}
            />
          </div>
          <div className="text-base font-black text-blue-800 tracking-tight">
            {formatRupiah(periodTotals.totalBon)}
          </div>
          <div className="text-[10px] text-stone-500">Hutang baru periode ini</div>
        </div>
      </div>

      {/* Detail Hover / Active Card */}
      {activeItem && (
        <div className="bg-stone-900 text-white px-3.5 py-2 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2 transition-all">
          <div className="font-bold text-stone-200">
            {granularity === 'jam' ? `Jam ${activeItem.label}` : granularity === 'bulan' ? `Tanggal ${activeItem.label}` : `Bulan ${activeItem.label}`}:
          </div>
          <div className="flex items-center gap-3">
            {showMasuk && (
              <div className="flex items-center gap-1 text-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Masuk: {formatRupiah(activeItem.masuk)}</span>
              </div>
            )}
            {showKeluar && (
              <div className="flex items-center gap-1 text-rose-300">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span>Keluar: {formatRupiah(activeItem.keluar)}</span>
              </div>
            )}
            {showLaci && (
              <div className="flex items-center gap-1 text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Laci: {formatRupiah(activeItem.laci)}</span>
              </div>
            )}
            {showBon && (
              <div className="flex items-center gap-1 text-blue-300">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                <span>Bon: {formatRupiah(activeItem.bon)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SVG Canvas Rendering - Zero Dependencies, 100% Reliable & Fast */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[500px]">
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full h-auto select-none"
            style={{ maxHeight: '250px' }}
          >
            {/* Grid horizontal lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
              const y = paddingTop + chartInnerHeight * (1 - ratio);
              const val = maxYValue * ratio;
              return (
                <g key={idx}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={svgWidth - paddingRight}
                    y2={y}
                    stroke="#e7e5e4"
                    strokeDasharray={ratio === 0 ? undefined : '3 3'}
                    strokeWidth={1}
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="#78716c"
                    fontWeight="500"
                  >
                    {formatShortRupiah(val)}
                  </text>
                </g>
              );
            })}

            {/* Bars Rendering */}
            {chartType === 'bar' && (
              <>
                {chartData.map((item, i) => {
                  const colWidth = chartInnerWidth / chartData.length;
                  const colX = paddingLeft + i * colWidth;
                  const barCount = activeSeries.length;
                  const barWidth = Math.max(2, Math.min(18, (colWidth * 0.75) / (barCount || 1)));
                  const groupWidth = barCount * barWidth;
                  const groupStartX = colX + (colWidth - groupWidth) / 2;

                  return (
                    <g
                      key={item.key}
                      onMouseEnter={() => setHoveredIndex(i)}
                      onClick={() => setHoveredIndex(i)}
                      className="cursor-pointer"
                    >
                      {/* Transparent hit area for easy tapping */}
                      <rect
                        x={colX}
                        y={paddingTop}
                        width={colWidth}
                        height={chartInnerHeight}
                        fill={hoveredIndex === i ? 'rgba(0,0,0,0.03)' : 'transparent'}
                      />

                      {activeSeries.map((series, sIdx) => {
                        const val = item[series.key];
                        const barHeight = maxYValue > 0 ? (Math.max(0, val) / maxYValue) * chartInnerHeight : 0;
                        const bx = groupStartX + sIdx * barWidth;
                        const by = paddingTop + chartInnerHeight - barHeight;

                        return (
                          <rect
                            key={series.key}
                            x={bx}
                            y={by}
                            width={Math.max(1, barWidth - 1)}
                            height={barHeight}
                            rx={3}
                            fill={series.color}
                            opacity={hoveredIndex === null || hoveredIndex === i ? 1 : 0.4}
                            className="transition-all duration-150"
                          />
                        );
                      })}
                    </g>
                  );
                })}
              </>
            )}

            {/* Line Rendering */}
            {chartType === 'line' && (
              <>
                {activeSeries.map((series) => {
                  const colWidth = chartInnerWidth / chartData.length;
                  const points = chartData.map((item, i) => {
                    const x = paddingLeft + i * colWidth + colWidth / 2;
                    const val = item[series.key];
                    const y = paddingTop + chartInnerHeight - (maxYValue > 0 ? (Math.max(0, val) / maxYValue) * chartInnerHeight : 0);
                    return { x, y, val };
                  });

                  const pathD = points.reduce((acc, p, idx) => {
                    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
                  }, '');

                  return (
                    <g key={series.key}>
                      <path
                        d={pathD}
                        fill="none"
                        stroke={series.color}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {points.map((p, idx) => (
                        <circle
                          key={idx}
                          cx={p.x}
                          cy={p.y}
                          r={hoveredIndex === idx ? 5 : 3}
                          fill={series.color}
                          stroke="#ffffff"
                          strokeWidth={1.5}
                          className="transition-all"
                        />
                      ))}
                    </g>
                  );
                })}

                {/* Transparent column hit zones for line chart */}
                {chartData.map((item, i) => {
                  const colWidth = chartInnerWidth / chartData.length;
                  const colX = paddingLeft + i * colWidth;
                  return (
                    <rect
                      key={item.key}
                      x={colX}
                      y={paddingTop}
                      width={colWidth}
                      height={chartInnerHeight}
                      fill={hoveredIndex === i ? 'rgba(0,0,0,0.04)' : 'transparent'}
                      onMouseEnter={() => setHoveredIndex(i)}
                      onClick={() => setHoveredIndex(i)}
                      className="cursor-pointer"
                    />
                  );
                })}
              </>
            )}

            {/* X-Axis bottom line */}
            <line
              x1={paddingLeft}
              y1={paddingTop + chartInnerHeight}
              x2={svgWidth - paddingRight}
              y2={paddingTop + chartInnerHeight}
              stroke="#d6d3d1"
              strokeWidth={1}
            />

            {/* X-Axis labels */}
            {chartData.map((item, i) => {
              const colWidth = chartInnerWidth / chartData.length;
              const x = paddingLeft + i * colWidth + colWidth / 2;
              const y = paddingTop + chartInnerHeight + 15;

              // If month has 31 items, show every 2nd or 3rd label on small screens
              const totalItems = chartData.length;
              const skip = totalItems > 20 ? (i % 2 !== 0 && i !== totalItems - 1) : false;

              if (skip) return null;

              return (
                <text
                  key={item.key}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  fontSize="10"
                  fill={hoveredIndex === i ? '#047857' : '#78716c'}
                  fontWeight={hoveredIndex === i ? '700' : '400'}
                >
                  {item.label}
                </text>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Legend & Instructions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-100 text-[11px] text-stone-500">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Uang Masuk</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>Uang Keluar</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Sisa Laci</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>Bon/Hutang</span>
          </div>
        </div>

        <span className="text-stone-400">
          *Sentuh batang/titik grafik untuk lihat angka rincian
        </span>
      </div>
    </div>
  );
}
