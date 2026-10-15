import React, { useMemo, useState, useRef } from 'react';
import { BudgetCategory, TransactionItem, WalletItem } from '../types/finance';
import {
  convertCurrency,
  getTransactionCurrencyCode,
} from '../utils/currency';
import {
  TrendingDown,
  TrendingUp,
  Filter,
  Calendar,
  Layers,
  BarChart2,
  PieChart,
  HelpCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface ExpenseVisualizationsProps {
  transactions: TransactionItem[];
  budgets: BudgetCategory[];
  wallets?: WalletItem[];
  currencySymbol: string;
  currencyCode?: string;
  customExchangeRates?: Record<string, number>;
  selectedCategoryFilter: string;
  onSelectCategory: (category: string) => void;
  selectedMonth?: string; // YYYY-MM (e.g. '2026-10')
  onSelectMonth?: (month: string) => void;
}

const CHART_PALETTE = [
  '#0f172a', // slate-900
  '#2563eb', // blue-600
  '#0d9488', // teal-600
  '#d97706', // amber-600
  '#4f46e5', // indigo-600
  '#dc2626', // red-600
  '#475569', // slate-600
];

const MONTH_NAMES_UA: Record<string, string> = {
  '01': 'Січень',
  '02': 'Лютий',
  '03': 'Березень',
  '04': 'Квітень',
  '05': 'Травень',
  '06': 'Червень',
  '07': 'Липень',
  '08': 'Серпень',
  '09': 'Вересень',
  '10': 'Жовтень',
  '11': 'Листопад',
  '12': 'Грудень',
};

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const name = MONTH_NAMES_UA[month] || month;
  return `${name} ${year}`;
}

function getPreviousMonthKey(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10);
  if (isNaN(y) || isNaN(m)) return '2026-09';
  m -= 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export const ExpenseVisualizations: React.FC<ExpenseVisualizationsProps> = ({
  transactions,
  budgets,
  wallets = [],
  currencySymbol,
  currencyCode = 'PLN',
  customExchangeRates,
  selectedCategoryFilter,
  onSelectCategory,
  selectedMonth = '2026-10',
  onSelectMonth,
}) => {
  const [chartMode, setChartMode] = useState<'cumulative' | 'daily'>('cumulative');
  const [categoryChartType, setCategoryChartType] = useState<'donut' | 'bar'>('donut');
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [expandedCatLegend, setExpandedCatLegend] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Month keys
  const currentMonthKey = selectedMonth;
  const previousMonthKey = useMemo(
    () => getPreviousMonthKey(currentMonthKey),
    [currentMonthKey]
  );

  const currentMonthLabel = useMemo(
    () => formatMonthLabel(currentMonthKey),
    [currentMonthKey]
  );
  const previousMonthLabel = useMemo(
    () => formatMonthLabel(previousMonthKey),
    [previousMonthKey]
  );

  // All expense transactions filtered by category if selected
  const filteredExpenseTx = useMemo(() => {
    return transactions.filter((t) => {
      if (t.type !== 'expense') return false;
      if (selectedCategoryFilter !== 'all' && t.category !== selectedCategoryFilter) {
        return false;
      }
      return true;
    });
  }, [transactions, selectedCategoryFilter]);

  // Current month expenses (for donut chart and KPI)
  const currentMonthExpenses = useMemo(() => {
    return transactions.filter(
      (t) => t.type === 'expense' && t.date.startsWith(currentMonthKey)
    );
  }, [transactions, currentMonthKey]);

  const currentMonthFilteredExpenses = useMemo(() => {
    return filteredExpenseTx.filter((t) => t.date.startsWith(currentMonthKey));
  }, [filteredExpenseTx, currentMonthKey]);

  const prevMonthFilteredExpenses = useMemo(() => {
    return filteredExpenseTx.filter((t) => t.date.startsWith(previousMonthKey));
  }, [filteredExpenseTx, previousMonthKey]);

  const totalExpenseCurrent = useMemo(
    () => currentMonthFilteredExpenses.reduce((sum, t) => sum + t.amount, 0),
    [currentMonthFilteredExpenses]
  );

  const totalExpensePrev = useMemo(
    () => prevMonthFilteredExpenses.reduce((sum, t) => sum + t.amount, 0),
    [prevMonthFilteredExpenses]
  );

  // Structure by Category (for Left Panel)
  const categoryStats = useMemo(() => {
    const map = new Map<string, { spent: number; limit: number; threshold: number }>();
    budgets.forEach((b) => {
      map.set(b.name, {
        spent: 0,
        limit: b.monthlyLimit,
        threshold: b.alertThresholdPercent,
      });
    });

    currentMonthExpenses.forEach((tx) => {
      const existing = map.get(tx.category);
      if (existing) {
        existing.spent += tx.amount;
      } else {
        map.set(tx.category, {
          spent: tx.amount,
          limit: 0,
          threshold: 80,
        });
      }
    });

    const totalCurrentAll = currentMonthExpenses.reduce((sum, t) => sum + t.amount, 0);

    return Array.from(map.entries())
      .map(([name, info], idx) => {
        const sharePct = totalCurrentAll > 0 ? (info.spent / totalCurrentAll) * 100 : 0;
        const budgetPct = info.limit > 0 ? (info.spent / info.limit) * 100 : 0;
        const matchingBudget = budgets.find((b) => b.name === name);
        const color = matchingBudget?.color || CHART_PALETTE[idx % CHART_PALETTE.length];
        return {
          name,
          spent: info.spent,
          limit: info.limit,
          threshold: info.threshold,
          sharePct,
          budgetPct,
          color,
        };
      })
      .sort((a, b) => b.spent - a.spent);
  }, [budgets, currentMonthExpenses]);

  // Subcategories breakdown for current month (supporting transaction splits)
  const subcategoriesByCat = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    currentMonthExpenses.forEach((t) => {
      if (!map.has(t.category)) {
        map.set(t.category, new Map<string, number>());
      }
      const subMap = map.get(t.category)!;
      if (t.splits && t.splits.length > 0) {
        t.splits.forEach((sp) => {
          const sName = sp.subcategory?.trim() || 'Без підкатегорії';
          subMap.set(sName, (subMap.get(sName) || 0) + sp.amount);
        });
      } else {
        const sName = t.subcategory?.trim() || 'Без підкатегорії';
        subMap.set(sName, (subMap.get(sName) || 0) + t.amount);
      }
    });
    return map;
  }, [currentMonthExpenses]);

  // Donut segments calculation
  const donutSegments = useMemo(() => {
    const radius = 64;
    const circumference = 2 * Math.PI * radius;
    let accumulatedPct = 0;

    return categoryStats
      .filter((c) => c.spent > 0)
      .map((item) => {
        const strokeDasharray = `${(item.sharePct / 100) * circumference} ${circumference}`;
        const strokeDashoffset = -((accumulatedPct / 100) * circumference);
        accumulatedPct += item.sharePct;
        return {
          ...item,
          radius,
          strokeDasharray,
          strokeDashoffset,
        };
      });
  }, [categoryStats]);

  // Priority breakdown: Потрібно vs Можу vs Хочу (розрахунок по підкатегоріях з конвертацією у базову валюту)
  const priorityBreakdown = useMemo(() => {
    let need = 0;
    let could = 0;
    let want = 0;
    currentMonthExpenses.forEach((tx) => {
      const txCurr = getTransactionCurrencyCode(tx, wallets, currencyCode);
      if (tx.splits && tx.splits.length > 0) {
        tx.splits.forEach((s) => {
          const prio = s.expensePriority || tx.expensePriority || 'need';
          const convertedSplit = convertCurrency(
            s.amount,
            txCurr,
            currencyCode,
            customExchangeRates
          );
          if (prio === 'want') want += convertedSplit;
          else if (prio === 'could') could += convertedSplit;
          else need += convertedSplit;
        });
      } else {
        const prio = tx.expensePriority || 'need';
        const converted = convertCurrency(
          tx.amount,
          txCurr,
          currencyCode,
          customExchangeRates
        );
        if (prio === 'want') want += converted;
        else if (prio === 'could') could += converted;
        else need += converted;
      }
    });
    const total = need + could + want;
    return {
      need,
      could,
      want,
      total,
      needPct: total > 0 ? (need / total) * 100 : 0,
      couldPct: total > 0 ? (could / total) * 100 : 0,
      wantPct: total > 0 ? (want / total) * 100 : 0,
    };
  }, [currentMonthExpenses, wallets, currencyCode, customExchangeRates]);

  // -------------------------------------------------------------
  // LINE CHART MATHEMATICS & DATA PREPARATION
  // Horizontal Axis: Days 1 to 30
  // Vertical Axis: Amounts 0 to 5000 with step 100
  // Two Lines: Current Month & Previous Month
  // -------------------------------------------------------------
  const {
    daysData,
    maxAmount,
    maxDaysCurrent,
    yScaleMax,
  } = useMemo(() => {
    // Collect day-by-day expenses for current and previous months (days 1 to 30)
    const currentByDay = new Array(31).fill(0);
    const prevByDay = new Array(31).fill(0);

    let maxDayWithTxCurrent = 0;

    currentMonthFilteredExpenses.forEach((t) => {
      const dayNum = parseInt(t.date.slice(8, 10), 10);
      if (dayNum >= 1 && dayNum <= 30) {
        currentByDay[dayNum] += t.amount;
        if (dayNum > maxDayWithTxCurrent) maxDayWithTxCurrent = dayNum;
      }
    });

    prevMonthFilteredExpenses.forEach((t) => {
      const dayNum = parseInt(t.date.slice(8, 10), 10);
      if (dayNum >= 1 && dayNum <= 30) {
        prevByDay[dayNum] += t.amount;
      }
    });

    // Determine current month active cutoff
    // Today is day 8 if 2026-10, or maxDayWithTxCurrent
    const now = new Date();
    const isCurrentCalendarMonth =
      currentMonthKey === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const todayDay = isCurrentCalendarMonth ? Math.min(now.getDate(), 30) : 30;
    const activeCutoffDay = Math.max(maxDayWithTxCurrent, todayDay, 1);

    const data: {
      day: number;
      currentDaily: number;
      currentCumulative: number;
      prevDaily: number;
      prevCumulative: number;
    }[] = [];

    let currentCum = 0;
    let prevCum = 0;

    for (let day = 1; day <= 30; day++) {
      const cDaily = currentByDay[day] || 0;
      const pDaily = prevByDay[day] || 0;

      if (day <= activeCutoffDay) {
        currentCum += cDaily;
      }
      prevCum += pDaily;

      data.push({
        day,
        currentDaily: cDaily,
        currentCumulative: day <= activeCutoffDay ? currentCum : currentCum,
        prevDaily: pDaily,
        prevCumulative: prevCum,
      });
    }

    // Determine peak amount for scaling
    // User requested vertical axis 0 to 5000 with step 100.
    // If expenses exceed 5000, scale gracefully with step 100, but default base is 5000.
    let peak = 0;
    data.forEach((d) => {
      if (chartMode === 'cumulative') {
        peak = Math.max(peak, d.prevCumulative, d.currentCumulative);
      } else {
        peak = Math.max(peak, d.prevDaily, d.currentDaily);
      }
    });

    // Base scale and step:
    // Cumulative mode: Limit 10k (10,000) with step 500
    // Daily mode: Limit 3,000 with step 50
    const baseLimit = chartMode === 'cumulative' ? 10000 : 3000;
    const step = chartMode === 'cumulative' ? 500 : 50;

    let yMax = baseLimit;
    if (peak > baseLimit) {
      yMax = Math.ceil(peak / step) * step;
    }

    return {
      daysData: data,
      maxAmount: peak,
      maxDaysCurrent: activeCutoffDay,
      yScaleMax: yMax,
    };
  }, [
    currentMonthFilteredExpenses,
    prevMonthFilteredExpenses,
    currentMonthKey,
    chartMode,
  ]);

  // SVG Geometry Dimensions
  const svgWidth = 720;
  const svgHeight = 310;
  const paddingLeft = 58;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 40;

  const chartAreaWidth = svgWidth - paddingLeft - paddingRight;
  const chartAreaHeight = svgHeight - paddingTop - paddingBottom;

  // Coordinate projection functions
  // Horizontal: day 1 to 30 mapped across chartAreaWidth
  const getX = (day: number) => {
    return paddingLeft + ((day - 1) / 29) * chartAreaWidth;
  };

  // Vertical: 0 to yScaleMax mapped across chartAreaHeight
  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(val, yScaleMax));
    return paddingTop + chartAreaHeight - (clamped / yScaleMax) * chartAreaHeight;
  };

  // Build SVG Paths for the two lines
  // 1. Previous Month Line (Days 1 to 30)
  const prevLinePoints = daysData.map((d) => ({
    x: getX(d.day),
    y: getY(chartMode === 'cumulative' ? d.prevCumulative : d.prevDaily),
  }));

  const prevPathD = prevLinePoints.reduce(
    (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    ''
  );

  // 2. Current Month Line (Days 1 to activeCutoffDay)
  const currentLinePoints = daysData
    .filter((d) => d.day <= maxDaysCurrent)
    .map((d) => ({
      x: getX(d.day),
      y: getY(chartMode === 'cumulative' ? d.currentCumulative : d.currentDaily),
      day: d.day,
      val: chartMode === 'cumulative' ? d.currentCumulative : d.currentDaily,
    }));

  const currentPathD = currentLinePoints.reduce(
    (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    ''
  );

  // Gradient Area Path for Current Month
  const currentAreaPathD =
    currentLinePoints.length > 0
      ? `${currentPathD} L ${currentLinePoints[currentLinePoints.length - 1].x} ${
          paddingTop + chartAreaHeight
        } L ${currentLinePoints[0].x} ${paddingTop + chartAreaHeight} Z`
      : '';

  // Step ticks and milestones calculation:
  // Cumulative mode: Limit 10k (10,000), step 500
  // Daily mode: Limit 3,000, step 50
  const yTicksStep = useMemo(() => {
    const ticks: {
      val: number;
      y: number;
      isMajor: boolean;
      isMid: boolean;
      label: string;
    }[] = [];
    const step = chartMode === 'cumulative' ? 500 : 50;

    for (let v = 0; v <= yScaleMax; v += step) {
      if (chartMode === 'cumulative') {
        const isMajor = v % 1000 === 0;
        const isMid = v % 500 === 0 && !isMajor;
        const label =
          v === 0
            ? '0'
            : v % 1000 === 0
            ? `${v / 1000}к`
            : `${(v / 1000).toFixed(1)}к`;
        ticks.push({
          val: v,
          y: getY(v),
          isMajor,
          isMid,
          label,
        });
      } else {
        const isMajor = v % 500 === 0;
        const isMid = v % 250 === 0 && !isMajor;
        ticks.push({
          val: v,
          y: getY(v),
          isMajor,
          isMid,
          label: String(v),
        });
      }
    }
    return ticks;
  }, [yScaleMax, chartMode, chartAreaHeight]);

  // Horizontal X-axis labels: days 1, 5, 10, 15, 20, 25, 30
  const xLabels = [1, 5, 10, 15, 20, 25, 30];

  // Mouse hover event handler on SVG
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    // Normalized x ratio
    const svgX = (clientX / rect.width) * svgWidth;
    if (svgX < paddingLeft - 10 || svgX > svgWidth - paddingRight + 10) {
      setHoveredDay(null);
      return;
    }
    const dayRatio = (svgX - paddingLeft) / chartAreaWidth;
    const day = Math.max(1, Math.min(30, Math.round(dayRatio * 29) + 1));
    setHoveredDay(day);
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
  };

  // Active hover info
  const activeHoverData = hoveredDay ? daysData[hoveredDay - 1] : null;
  const activeCurrentVal = activeHoverData
    ? chartMode === 'cumulative'
      ? activeHoverData.currentCumulative
      : activeHoverData.currentDaily
    : null;
  const activePrevVal = activeHoverData
    ? chartMode === 'cumulative'
      ? activeHoverData.prevCumulative
      : activeHoverData.prevDaily
    : null;
  const diffVal =
    activeCurrentVal !== null && activePrevVal !== null
      ? activeCurrentVal - activePrevVal
      : null;

  // Current vs Previous Month Overall Comparison Difference
  const overallDiff = totalExpenseCurrent - totalExpensePrev;
  const overallDiffPct =
    totalExpensePrev > 0
      ? ((overallDiff / totalExpensePrev) * 100).toFixed(1)
      : '0';

  return (
    <div className="flex flex-col gap-6 w-full max-w-full">
      {/* 1. FULL WIDTH WIDGET: Category Distribution & Priority Balance */}
      <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-xs overflow-hidden min-w-0 max-w-full flex flex-col justify-between">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900">
                  Структура витрат за категоріями
                </h2>
                {selectedCategoryFilter !== 'all' && (
                  <span className="rounded-md bg-blue-100 text-blue-800 px-2 py-0.5 text-xs font-semibold">
                    {selectedCategoryFilter}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {currentMonthLabel} · Натисніть на категорію для фільтрації динаміки нижче
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Pie vs Bar Chart Toggle */}
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setCategoryChartType('donut')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    categoryChartType === 'donut'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Кругова діаграма"
                >
                  <PieChart className="h-3.5 w-3.5" />
                  <span>Кругова</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryChartType('bar')}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    categoryChartType === 'bar'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Стовпчикова діаграма"
                >
                  <BarChart2 className="h-3.5 w-3.5" />
                  <span>Стовпчики</span>
                </button>
              </div>

              {selectedCategoryFilter !== 'all' && (
                <button
                  type="button"
                  onClick={() => onSelectCategory('all')}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 whitespace-nowrap shrink-0 transition-colors"
                  title="Скинути фільтр категорії"
                >
                  <span>Усі категорії</span>
                  <span className="text-[11px]">✕</span>
                </button>
              )}
            </div>
          </div>

          {/* Chart Display Area: Donut or Bar */}
          {categoryChartType === 'donut' ? (
            <div className="mt-6 flex flex-col md:flex-row items-center md:items-start gap-8 min-w-0">
              {/* SVG Donut Chart */}
              <div className="relative flex h-48 w-48 shrink-0 items-center justify-center">
                <svg className="h-48 w-48 -rotate-90 transform" viewBox="0 0 160 160">
                  <circle
                    cx="80"
                    cy="80"
                    r="64"
                    fill="transparent"
                    stroke="#f1f5f9"
                    strokeWidth="18"
                  />
                  {donutSegments.map((seg) => (
                    <circle
                      key={seg.name}
                      cx="80"
                      cy="80"
                      r={seg.radius}
                      fill="transparent"
                      stroke={seg.color}
                      strokeWidth={selectedCategoryFilter === seg.name ? '22' : '18'}
                      strokeDasharray={seg.strokeDasharray}
                      strokeDashoffset={seg.strokeDashoffset}
                      className="cursor-pointer transition-opacity duration-150 hover:opacity-85"
                      onClick={() =>
                        onSelectCategory(
                          selectedCategoryFilter === seg.name ? 'all' : seg.name
                        )
                      }
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-2">
                  <span className="text-xs text-slate-500 leading-tight">
                    {selectedCategoryFilter !== 'all' ? 'Категорія' : 'Всього витрат'}
                  </span>
                  <span className="mt-1 font-mono text-sm font-bold text-slate-900 tabular-nums">
                    {totalExpenseCurrent.toLocaleString('uk-UA')} {currencySymbol}
                  </span>
                </div>
              </div>

              {/* Full Width Categories List (names displayed fully without truncation) */}
              <div className="flex-1 w-full min-w-0 space-y-2">
                {categoryStats.length === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center">
                    Немає витрат у поточному місяці
                  </div>
                ) : (
                  categoryStats.map((cat) => {
                    const isSelected = selectedCategoryFilter === cat.name;
                    const isBranchOpen = expandedCatLegend === cat.name;
                    const subMap = subcategoriesByCat.get(cat.name);
                    const subEntries = subMap ? Array.from(subMap.entries()) : [];
                    const budgetCat = budgets.find((b) => b.name === cat.name);

                    return (
                      <div key={cat.name} className="space-y-1 w-full">
                        <div
                          className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition-colors gap-2 ${
                            isSelected
                              ? 'bg-blue-50 font-semibold text-blue-950 ring-1 ring-blue-200'
                              : 'hover:bg-slate-50 text-slate-700 bg-slate-50/40'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectCategory(isSelected ? 'all' : cat.name)}
                            className="flex items-center gap-2 min-w-0 flex-1 text-left"
                          >
                            <span
                              className="h-3 w-3 shrink-0 rounded-xs"
                              style={{ backgroundColor: cat.color }}
                            />
                            {budgetCat?.icon && <span className="text-sm shrink-0">{budgetCat.icon}</span>}
                            <span className="font-medium text-slate-900 break-words">
                              {cat.name}
                            </span>
                          </button>

                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 font-mono tabular-nums text-xs">
                            <span className="text-slate-900 font-bold whitespace-nowrap">
                              {cat.spent.toLocaleString('uk-UA')} {currencySymbol}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="w-10 text-right text-slate-500 font-semibold whitespace-nowrap">
                              {cat.sharePct.toFixed(1)}%
                            </span>

                            {subEntries.length > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedCatLegend(isBranchOpen ? null : cat.name);
                                }}
                                className="ml-1 px-1.5 py-0.5 rounded text-xs text-slate-500 hover:text-blue-700 hover:bg-slate-200/70 transition-colors flex items-center gap-1 shrink-0"
                                title={isBranchOpen ? 'Згорнути підкатегорії' : 'Відкрити підкатегорії'}
                              >
                                <span>{subEntries.length} підкат.</span>
                                {isBranchOpen ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expandable subcategory branch */}
                        {isBranchOpen && subEntries.length > 0 && (
                          <div className="ml-4 pl-3 pr-3 py-2 space-y-1.5 rounded-lg border border-slate-200/80 bg-slate-50/80 text-xs animate-fadeIn">
                            {subEntries.map(([sName, sAmt]) => {
                              const sPct = cat.spent > 0 ? (sAmt / cat.spent) * 100 : 0;
                              const subIcon = budgetCat?.subcategoryIcons?.[sName];
                              return (
                                <div
                                  key={sName}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-600 font-mono text-[11px] gap-1 py-0.5 border-b border-slate-200/40 last:border-b-0"
                                >
                                  <span className="break-words font-sans text-slate-800 pr-2 flex items-center gap-1.5">
                                    <span className="text-slate-400 font-mono text-xs">↳</span>
                                    {subIcon && <span className="text-sm shrink-0">{subIcon}</span>}
                                    <span>{sName}</span>
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0 tabular-nums">
                                    <span className="font-semibold text-slate-900">
                                      {sAmt.toLocaleString('uk-UA')} {currencySymbol}
                                    </span>
                                    <span className="text-slate-400 font-medium">
                                      ({sPct.toFixed(1)}%)
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* Bar Chart Display Mode */
            <div className="mt-6 w-full space-y-4">
              {categoryStats.length === 0 ? (
                <div className="text-xs text-slate-400 py-4 text-center">
                  Немає витрат у поточному місяці
                </div>
              ) : (
                <div className="space-y-3">
                  {categoryStats.map((cat) => {
                    const isSelected = selectedCategoryFilter === cat.name;
                    const isBranchOpen = expandedCatLegend === cat.name;
                    const subMap = subcategoriesByCat.get(cat.name);
                    const subEntries = subMap ? Array.from(subMap.entries()) : [];
                    const maxSpent = categoryStats[0]?.spent || 1;
                    const barWidthPct = Math.max(2, (cat.spent / maxSpent) * 100);

                    const budgetCat = budgets.find((b) => b.name === cat.name);

                    return (
                      <div
                        key={cat.name}
                        className={`rounded-lg border p-3 transition-colors ${
                          isSelected
                            ? 'border-blue-300 bg-blue-50/40'
                            : 'border-slate-100 bg-slate-50/30 hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs mb-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectCategory(isSelected ? 'all' : cat.name)}
                            className="flex items-center gap-2 text-left min-w-0"
                          >
                            <span
                              className="h-3 w-3 shrink-0 rounded-xs"
                              style={{ backgroundColor: cat.color }}
                            />
                            {budgetCat?.icon && <span className="text-sm shrink-0">{budgetCat.icon}</span>}
                            <span className="font-semibold text-slate-900 break-words">
                              {cat.name}
                            </span>
                          </button>

                          <div className="flex items-center gap-2 font-mono tabular-nums text-xs shrink-0">
                            <span className="font-bold text-slate-900">
                              {cat.spent.toLocaleString('uk-UA')} {currencySymbol}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500 font-semibold">
                              {cat.sharePct.toFixed(1)}% від усіх
                            </span>

                            {subEntries.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setExpandedCatLegend(isBranchOpen ? null : cat.name)}
                                className="ml-1 px-1.5 py-0.5 rounded text-xs text-slate-500 hover:text-blue-700 hover:bg-slate-200/70 transition-colors flex items-center gap-1"
                                title={isBranchOpen ? 'Згорнути підкатегорії' : 'Відкрити підкатегорії'}
                              >
                                <span>{subEntries.length} підкат.</span>
                                {isBranchOpen ? (
                                  <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Bar Track */}
                        <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${barWidthPct}%`,
                              backgroundColor: cat.color,
                            }}
                          />
                        </div>

                        {/* Expandable subcategory branch in Bar mode */}
                        {isBranchOpen && subEntries.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200/60 space-y-1.5 text-xs">
                            {subEntries.map(([sName, sAmt]) => {
                              const sPct = cat.spent > 0 ? (sAmt / cat.spent) * 100 : 0;
                              const subIcon = budgetCat?.subcategoryIcons?.[sName];
                              return (
                                <div
                                  key={sName}
                                  className="flex flex-col sm:flex-row sm:items-center justify-between text-slate-600 font-mono text-[11px] gap-1 pl-2"
                                >
                                  <span className="break-words font-sans text-slate-700 flex items-center gap-1.5">
                                    <span className="text-slate-400 font-mono text-xs">↳</span>
                                    {subIcon && <span className="text-sm shrink-0">{subIcon}</span>}
                                    <span>{sName}</span>
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0 tabular-nums">
                                    <span className="font-semibold text-slate-900">
                                      {sAmt.toLocaleString('uk-UA')} {currencySymbol}
                                    </span>
                                    <span className="text-slate-400 font-medium">
                                      ({sPct.toFixed(1)}%)
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Priority breakdown (Потрібно vs Можу vs Хочу) */}
        {priorityBreakdown.total > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-100 space-y-2.5 min-w-0">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
              <span>Пріоритетність витрат (Потрібно / Можу / Хочу)</span>
              <span className="text-slate-400 font-mono text-xs shrink-0">
                {priorityBreakdown.total.toLocaleString('uk-UA')} {currencySymbol}
              </span>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 flex">
              <div
                style={{ width: `${priorityBreakdown.needPct}%` }}
                className="bg-red-500"
                title={`Потрібно: ${priorityBreakdown.needPct.toFixed(1)}%`}
              />
              <div
                style={{ width: `${priorityBreakdown.couldPct}%` }}
                className="bg-amber-500"
                title={`Можу: ${priorityBreakdown.couldPct.toFixed(1)}%`}
              />
              <div
                style={{ width: `${priorityBreakdown.wantPct}%` }}
                className="bg-emerald-500"
                title={`Хочу: ${priorityBreakdown.wantPct.toFixed(1)}%`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1 font-mono min-w-0">
              <div className="rounded-lg bg-red-50/70 p-2.5 border border-red-100 min-w-0">
                <div className="text-xs text-red-800 font-sans font-semibold">
                  🔴 Потрібно (Обов'язкові)
                </div>
                <div className="font-bold text-red-900 text-sm mt-0.5">
                  {priorityBreakdown.needPct.toFixed(0)}%
                </div>
                <div className="text-xs text-red-700">
                  {priorityBreakdown.need.toLocaleString('uk-UA')} {currencySymbol}
                </div>
              </div>
              <div className="rounded-lg bg-amber-50/70 p-2.5 border border-amber-100 min-w-0">
                <div className="text-xs text-amber-800 font-sans font-semibold">
                  🟡 Можу (Оптимізація)
                </div>
                <div className="font-bold text-amber-900 text-sm mt-0.5">
                  {priorityBreakdown.couldPct.toFixed(0)}%
                </div>
                <div className="text-xs text-amber-700">
                  {priorityBreakdown.could.toLocaleString('uk-UA')} {currencySymbol}
                </div>
              </div>
              <div className="rounded-lg bg-emerald-50/70 p-2.5 border border-emerald-100 min-w-0">
                <div className="text-xs text-emerald-800 font-sans font-semibold">
                  🟢 Хочу (Бажання)
                </div>
                <div className="font-bold text-emerald-900 text-sm mt-0.5">
                  {priorityBreakdown.wantPct.toFixed(0)}%
                </div>
                <div className="text-xs text-emerald-700">
                  {priorityBreakdown.want.toLocaleString('uk-UA')} {currencySymbol}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. FULL WIDTH WIDGET: REAL-TIME LINE CHART WITH COMPARISON */}
      <div className="w-full rounded-xl border border-slate-200 bg-white p-6 shadow-xs overflow-hidden min-w-0 max-w-full flex flex-col justify-between">
        <div>
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-slate-900 truncate">
                  Динаміка витрат у реальному часі
                </h2>
                {selectedCategoryFilter !== 'all' && (
                  <span className="rounded-md bg-blue-100 text-blue-800 px-2 py-0.5 text-[11px] font-semibold truncate max-w-[140px]">
                    {selectedCategoryFilter}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate-500 truncate">
                Порівняння двох місяців: {currentMonthLabel} vs {previousMonthLabel}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0 self-start">
              {/* Cumulative vs Daily Toggle */}
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setChartMode('cumulative')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    chartMode === 'cumulative'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Накопичувальна динаміка з початку місяця"
                >
                  Накопичувальна
                </button>
                <button
                  type="button"
                  onClick={() => setChartMode('daily')}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                    chartMode === 'daily'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Витрати за окремими днями"
                >
                  За днями
                </button>
              </div>
            </div>
          </div>

          {/* Quick Comparison Bar */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 pb-3 border-b border-slate-100 min-w-0">
            {/* Metric 1: Current Month */}
            <div className="min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />
                <span className="truncate">{currentMonthLabel}</span>
              </div>
              <div className="mt-0.5 font-mono text-sm font-bold text-blue-700 tabular-nums truncate">
                {totalExpenseCurrent.toLocaleString('uk-UA')} {currencySymbol}
              </div>
            </div>

            {/* Metric 2: Previous Month */}
            <div className="min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <span className="h-2 w-2 rounded-full bg-slate-400 shrink-0" />
                <span className="truncate">{previousMonthLabel}</span>
              </div>
              <div className="mt-0.5 font-mono text-sm font-semibold text-slate-700 tabular-nums truncate">
                {totalExpensePrev.toLocaleString('uk-UA')} {currencySymbol}
              </div>
            </div>

            {/* Metric 3: Difference */}
            <div className="min-w-0 overflow-hidden">
              <div className="text-[11px] text-slate-500 truncate">Різниця до минулого міс.</div>
              <div
                className={`mt-0.5 font-mono text-sm font-bold tabular-nums truncate flex items-center gap-1 ${
                  overallDiff > 0 ? 'text-red-600' : 'text-emerald-600'
                }`}
              >
                {overallDiff > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>
                  {overallDiff >= 0 ? `+` : ''}
                  {overallDiff.toLocaleString('uk-UA')} {currencySymbol}
                </span>
              </div>
            </div>

            {/* Metric 4: Scale & Range Info */}
            <div className="min-w-0 overflow-hidden">
              <div className="text-[11px] text-slate-500 truncate">Вісь Y / Шаг</div>
              <div className="mt-0.5 font-mono text-xs font-semibold text-slate-800 tabular-nums truncate">
                0 – {yScaleMax >= 1000 && yScaleMax % 1000 === 0 ? `${yScaleMax / 1000}к` : yScaleMax.toLocaleString('uk-UA')} {currencySymbol} (шаг {chartMode === 'cumulative' ? 500 : 50})
              </div>
            </div>
          </div>

          {/* Hover Status Banner */}
          <div className="mt-3 flex items-center justify-between text-xs h-6 px-1">
            {hoveredDay ? (
              <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] tabular-nums text-slate-800 animate-fadeIn">
                <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                  День {hoveredDay}
                </span>
                <span className="flex items-center gap-1 text-blue-700 font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  {currentMonthLabel.slice(0, 3)}: {activeCurrentVal?.toLocaleString('uk-UA')}{' '}
                  {currencySymbol}
                </span>
                <span className="flex items-center gap-1 text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  {previousMonthLabel.slice(0, 3)}: {activePrevVal?.toLocaleString('uk-UA')}{' '}
                  {currencySymbol}
                </span>
                {diffVal !== null && (
                  <span
                    className={`font-semibold ${
                      diffVal > 0 ? 'text-red-600' : 'text-emerald-700'
                    }`}
                  >
                    Δ {diffVal >= 0 ? `+` : ''}
                    {diffVal.toLocaleString('uk-UA')} {currencySymbol}
                  </span>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400">
                Наведіть курсор на графік для перегляду детальних сум за кожен день (1-30)
              </div>
            )}

            {/* Chart Legend */}
            <div className="flex items-center gap-3 text-[11px] shrink-0 font-medium text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="h-0.5 w-3.5 bg-blue-600 rounded" />
                <span>Поточний місяць</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-0.5 w-3.5 border-b-2 border-dashed border-slate-400" />
                <span>Попередній місяць</span>
              </div>
            </div>
          </div>

          {/* SVG Line Graph Container */}
          <div className="mt-2 w-full overflow-hidden select-none">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto max-h-[300px] cursor-crosshair overflow-visible"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            >
              <defs>
                {/* Gradient for Current Month Area Fill */}
                <linearGradient id="currentMonthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
                  <stop offset="80%" stopColor="#2563eb" stopOpacity="0.04" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.00" />
                </linearGradient>

                {/* Subtle Glow Filter for Active Line */}
                <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow
                    dx="0"
                    dy="1"
                    stdDeviation="1.5"
                    floodColor="#2563eb"
                    floodOpacity="0.25"
                  />
                </filter>
              </defs>

              {/* Background Chart Grid */}
              <rect
                x={paddingLeft}
                y={paddingTop}
                width={chartAreaWidth}
                height={chartAreaHeight}
                fill="#fafbfd"
                rx="6"
              />

              {/* Horizontal Axis Gridlines & Tick Notches */}
              {yTicksStep.map((tick) => {
                if (tick.isMajor) {
                  return (
                    <g key={tick.val}>
                      {/* Major Gridline */}
                      <line
                        x1={paddingLeft}
                        y1={tick.y}
                        x2={paddingLeft + chartAreaWidth}
                        y2={tick.y}
                        stroke="#e2e8f0"
                        strokeWidth="1"
                      />
                      {/* Step tick on Y-axis bar */}
                      <line
                        x1={paddingLeft - 6}
                        y1={tick.y}
                        x2={paddingLeft}
                        y2={tick.y}
                        stroke="#64748b"
                        strokeWidth="1.5"
                      />
                      {/* Y-axis Label */}
                      <text
                        x={paddingLeft - 10}
                        y={tick.y + 3.5}
                        textAnchor="end"
                        className="font-mono text-[10px] font-medium fill-slate-500 tabular-nums"
                      >
                        {tick.label}
                      </text>
                    </g>
                  );
                }

                if (tick.isMid) {
                  return (
                    <g key={tick.val}>
                      {/* Mid Gridline */}
                      <line
                        x1={paddingLeft}
                        y1={tick.y}
                        x2={paddingLeft + chartAreaWidth}
                        y2={tick.y}
                        stroke="#f1f5f9"
                        strokeDasharray="3 3"
                        strokeWidth="1"
                      />
                      {/* Step tick on Y-axis bar */}
                      <line
                        x1={paddingLeft - 4}
                        y1={tick.y}
                        x2={paddingLeft}
                        y2={tick.y}
                        stroke="#94a3b8"
                        strokeWidth="1"
                      />
                      <text
                        x={paddingLeft - 8}
                        y={tick.y + 3.5}
                        textAnchor="end"
                        className="font-mono text-[9px] fill-slate-400 tabular-nums"
                      >
                        {tick.label}
                      </text>
                    </g>
                  );
                }

                // Micro step tick on the Y-axis bar (step 500 in cumulative, step 50 in daily)
                return (
                  <line
                    key={tick.val}
                    x1={paddingLeft - 2.5}
                    y1={tick.y}
                    x2={paddingLeft}
                    y2={tick.y}
                    stroke="#cbd5e1"
                    strokeWidth="0.75"
                  />
                );
              })}

              {/* Vertical Gridlines for Days 1, 5, 10, 15, 20, 25, 30 */}
              {xLabels.map((day) => {
                const x = getX(day);
                return (
                  <g key={day}>
                    <line
                      x1={x}
                      y1={paddingTop}
                      x2={x}
                      y2={paddingTop + chartAreaHeight}
                      stroke="#f1f5f9"
                      strokeWidth="1"
                    />
                    <line
                      x1={x}
                      y1={paddingTop + chartAreaHeight}
                      x2={x}
                      y2={paddingTop + chartAreaHeight + 5}
                      stroke="#94a3b8"
                      strokeWidth="1"
                    />
                    <text
                      x={x}
                      y={paddingTop + chartAreaHeight + 18}
                      textAnchor="middle"
                      className="font-mono text-[10px] font-medium fill-slate-600 tabular-nums"
                    >
                      {day}
                    </text>
                  </g>
                );
              })}

              {/* Baseline Axes Lines */}
              <line
                x1={paddingLeft}
                y1={paddingTop + chartAreaHeight}
                x2={paddingLeft + chartAreaWidth}
                y2={paddingTop + chartAreaHeight}
                stroke="#94a3b8"
                strokeWidth="1.5"
              />
              <line
                x1={paddingLeft}
                y1={paddingTop}
                x2={paddingLeft}
                y2={paddingTop + chartAreaHeight}
                stroke="#94a3b8"
                strokeWidth="1.5"
              />

              {/* Axis Names / Units */}
              <text
                x={paddingLeft + chartAreaWidth}
                y={paddingTop + chartAreaHeight + 32}
                textAnchor="end"
                className="text-[10px] font-medium fill-slate-500"
              >
                День місяця (1–30) →
              </text>
              <text
                x={paddingLeft - 8}
                y={paddingTop - 10}
                textAnchor="start"
                className="text-[10px] font-medium fill-slate-500"
              >
                {currencySymbol} (0–{yScaleMax >= 1000 && yScaleMax % 1000 === 0 ? `${yScaleMax / 1000}к` : yScaleMax.toLocaleString('uk-UA')})
              </text>

              {/* LINE 1: PREVIOUS MONTH (Dashed Line, Slate) */}
              {prevPathD && (
                <path
                  d={prevPathD}
                  fill="none"
                  stroke="#64748b"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* PREVIOUS MONTH CIRCULAR DATA POINTS */}
              {prevLinePoints
                .filter((_, idx) => (idx + 1) % 5 === 0 || idx === 0 || idx === 29)
                .map((pt, idx) => (
                  <circle
                    key={idx}
                    cx={pt.x}
                    cy={pt.y}
                    r="2.5"
                    fill="#ffffff"
                    stroke="#64748b"
                    strokeWidth="1.5"
                  />
                ))}

              {/* LINE 2: CURRENT MONTH GRADIENT AREA UNDER LINE */}
              {currentAreaPathD && (
                <path d={currentAreaPathD} fill="url(#currentMonthGradient)" />
              )}

              {/* LINE 2: CURRENT MONTH (Solid Line, Vibrant Blue) */}
              {currentPathD && (
                <path
                  d={currentPathD}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#lineGlow)"
                />
              )}

              {/* CURRENT MONTH CIRCULAR DATA POINTS */}
              {currentLinePoints.map((pt) => {
                const isHovered = hoveredDay === pt.day;
                const isLatest = pt.day === maxDaysCurrent;

                return (
                  <circle
                    key={pt.day}
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? '5' : isLatest ? '4.5' : '3'}
                    fill={isLatest ? '#2563eb' : '#ffffff'}
                    stroke="#2563eb"
                    strokeWidth={isHovered ? '2.5' : '2'}
                    className="transition-all duration-100"
                  />
                );
              })}

              {/* HOVER CROSSHAIR & HIGHLIGHT MARKERS */}
              {hoveredDay && (
                <g>
                  {/* Vertical Guideline */}
                  <line
                    x1={getX(hoveredDay)}
                    y1={paddingTop}
                    x2={getX(hoveredDay)}
                    y2={paddingTop + chartAreaHeight}
                    stroke="#3b82f6"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />

                  {/* Highlight on Current Month Point */}
                  {hoveredDay <= maxDaysCurrent && activeCurrentVal !== null && (
                    <circle
                      cx={getX(hoveredDay)}
                      cy={getY(activeCurrentVal)}
                      r="5.5"
                      fill="#2563eb"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  )}

                  {/* Highlight on Previous Month Point */}
                  {activePrevVal !== null && (
                    <circle
                      cx={getX(hoveredDay)}
                      cy={getY(activePrevVal)}
                      r="5"
                      fill="#64748b"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  )}
                </g>
              )}
            </svg>
          </div>
        </div>

        {/* Bottom Chart Footer Status */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Синхронізація в реальному часі · Оновлюється миттєво при додаванні нових транзакцій
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-600 tabular-nums">
              Горизонтальна вісь: дні 1–30 · Вертикальна вісь: 0–{yScaleMax >= 1000 && yScaleMax % 1000 === 0 ? `${yScaleMax / 1000}к` : yScaleMax.toLocaleString('uk-UA')} {currencySymbol} (крок {chartMode === 'cumulative' ? '500' : '50'})
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
