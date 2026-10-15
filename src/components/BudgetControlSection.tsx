import React, { useState, useEffect, useMemo } from 'react';
import { BudgetCategory, TransactionItem, WalletItem, WorkHourEntry } from '../types/finance';
import {
  Download,
  Mail,
  CalendarPlus,
  Check,
  Edit3,
  Sparkles,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  FolderTree,
  Trash2,
  Plus,
  X,
  Palette,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  FileText,
} from 'lucide-react';
import { exportBudgetsReportToCsv } from '../utils/csvExport';
import { exportFinancialReportToPdf } from '../utils/pdfExport';
import { MathAmountInput } from './MathAmountInput';
import { IconPickerModal } from './IconPickerModal';

interface BudgetControlSectionProps {
  monthlyBudgets: Record<string, Record<string, number>>;
  onUpdateMonthBudget: (month: string, categoryLimits: Record<string, number>) => void;
  budgets: BudgetCategory[];
  transactions: TransactionItem[];
  currencySymbol: string;
  currencyCode: string;
  selectedMonth: string; // YYYY-MM
  notificationEmail: string;
  autoEmailBudgetAlerts: boolean;
  onSelectMonth: (monthKey: string) => void;
  onUpdateEmailAlertSettings: (email: string, autoSend: boolean) => void;
  onSendBudgetEmailAlert?: (
    budget: BudgetCategory,
    spent: number,
    limit: number
  ) => void;
  onNavigateToCategories?: () => void;
  onAddExpenseCategory?: (category: BudgetCategory) => void;
  onUpdateExpenseCategory?: (updated: BudgetCategory, oldName?: string) => void;
  onDeleteExpenseCategory?: (id: string, reassignToName?: string) => void;
  wallets?: WalletItem[];
  workLogs?: WorkHourEntry[];
}

export const PRESET_CATEGORY_COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#10b981',
  '#06b6d4',
  '#2563eb',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
];

export const PRESET_CATEGORY_ICONS = [
  '🛒', '🏠', '🚗', '🍽️', '💊', '✈️', '🎮', '👗', '📚', '💡', '🐾', '🎁', '⚡', '🏋️', '☕', '🏷️'
];

export const AVAILABLE_MONTHS = [
  { key: '2026-08', label: 'Серпень 2026' },
  { key: '2026-09', label: 'Вересень 2026' },
  { key: '2026-10', label: 'Жовтень 2026 (Поточний)' },
  { key: '2026-11', label: 'Листопад 2026' },
  { key: '2026-12', label: 'Грудень 2026' },
  { key: '2027-01', label: 'Січень 2027' },
];

export function getPreviousMonthKey(monthKey: string): string {
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

export function getNextMonthKey(monthKey: string): string {
  const [yStr, mStr] = monthKey.split('-');
  let y = parseInt(yStr, 10);
  let m = parseInt(mStr, 10);
  if (isNaN(y) || isNaN(m)) return '2026-11';
  m += 1;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return `${y}-${String(m).padStart(2, '0')}`;
}

export function formatMonthName(monthKey: string): string {
  try {
    const [y, m] = monthKey.split('-').map(Number);
    const monthNames = [
      'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
      'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
    ];
    if (m >= 1 && m <= 12) {
      return `${monthNames[m - 1]} ${y}`;
    }
  } catch {}
  return monthKey;
}

export function getCategoryLimitForMonth(
  category: BudgetCategory,
  monthKey: string,
  monthlyBudgets?: Record<string, Record<string, number>>
): number {
  if (monthlyBudgets && monthlyBudgets[monthKey] && monthlyBudgets[monthKey][category.name] !== undefined) {
    return monthlyBudgets[monthKey][category.name];
  }
  if (category.monthlyLimitsByMonth && category.monthlyLimitsByMonth[monthKey] !== undefined) {
    return category.monthlyLimitsByMonth[monthKey];
  }
  return category.monthlyLimit || 500;
}

export const BudgetControlSection: React.FC<BudgetControlSectionProps> = ({
  monthlyBudgets,
  onUpdateMonthBudget,
  budgets,
  transactions,
  currencySymbol,
  currencyCode,
  selectedMonth,
  notificationEmail,
  autoEmailBudgetAlerts,
  onSelectMonth,
  onUpdateEmailAlertSettings,
  onSendBudgetEmailAlert,
  onNavigateToCategories,
  onAddExpenseCategory,
  onUpdateExpenseCategory,
  onDeleteExpenseCategory,
  wallets = [],
  workLogs = [],
}) => {
  // Inline edit state for category limit in this specific month
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);
  const [editLimitInput, setEditLimitInput] = useState('');
  const [emailInput, setEmailInput] = useState(notificationEmail);
  const [autoCreatedNotice, setAutoCreatedNotice] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  // PDF Export
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportFinancialReportToPdf({
        month: selectedMonth,
        currencySymbol,
        currencyCode,
        transactions,
        budgets,
        wallets,
        workLogs,
        monthlyBudgets,
      });
    } catch (err: any) {
      alert(err?.message || 'Помилка генерації PDF-звіту');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Expandable subcategory tree state
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const toggleCategoryBranch = (catName: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(catName)) {
        next.delete(catName);
      } else {
        next.add(catName);
      }
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (expandedCategories.size === budgets.length) {
      setExpandedCategories(new Set());
    } else {
      setExpandedCategories(new Set(budgets.map((b) => b.name)));
    }
  };

  // Add Category Modal State
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatMonthlyLimit, setNewCatMonthlyLimit] = useState('500');
  const [newCatColor, setNewCatColor] = useState('#2563eb');
  const [newCatIcon, setNewCatIcon] = useState('🏷️');
  const [newCatSubcategories, setNewCatSubcategories] = useState<string[]>(['Загальна']);
  const [newSubInput, setNewSubInput] = useState('');

  // Category Edit / Delete Modal State
  const [editingCategoryObj, setEditingCategoryObj] = useState<BudgetCategory | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatColor, setEditCatColor] = useState('');
  const [editCatIcon, setEditCatIcon] = useState('🏷️');
  const [editCatMonthlyLimit, setEditCatMonthlyLimit] = useState('500');
  const [editCatSubcategoriesList, setEditCatSubcategoriesList] = useState<string[]>([]);
  const [editCatSubcategoryIcons, setEditCatSubcategoryIcons] = useState<Record<string, string>>({});
  const [subcatIconPicker, setSubcatIconPicker] = useState<{ isOpen: boolean; subName: string; currentIcon: string } | null>(null);
  const [editNewSubInput, setEditNewSubInput] = useState('');
  const [deletingCategoryObj, setDeletingCategoryObj] = useState<BudgetCategory | null>(null);
  const [reassignTarget, setReassignTarget] = useState<string>('');

  // Auto-create budget for selectedMonth from previous month if not yet present
  useEffect(() => {
    if (!monthlyBudgets[selectedMonth]) {
      const prevKey = getPreviousMonthKey(selectedMonth);
      const prevBudget = monthlyBudgets[prevKey];

      const clonedLimits: Record<string, number> = {};
      budgets.forEach((cat) => {
        if (prevBudget && prevBudget[cat.name] !== undefined) {
          clonedLimits[cat.name] = prevBudget[cat.name];
        } else if (cat.monthlyLimit > 0) {
          clonedLimits[cat.name] = cat.monthlyLimit;
        } else {
          clonedLimits[cat.name] = 500;
        }
      });

      onUpdateMonthBudget(selectedMonth, clonedLimits);
      setAutoCreatedNotice(
        `Бюджет на ${formatMonthName(selectedMonth)} автоматично сформовано на основі попереднього місяця (${formatMonthName(prevKey)}). Ви можете вільно редагувати суми нижче.`
      );
    } else {
      setAutoCreatedNotice(null);
    }
  }, [selectedMonth, monthlyBudgets, budgets, onUpdateMonthBudget]);

  const currentMonthLimits = useMemo(() => {
    return monthlyBudgets[selectedMonth] || {};
  }, [monthlyBudgets, selectedMonth]);

  // Transactions filtered for this month
  const monthTransactions = useMemo(() => {
    return transactions.filter(
      (t) => t.type === 'expense' && t.date.startsWith(selectedMonth)
    );
  }, [transactions, selectedMonth]);

  // Aggregate spending by category and subcategory for this month
  const { categorySpending, subcategorySpending } = useMemo(() => {
    const catMap = new Map<string, number>();
    const subMap = new Map<string, Map<string, number>>();

    monthTransactions.forEach((tx) => {
      // Add to category total
      catMap.set(tx.category, (catMap.get(tx.category) || 0) + tx.amount);

      // Subcategory breakdown
      if (!subMap.has(tx.category)) {
        subMap.set(tx.category, new Map<string, number>());
      }
      const catSubMap = subMap.get(tx.category)!;

      if (tx.splits && tx.splits.length > 0) {
        tx.splits.forEach((sp) => {
          const sName = sp.subcategory?.trim() || 'Без підкатегорії';
          catSubMap.set(sName, (catSubMap.get(sName) || 0) + sp.amount);
        });
      } else {
        const sName = tx.subcategory?.trim() || 'Без підкатегорії';
        catSubMap.set(sName, (catSubMap.get(sName) || 0) + tx.amount);
      }
    });

    return { categorySpending: catMap, subcategorySpending: subMap };
  }, [monthTransactions]);

  // Overall totals for selected month
  const totalBudgetLimit = useMemo(() => {
    return budgets.reduce((sum, cat) => {
      const lim = currentMonthLimits[cat.name] ?? cat.monthlyLimit ?? 500;
      return sum + lim;
    }, 0);
  }, [budgets, currentMonthLimits]);

  const totalSpent = useMemo(() => {
    return monthTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [monthTransactions]);

  const remainingBudget = totalBudgetLimit - totalSpent;
  const utilizationPct = totalBudgetLimit > 0 ? (totalSpent / totalBudgetLimit) * 100 : 0;

  // Save inline edited limit for category in THIS month
  const handleSaveCategoryLimit = (catName: string) => {
    const val = parseFloat(editLimitInput);
    if (!isNaN(val) && val >= 0) {
      const updated = {
        ...currentMonthLimits,
        [catName]: val,
      };
      onUpdateMonthBudget(selectedMonth, updated);
    }
    setEditingCategoryName(null);
  };

  // Generate / Clone budget for Next Month
  const handleCloneToNextMonth = () => {
    const nextKey = getNextMonthKey(selectedMonth);
    const cloned = { ...currentMonthLimits };
    onUpdateMonthBudget(nextKey, cloned);
    onSelectMonth(nextKey);
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* 1. Header, Month Switcher & Quick Navigation */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight truncate">
              Місячний бюджет: {formatMonthName(selectedMonth)}
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Бюджет формується для кожного місяця окремо. Ліміти на новий місяць автоматично наслідуються з попереднього з можливістю редагування.
            </p>
          </div>

          {/* Month Selector & Next Month Clone */}
          <div className="flex flex-wrap items-center gap-2 self-start">
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-1">
              <select
                value={selectedMonth}
                onChange={(e) => onSelectMonth(e.target.value)}
                className="rounded-md border-0 bg-transparent px-2.5 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none cursor-pointer"
              >
                {AVAILABLE_MONTHS.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleCloneToNextMonth}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-2xs whitespace-nowrap"
              title="Створити та перейти до бюджету наступного місяця"
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              <span>Наступний місяць</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
              title={`Завантажити офіційний звіт за ${formatMonthName(selectedMonth)} у форматі PDF`}
            >
              <FileText className={`h-3.5 w-3.5 ${isExportingPdf ? 'animate-bounce' : ''}`} />
              <span>{isExportingPdf ? 'Створення PDF...' : 'Завантажити звіт (PDF)'}</span>
            </button>
          </div>
        </div>

        {/* Auto-creation notice banner */}
        {autoCreatedNotice && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-900 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
              <span>{autoCreatedNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setAutoCreatedNotice(null)}
              className="text-blue-700 hover:underline text-[11px]"
            >
              Зрозуміло
            </button>
          </div>
        )}

        {/* Month Summary KPI Cards */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 min-w-0 overflow-hidden">
            <div className="text-xs text-slate-500 font-medium truncate">
              Запланований бюджет ({formatMonthName(selectedMonth)})
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums truncate">
              {totalBudgetLimit.toLocaleString('uk-UA')} {currencySymbol}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Сума лімітів по {budgets.length} категоріях
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 min-w-0 overflow-hidden">
            <div className="text-xs text-slate-500 font-medium truncate">
              Фактично витрачено
            </div>
            <div className="mt-1 font-mono text-xl font-bold text-slate-900 tabular-nums truncate">
              {totalSpent.toLocaleString('uk-UA')} {currencySymbol}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono">
              {utilizationPct.toFixed(1)}% від бюджету місяця
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 min-w-0 overflow-hidden">
            <div className="text-xs text-slate-500 font-medium truncate">
              Залишок бюджету
            </div>
            <div
              className={`mt-1 font-mono text-xl font-bold tabular-nums truncate ${
                remainingBudget < 0 ? 'text-red-600' : 'text-emerald-700'
              }`}
            >
              {remainingBudget >= 0 ? '+' : ''}
              {remainingBudget.toLocaleString('uk-UA')} {currencySymbol}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              {remainingBudget >= 0 ? (
                <span className="text-emerald-700 font-medium flex items-center gap-0.5">
                  <TrendingDown className="h-3 w-3" /> У межах норми
                </span>
              ) : (
                <span className="text-red-600 font-medium flex items-center gap-0.5">
                  <AlertTriangle className="h-3 w-3" /> Перевищення плану
                </span>
              )}
            </div>
          </div>

          {/* Email Alert Setup Box */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 min-w-0 overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 truncate">
                <Mail className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span className="truncate">Email-сповіщення</span>
              </div>
              <label className="inline-flex items-center gap-1 text-[11px] text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoEmailBudgetAlerts}
                  onChange={(e) =>
                    onUpdateEmailAlertSettings(emailInput, e.target.checked)
                  }
                  className="rounded border-slate-300 h-3.5 w-3.5"
                />
                <span>Авто</span>
              </label>
            </div>
            <div className="mt-2 flex gap-1.5">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="email@gmail.com"
                className="flex-1 min-w-0 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 focus:outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  onUpdateEmailAlertSettings(emailInput.trim(), autoEmailBudgetAlerts)
                }
                className="rounded bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
              >
                Зберегти
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Monthly Budget Table: Category Limits & Utilization */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Ліміти за категоріями на {formatMonthName(selectedMonth)}
            </h2>
            <p className="text-xs text-slate-500">
              Клацніть на ліміт будь-якої категорії, щоб відредагувати суму виключно для цього місяця.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setNewCatName('');
              setNewCatMonthlyLimit('500');
              setNewCatColor('#2563eb');
              setNewCatIcon('🏷️');
              setNewCatSubcategories(['Загальна']);
              setNewSubInput('');
              setIsAddCategoryModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs self-start"
          >
            <Plus className="h-4 w-4" />
            <span>+ Створити категорію</span>
          </button>
        </div>

        <div className="overflow-x-auto min-w-0 max-w-full">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 pl-4 pr-4">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleExpandAll}
                      className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 shadow-2xs transition-colors"
                      title={expandedCategories.size === budgets.length ? 'Згорнути всі підкатегорії' : 'Розгорнути всі підкатегорії'}
                    >
                      {expandedCategories.size === budgets.length ? (
                        <>
                          <ChevronDown className="h-3 w-3 text-blue-600" />
                          <span>Згорнути всі</span>
                        </>
                      ) : (
                        <>
                          <ChevronRight className="h-3 w-3 text-slate-500" />
                          <span>Гілки підкатегорій</span>
                        </>
                      )}
                    </button>
                    <span>Категорія</span>
                  </div>
                </th>
                <th className="px-4 py-3 text-right">Ліміт на {formatMonthName(selectedMonth)}</th>
                <th className="px-4 py-3 text-right">Витрачено</th>
                <th className="px-4 py-3 text-right">Залишок</th>
                <th className="px-4 py-3 w-56">Прогрес ліміту</th>
                <th className="py-3 pl-4 pr-6 text-right">Дія</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {budgets.map((cat) => {
                const limit = currentMonthLimits[cat.name] ?? cat.monthlyLimit ?? 500;
                const spent = categorySpending.get(cat.name) || 0;
                const remaining = limit - spent;
                const pct = limit > 0 ? (spent / limit) * 100 : 0;
                const isOver = limit > 0 && pct > 100;
                const isWarning = limit > 0 && !isOver && pct >= (cat.alertThresholdPercent || 80);

                const isEditingThis = editingCategoryName === cat.name;
                const isExpanded = expandedCategories.has(cat.name);

                const catSubMap = subcategorySpending.get(cat.name) || new Map<string, number>();
                const allSubNames = Array.from(
                  new Set([
                    ...cat.subcategories,
                    ...Array.from(catSubMap.keys()),
                  ])
                );

                return (
                  <React.Fragment key={cat.id}>
                    <tr className={`hover:bg-slate-50/50 transition-colors ${isExpanded ? 'bg-blue-50/20' : ''}`}>
                      {/* Category Info */}
                      <td className="py-3 pl-4 pr-4 align-top">
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => toggleCategoryBranch(cat.name)}
                            className="mt-0.5 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-colors"
                            title={isExpanded ? 'Згорнути гілку підкатегорій' : 'Розгорнути гілку підкатегорій'}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 text-blue-600" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            )}
                          </button>

                          <span
                            className="mt-1 h-3.5 w-3.5 rounded-full shrink-0 shadow-2xs"
                            style={{ backgroundColor: cat.color || '#2563eb' }}
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              {cat.icon && <span className="text-sm shrink-0">{cat.icon}</span>}
                              <span
                                onClick={() => toggleCategoryBranch(cat.name)}
                                className="font-semibold text-slate-900 text-xs truncate cursor-pointer hover:text-blue-600"
                              >
                                {cat.name}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                {allSubNames.length} підкат.
                              </span>
                            </div>

                            <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500">
                              {cat.subcategories.slice(0, 3).map((sub) => {
                                const sIcon = cat.subcategoryIcons?.[sub];
                                return (
                                  <span
                                    key={sub}
                                    className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.2 font-mono"
                                  >
                                    {sIcon && <span>{sIcon}</span>}
                                    <span>{sub}</span>
                                  </span>
                                );
                              })}
                              {cat.subcategories.length > 3 && (
                                <span className="text-slate-400">
                                  +{cat.subcategories.length - 3}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Limit for This Month (Editable Inline) */}
                      <td className="px-4 py-3.5 text-right font-mono align-top">
                        {isEditingThis ? (
                          <div className="flex items-center justify-end gap-1">
                            <MathAmountInput
                              value={editLimitInput}
                              onChange={setEditLimitInput}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveCategoryLimit(cat.name);
                                if (e.key === 'Escape') setEditingCategoryName(null);
                              }}
                              autoFocus
                              className="w-24 rounded border border-slate-300 bg-white px-2 py-0.5 text-right text-xs font-mono font-bold text-slate-900 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveCategoryLimit(cat.name)}
                              className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                              title="Зберегти ліміт на цей місяць"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingCategoryName(cat.name);
                              setEditLimitInput(String(limit));
                            }}
                            className="cursor-pointer group flex items-center justify-end gap-1 hover:text-blue-600"
                            title="Клацніть для зміни ліміту на цей місяць"
                          >
                            <span className="font-bold text-slate-900 text-xs">
                              {limit.toLocaleString('uk-UA')} {currencySymbol}
                            </span>
                            <Edit3 className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </td>

                      {/* Spent (Total category sum by default) */}
                      <td className="px-4 py-3.5 text-right font-mono align-top text-xs font-bold text-slate-800">
                        {spent.toLocaleString('uk-UA')} {currencySymbol}
                      </td>

                      {/* Remaining */}
                      <td className="px-4 py-3.5 text-right font-mono align-top text-xs font-semibold">
                        <span className={remaining < 0 ? 'text-red-600' : 'text-emerald-700'}>
                          {remaining >= 0 ? '+' : ''}
                          {remaining.toLocaleString('uk-UA')} {currencySymbol}
                        </span>
                      </td>

                      {/* Progress Bar & Status */}
                      <td className="px-4 py-3.5 align-top">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span
                              className={
                                isOver
                                  ? 'text-red-700 font-bold'
                                  : isWarning
                                  ? 'text-amber-700 font-semibold'
                                  : 'text-slate-500'
                              }
                            >
                              {isOver ? 'Перевищено' : isWarning ? 'Увага' : 'У нормі'}
                            </span>
                            <span className="font-mono text-slate-600 font-medium">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              style={{ width: `${Math.min(pct, 100)}%` }}
                              className={`h-full rounded-full transition-all ${
                                isOver
                                  ? 'bg-red-600'
                                  : isWarning
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-600'
                              }`}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pl-4 pr-6 text-right align-top whitespace-nowrap">
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategoryObj(cat);
                              setEditCatName(cat.name);
                              setEditCatColor(cat.color || '#2563eb');
                              setEditCatIcon(cat.icon || '🏷️');
                              setEditCatMonthlyLimit(String(limit));
                              setEditCatSubcategoriesList([...cat.subcategories]);
                              setEditCatSubcategoryIcons({ ...(cat.subcategoryIcons || {}) });
                              setEditNewSubInput('');
                            }}
                            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-colors shadow-2xs"
                            title="Редагувати параметри категорії"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* EXPANDABLE SUBCATEGORY BRANCH */}
                    {isExpanded && (
                      <tr className="bg-slate-50/90 border-b border-slate-200">
                        <td colSpan={6} className="py-3 px-6 pl-14">
                          <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-2.5">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <div className="flex items-center gap-2">
                                <CornerDownRight className="h-4 w-4 text-blue-600 shrink-0" />
                                <span className="text-xs font-bold text-slate-900">
                                  Деталізація витрат по гілці підкатегорій: «{cat.name}»
                                </span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-500">
                                Загальна сума категорії: <span className="font-bold text-slate-900">{spent.toLocaleString('uk-UA')} {currencySymbol}</span>
                              </div>
                            </div>

                            {allSubNames.length === 0 ? (
                              <div className="text-xs text-slate-400 italic py-2 text-center">
                                Для цієї категорії ще не визначено підкатегорій.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                                {allSubNames.map((subName) => {
                                  const subSpent = catSubMap.get(subName) || 0;
                                  const subPct = spent > 0 ? (subSpent / spent) * 100 : 0;
                                  const hasSpending = subSpent > 0;

                                  return (
                                    <div
                                      key={subName}
                                      className={`rounded-lg border p-2.5 flex flex-col justify-between transition-colors ${
                                        hasSpending
                                          ? 'border-blue-200/80 bg-blue-50/20'
                                          : 'border-slate-200 bg-slate-50/40 opacity-75'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="text-slate-400 font-mono text-xs">└─</span>
                                          {cat.subcategoryIcons?.[subName] && (
                                            <span className="text-sm shrink-0">{cat.subcategoryIcons[subName]}</span>
                                          )}
                                          <span className="text-xs font-semibold text-slate-800 truncate" title={subName}>
                                            {subName}
                                          </span>
                                        </div>
                                        <span className={`font-mono text-xs font-bold tabular-nums shrink-0 ${
                                          hasSpending ? 'text-slate-900' : 'text-slate-400'
                                        }`}>
                                          {subSpent.toLocaleString('uk-UA')} {currencySymbol}
                                        </span>
                                      </div>

                                      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-500 font-mono">
                                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                          <div
                                            style={{ width: `${Math.min(subPct, 100)}%` }}
                                            className={`h-full rounded-full transition-all ${
                                              hasSpending ? 'bg-blue-500' : 'bg-transparent'
                                            }`}
                                          />
                                        </div>
                                        <span className="shrink-0 w-9 text-right font-semibold">
                                          {subPct.toFixed(0)}%
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 1. MODAL: ADD NEW CATEGORY */}
      {isAddCategoryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-xl lg:max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                  <Plus className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Створити нову категорію витрат
                  </h3>
                  <p className="text-xs text-slate-500">
                    Вкажіть назву, місячний ліміт, кольорову мітку та підкатегорії
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCategoryModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCatName.trim()) return;
                const newCat: BudgetCategory = {
                  id: `cat-${Date.now()}`,
                  name: newCatName.trim(),
                  monthlyLimit: parseFloat(newCatMonthlyLimit) || 500,
                  color: newCatColor || '#2563eb',
                  icon: newCatIcon || '🏷️',
                  subcategories:
                    newCatSubcategories.length > 0 ? newCatSubcategories : ['Загальна'],
                  alertThresholdPercent: 80,
                };
                if (onAddExpenseCategory) {
                  onAddExpenseCategory(newCat);
                }
                setIsAddCategoryModalOpen(false);
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Назва категорії <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Напр. Продукти, Комуналка, Хобі..."
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Плановий ліміт на місяць ({currencySymbol}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={newCatMonthlyLimit}
                    onChange={(e) => setNewCatMonthlyLimit(e.target.value)}
                    placeholder="500"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs font-bold text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Icon Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Іконка категорії (емодзі)
                </label>
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50/70 rounded-xl border border-slate-200">
                  {PRESET_CATEGORY_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewCatIcon(emoji)}
                      className={`h-8 w-8 rounded-lg text-sm flex items-center justify-center transition-all ${
                        newCatIcon === emoji
                          ? 'bg-white shadow-xs ring-2 ring-blue-600 scale-110'
                          : 'hover:bg-white hover:scale-105'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                  <div className="ml-2 flex items-center gap-1">
                    <span className="text-[11px] text-slate-500">Своя:</span>
                    <input
                      type="text"
                      maxLength={4}
                      value={newCatIcon}
                      onChange={(e) => setNewCatIcon(e.target.value)}
                      className="w-10 rounded-lg border border-slate-300 bg-white text-center py-1 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Color Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Колір позначки
                </label>
                <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-50/70 rounded-xl border border-slate-200">
                  {PRESET_CATEGORY_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setNewCatColor(col)}
                      className={`h-7 w-7 rounded-full transition-transform border border-black/10 flex items-center justify-center ${
                        newCatColor.toLowerCase() === col.toLowerCase()
                          ? 'ring-2 ring-slate-900 ring-offset-2 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: col }}
                    >
                      {newCatColor.toLowerCase() === col.toLowerCase() && (
                        <Check className="h-3.5 w-3.5 text-white drop-shadow-xs" />
                      )}
                    </button>
                  ))}
                  <div className="ml-2 flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500">Палітра:</span>
                    <input
                      type="color"
                      value={newCatColor}
                      onChange={(e) => setNewCatColor(e.target.value)}
                      className="h-7 w-9 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Subcategories Management */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Підкатегорії (групи всередині цієї категорії)
                </label>
                <div className="space-y-2 p-3 bg-slate-50/70 rounded-xl border border-slate-200">
                  <div className="flex flex-wrap gap-1.5 min-h-[30px] items-center">
                    {newCatSubcategories.map((sub, sIdx) => (
                      <span
                        key={sIdx}
                        className="inline-flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-800 shadow-2xs"
                      >
                        <span>{sub}</span>
                        {newCatSubcategories.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setNewCatSubcategories((prev) =>
                                prev.filter((_, i) => i !== sIdx)
                              )
                            }
                            className="text-slate-400 hover:text-red-600 ml-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Введіть підкатегорію (напр. Овочі, Кава, Паливо...)"
                      value={newSubInput}
                      onChange={(e) => setNewSubInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = newSubInput.trim();
                          if (val && !newCatSubcategories.includes(val)) {
                            setNewCatSubcategories((prev) => [...prev, val]);
                            setNewSubInput('');
                          }
                        }
                      }}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = newSubInput.trim();
                        if (val && !newCatSubcategories.includes(val)) {
                          setNewCatSubcategories((prev) => [...prev, val]);
                          setNewSubInput('');
                        }
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                    >
                      + Додати
                    </button>
                  </div>
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Створити категорію</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. MODAL: EDIT CATEGORY DETAILS */}
      {editingCategoryObj && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-xl lg:max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-base shadow-2xs"
                  style={{ backgroundColor: `${editCatColor}20` }}
                >
                  {editCatIcon || '🏷️'}
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Редагувати категорію «{editingCategoryObj.name}»
                  </h3>
                  <p className="text-xs text-slate-500">
                    Зміна назви, ліміту, кольору та переліку підкатегорій
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingCategoryObj(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!editCatName.trim()) return;
                const updated: BudgetCategory = {
                  ...editingCategoryObj,
                  name: editCatName.trim(),
                  monthlyLimit:
                    parseFloat(editCatMonthlyLimit) || editingCategoryObj.monthlyLimit || 500,
                  color: editCatColor || '#2563eb',
                  icon: editCatIcon || '🏷️',
                  subcategories:
                    editCatSubcategoriesList.length > 0
                      ? editCatSubcategoriesList
                      : ['Загальна'],
                  subcategoryIcons: editCatSubcategoryIcons,
                };

                if (onUpdateExpenseCategory) {
                  onUpdateExpenseCategory(updated, editingCategoryObj.name);
                }

                const limitVal = parseFloat(editCatMonthlyLimit);
                if (!isNaN(limitVal) && limitVal > 0) {
                  onUpdateMonthBudget(selectedMonth, {
                    ...currentMonthLimits,
                    [updated.name]: limitVal,
                  });
                }
                setEditingCategoryObj(null);
              }}
              className="space-y-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Назва категорії <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editCatName}
                    onChange={(e) => setEditCatName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Місячний ліміт ({currencySymbol}) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={editCatMonthlyLimit}
                    onChange={(e) => setEditCatMonthlyLimit(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs font-bold text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Icon Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Іконка категорії (емодзі)
                </label>
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-50/70 rounded-xl border border-slate-200">
                  {PRESET_CATEGORY_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setEditCatIcon(emoji)}
                      className={`h-8 w-8 rounded-lg text-sm flex items-center justify-center transition-all ${
                        editCatIcon === emoji
                          ? 'bg-white shadow-xs ring-2 ring-blue-600 scale-110'
                          : 'hover:bg-white hover:scale-105'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                  <div className="ml-2 flex items-center gap-1">
                    <span className="text-[11px] text-slate-500">Своя:</span>
                    <input
                      type="text"
                      maxLength={4}
                      value={editCatIcon}
                      onChange={(e) => setEditCatIcon(e.target.value)}
                      className="w-10 rounded-lg border border-slate-300 bg-white text-center py-1 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Color Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Колір позначки
                </label>
                <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-50/70 rounded-xl border border-slate-200">
                  {PRESET_CATEGORY_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setEditCatColor(col)}
                      className={`h-7 w-7 rounded-full transition-transform border border-black/10 flex items-center justify-center ${
                        editCatColor.toLowerCase() === col.toLowerCase()
                          ? 'ring-2 ring-slate-900 ring-offset-2 scale-110'
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: col }}
                    >
                      {editCatColor.toLowerCase() === col.toLowerCase() && (
                        <Check className="h-3.5 w-3.5 text-white drop-shadow-xs" />
                      )}
                    </button>
                  ))}
                  <div className="ml-2 flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500">Палітра:</span>
                    <input
                      type="color"
                      value={editCatColor}
                      onChange={(e) => setEditCatColor(e.target.value)}
                      className="h-7 w-9 rounded-lg border border-slate-300 cursor-pointer p-0.5 bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Subcategories Management */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Підкатегорії ({editCatSubcategoriesList.length})
                </label>
                <div className="space-y-2 p-3 bg-slate-50/70 rounded-xl border border-slate-200">
                  <div className="flex flex-wrap gap-1.5 min-h-[30px] items-center">
                    {editCatSubcategoriesList.map((sub, sIdx) => {
                      const sIcon = editCatSubcategoryIcons[sub];
                      return (
                        <span
                          key={sIdx}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-slate-200 px-2 py-1 text-xs font-medium text-slate-800 shadow-2xs"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setSubcatIconPicker({
                                isOpen: true,
                                subName: sub,
                                currentIcon: sIcon || '🏷️',
                              })
                            }
                            className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-100 text-sm"
                            title="Змінити значок підкатегорії"
                          >
                            {sIcon || '🏷️'}
                          </button>
                          <span>{sub}</span>
                          {editCatSubcategoriesList.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setEditCatSubcategoriesList((prev) =>
                                  prev.filter((_, i) => i !== sIdx)
                                )
                              }
                              className="text-slate-400 hover:text-red-600 ml-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      );
                    })}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Введіть нову підкатегорію..."
                      value={editNewSubInput}
                      onChange={(e) => setEditNewSubInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = editNewSubInput.trim();
                          if (val && !editCatSubcategoriesList.includes(val)) {
                            setEditCatSubcategoriesList((prev) => [...prev, val]);
                            setEditNewSubInput('');
                          }
                        }
                      }}
                      className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = editNewSubInput.trim();
                        if (val && !editCatSubcategoriesList.includes(val)) {
                          setEditCatSubcategoriesList((prev) => [...prev, val]);
                          setEditNewSubInput('');
                        }
                      }}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                    >
                      + Додати
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons with Delete on Left */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {budgets.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const target = editingCategoryObj;
                      setEditingCategoryObj(null);
                      setDeletingCategoryObj(target);
                      const fallback = budgets.find((b) => b.id !== target.id);
                      setReassignTarget(fallback ? fallback.name : '');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Видалити категорію</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingCategoryObj(null)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Скасувати
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
                  >
                    <Check className="h-4 w-4" />
                    <span>Зберегти зміни</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. MODAL: DELETE CATEGORY CONFIRMATION */}
      {deletingCategoryObj && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Видалити категорію «{deletingCategoryObj.name}»?
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Категорію буде видалено з бюджетів та списку витрат. Виберіть категорію для перенесення існуючих записів.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Перенести існуючі операції до:
                </label>
                <select
                  value={reassignTarget}
                  onChange={(e) => setReassignTarget(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  {budgets
                    .filter((b) => b.id !== deletingCategoryObj.id)
                    .map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.icon} {b.name}
                      </option>
                    ))}
                  <option value="">Без категорії</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingCategoryObj(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Скасувати
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteExpenseCategory) {
                      onDeleteExpenseCategory(deletingCategoryObj.id, reassignTarget || undefined);
                    }
                    setDeletingCategoryObj(null);
                  }}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors shadow-xs"
                >
                  Видалити категорію
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subcategory Icon Picker Modal */}
      {subcatIconPicker?.isOpen && (
        <IconPickerModal
          isOpen={subcatIconPicker.isOpen}
          title={`Значок для підкатегорії «${subcatIconPicker.subName}»`}
          currentIcon={subcatIconPicker.currentIcon}
          onSelect={(icon: string) => {
            setEditCatSubcategoryIcons((prev) => ({
              ...prev,
              [subcatIconPicker.subName]: icon,
            }));
            setSubcatIconPicker(null);
          }}
          onClose={() => setSubcatIconPicker(null)}
        />
      )}
    </div>
  );
};
