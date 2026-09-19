import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
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
  Filter,
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
      // 24 hours of the selected date (00:00 to 23:00)
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
              // Hutang baru dicatat
              hoursData[hour].bon += t.totalAmount;
              // Jika ada DP tunai
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

      // Calculate net Laci = masuk - keluar
      hoursData.forEach((item) => {
        item.laci = item.masuk - item.keluar;
      });

      // Find first and last active hours to display a focused range or 06:00-22:00
      const activeIndices = hoursData
        .map((item, idx) => (item.masuk > 0 || item.keluar > 0 || item.bon > 0 ? idx : -1))
        .filter((idx) => idx !== -1);

      const startHour = activeIndices.length > 0 ? Math.min(6, Math.min(...activeIndices)) : 6;
      const endHour = activeIndices.length > 0 ? Math.max(21, Math.max(...activeIndices)) : 21;

      return hoursData.slice(startHour, endHour + 1);
    }

    if (granularity === 'bulan') {
      // Days in selectedMonth of selectedYear
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
          label: `Tgl ${d}`,
          masuk: 0,
          keluar: 0,
          laci: 0,
          bon: 0,
        });
      }

      // 1. Transactions in that month
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

      // 2. Debt repayments
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

      // 3. Cash Entries
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
    // 12 months of selectedYear
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

    // 1. Transactions in that year
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

    // 2. Debt repayments
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

    // 3. Cash Entries
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
  };

  const handleResetToCurrent = () => {
    const now = new Date();
    setSelectedDate(now.toISOString().slice(0, 10));
    setSelectedMonth(now.getMonth());
    setSelectedYear(now.getFullYear());
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

  // Custom Recharts Tooltip
  const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-stone-900/95 text-white p-3 rounded-xl shadow-xl border border-stone-700 text-xs space-y-1.5 min-w-[170px] backdrop-blur-xs">
          <div className="font-bold border-b border-stone-800 pb-1 text-stone-300">
            {label} ({periodTitle})
          </div>
          {payload.map((entry: any, index: number) => {
            const name = entry.name;
            const value = entry.value;
            const color = entry.color;
            return (
              <div key={`item-${index}`} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-stone-300 text-[11px]">{name}:</span>
                </div>
                <span className="font-bold text-white tracking-tight">
                  {formatRupiah(value)}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

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
            onClick={() => setGranularity('jam')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
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
            onClick={() => setGranularity('bulan')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
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
            onClick={() => setGranularity('tahun')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
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
            className="p-1.5 rounded-lg bg-white hover:bg-stone-200 border border-stone-200 text-stone-600 transition-all"
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
            className="p-1.5 rounded-lg bg-white hover:bg-stone-200 border border-stone-200 text-stone-600 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleResetToCurrent}
            className="text-[10px] px-2 py-1 rounded-md bg-white border border-stone-200 text-emerald-700 hover:bg-emerald-50 font-semibold transition-all ml-1"
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
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="bg-white border border-stone-300 rounded-lg px-2 py-1 text-xs text-stone-700 font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          )}

          {granularity === 'bulan' && (
            <div className="flex items-center gap-1">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
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
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
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
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
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
              className={`p-1 rounded-md transition-all ${
                chartType === 'bar' ? 'bg-emerald-600 text-white shadow-xs' : 'text-stone-400 hover:text-stone-700'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType('line')}
              title="Grafik Garis"
              className={`p-1 rounded-md transition-all ${
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

      {/* Chart Canvas */}
      <div className="w-full h-64 sm:h-72 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'bar' ? (
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#78716c' }}
                axisLine={{ stroke: '#d6d3d1' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#78716c' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => {
                  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}jt`;
                  if (val >= 1000) return `${(val / 1000).toFixed(0)}rb`;
                  return val.toString();
                }}
              />
              <Tooltip content={<CustomChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                iconType="circle"
              />
              {showMasuk && (
                <Bar
                  dataKey="masuk"
                  name="Uang Masuk"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              )}
              {showKeluar && (
                <Bar
                  dataKey="keluar"
                  name="Uang Keluar"
                  fill="#f43f5e"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              )}
              {showLaci && (
                <Bar
                  dataKey="laci"
                  name="Sisa Laci"
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              )}
              {showBon && (
                <Bar
                  dataKey="bon"
                  name="Bon / Hutang"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              )}
            </BarChart>
          ) : (
            <LineChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7e5e4" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#78716c' }}
                axisLine={{ stroke: '#d6d3d1' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#78716c' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => {
                  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}jt`;
                  if (val >= 1000) return `${(val / 1000).toFixed(0)}rb`;
                  return val.toString();
                }}
              />
              <Tooltip content={<CustomChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
                iconType="circle"
              />
              {showMasuk && (
                <Line
                  type="monotone"
                  dataKey="masuk"
                  name="Uang Masuk"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
              {showKeluar && (
                <Line
                  type="monotone"
                  dataKey="keluar"
                  name="Uang Keluar"
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
              {showLaci && (
                <Line
                  type="monotone"
                  dataKey="laci"
                  name="Sisa Laci"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
              {showBon && (
                <Line
                  type="monotone"
                  dataKey="bon"
                  name="Bon / Hutang"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between text-[11px] text-stone-400 pt-1 border-t border-stone-100">
        <span>*Klik kartu warna di atas untuk sembunyikan/tampilkan garis grafik</span>
        <span>Skala: {granularity.toUpperCase()}</span>
      </div>
    </div>
  );
}
