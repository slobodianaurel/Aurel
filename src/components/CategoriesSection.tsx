import React, { useState } from 'react';
import {
  BudgetCategory,
  CATEGORY_COLORS,
  IncomeCategory,
  TransactionItem,
} from '../types/finance';
import {
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  Palette,
  Tags,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  FolderPlus,
  DollarSign,
  Briefcase,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Smile,
} from 'lucide-react';
import { IconPickerModal } from './IconPickerModal';

interface CategoriesSectionProps {
  budgets: BudgetCategory[];
  incomeCategories: IncomeCategory[];
  transactions?: TransactionItem[];
  monthlyBudgets?: Record<string, Record<string, number>>;
  currencySymbol?: string;
  onUpdateBudgets: (newBudgets: BudgetCategory[]) => void;
  onUpdateIncomeCategories: (newIncomeCats: IncomeCategory[]) => void;
  onUpdateExpenseCategory?: (updated: BudgetCategory, oldName?: string) => void;
  onDeleteExpenseCategory?: (id: string, reassignToName?: string) => void;
  onUpdateIncomeCategory?: (updated: IncomeCategory, oldName?: string) => void;
  onDeleteIncomeCategory?: (id: string, reassignToName?: string) => void;
  onNavigateToBudget?: () => void;
}

export const CategoriesSection: React.FC<CategoriesSectionProps> = ({
  budgets,
  incomeCategories,
  transactions = [],
  monthlyBudgets = {},
  currencySymbol = 'zł',
  onUpdateBudgets,
  onUpdateIncomeCategories,
  onUpdateExpenseCategory,
  onDeleteExpenseCategory,
  onUpdateIncomeCategory,
  onDeleteIncomeCategory,
  onNavigateToBudget,
}) => {
  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');

  // New Expense Category State
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseIcon, setNewExpenseIcon] = useState('🏷️');
  const [newExpenseColor, setNewExpenseColor] = useState(CATEGORY_COLORS[0].value);
  const [newExpenseSubcategories, setNewExpenseSubcategories] = useState('');
  const [newExpenseLimit, setNewExpenseLimit] = useState('500');

  // Edit Expense Category Modal State
  const [editingExpenseCat, setEditingExpenseCat] = useState<BudgetCategory | null>(null);
  const [editExpenseName, setEditExpenseName] = useState('');
  const [editExpenseIcon, setEditExpenseIcon] = useState('🏷️');
  const [editExpenseColor, setEditExpenseColor] = useState('');
  const [editExpenseLimit, setEditExpenseLimit] = useState('');
  const [editExpenseSubcategoriesList, setEditExpenseSubcategoriesList] = useState<string[]>([]);
  const [editExpenseSubcategoryIcons, setEditExpenseSubcategoryIcons] = useState<Record<string, string>>({});
  const [newSubcatInput, setNewSubcatInput] = useState('');

  // Icon Picker Modal State
  const [iconPickerModal, setIconPickerModal] = useState<{
    isOpen: boolean;
    title: string;
    currentIcon: string;
    onSelect: (icon: string) => void;
  }>({
    isOpen: false,
    title: '',
    currentIcon: '',
    onSelect: () => {},
  });

  // Delete Expense Category Modal State
  const [deletingExpenseCat, setDeletingExpenseCat] = useState<BudgetCategory | null>(null);
  const [reassignExpenseTarget, setReassignExpenseTarget] = useState<string>('');

  // New Income Category State
  const [newIncomeName, setNewIncomeName] = useState('');
  const [newIncomeIcon, setNewIncomeIcon] = useState('💼');
  const [newIncomeSubcategories, setNewIncomeSubcategories] = useState('');
  const [newIncomeIsSalary, setNewIncomeIsSalary] = useState(false);

  // Edit Income Category Modal State
  const [editingIncomeCat, setEditingIncomeCat] = useState<IncomeCategory | null>(null);
  const [editIncomeName, setEditIncomeName] = useState('');
  const [editIncomeIcon, setEditIncomeIcon] = useState('💼');
  const [editIncomeSubcategoriesList, setEditIncomeSubcategoriesList] = useState<string[]>([]);
  const [editIncomeSubcategoryIcons, setEditIncomeSubcategoryIcons] = useState<Record<string, string>>({});
  const [editIncomeIsSalary, setEditIncomeIsSalary] = useState(false);
  const [newIncomeSubcatInput, setNewIncomeSubcatInput] = useState('');

  // Delete Income Category Modal State
  const [deletingIncomeCat, setDeletingIncomeCat] = useState<IncomeCategory | null>(null);
  const [reassignIncomeTarget, setReassignIncomeTarget] = useState<string>('');

  // Expandable subcategory branch state for expense categories
  const [expandedExpenseBranches, setExpandedExpenseBranches] = useState<Set<string>>(new Set());

  const toggleExpenseBranch = (catName: string) => {
    setExpandedExpenseBranches((prev) => {
      const next = new Set(prev);
      if (next.has(catName)) next.delete(catName);
      else next.add(catName);
      return next;
    });
  };

  // User feedback toast message
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'warning'>('success');

  const showToast = (msg: string, type: 'success' | 'warning' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // -------------------------------------------------------------
  // EXPENSE CATEGORIES ACTIONS
  // -------------------------------------------------------------
  const handleCreateExpenseCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newExpenseName.trim();
    if (!trimmed) return;

    // Check duplicate
    if (budgets.some((b) => b.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast(`Категорія з назвою «${trimmed}» вже існує!`, 'warning');
      return;
    }

    const subs = newExpenseSubcategories
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const limitNum = parseFloat(newExpenseLimit) || 500;

    const created: BudgetCategory = {
      id: `cat-${Date.now().toString().slice(-6)}`,
      name: trimmed,
      icon: newExpenseIcon || '🏷️',
      color: newExpenseColor,
      subcategories: subs.length > 0 ? subs : ['Загальні витрати'],
      monthlyLimit: limitNum,
      alertThresholdPercent: 80,
    };

    onUpdateBudgets([...budgets, created]);
    setNewExpenseName('');
    setNewExpenseIcon('🏷️');
    setNewExpenseSubcategories('');
    setNewExpenseLimit('500');
    setNewExpenseColor(CATEGORY_COLORS[0].value);
    showToast(`Категорію витрат «${created.name}» створено!`);
  };

  const handleOpenEditExpense = (cat: BudgetCategory) => {
    setEditingExpenseCat(cat);
    setEditExpenseName(cat.name);
    setEditExpenseIcon(cat.icon || '🏷️');
    setEditExpenseColor(cat.color || CATEGORY_COLORS[0].value);
    setEditExpenseLimit(String(cat.monthlyLimit || 500));
    setEditExpenseSubcategoriesList([...cat.subcategories]);
    setEditExpenseSubcategoryIcons({ ...(cat.subcategoryIcons || {}) });
    setNewSubcatInput('');
  };

  const handleSaveEditExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpenseCat) return;

    const trimmed = editExpenseName.trim();
    if (!trimmed) {
      showToast('Назва категорії не може бути порожньою', 'warning');
      return;
    }

    // Check duplicate if name changed
    if (
      trimmed.toLowerCase() !== editingExpenseCat.name.toLowerCase() &&
      budgets.some((b) => b.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      showToast(`Категорія з назвою «${trimmed}» вже існує`, 'warning');
      return;
    }

    const oldName = editingExpenseCat.name;
    const limitNum = parseFloat(editExpenseLimit) || editingExpenseCat.monthlyLimit;

    const updated: BudgetCategory = {
      ...editingExpenseCat,
      name: trimmed,
      icon: editExpenseIcon || undefined,
      color: editExpenseColor,
      monthlyLimit: limitNum,
      subcategories:
        editExpenseSubcategoriesList.length > 0
          ? editExpenseSubcategoriesList
          : ['Загальні витрати'],
      subcategoryIcons: editExpenseSubcategoryIcons,
    };

    if (onUpdateExpenseCategory) {
      onUpdateExpenseCategory(updated, oldName);
    } else {
      onUpdateBudgets(budgets.map((b) => (b.id === updated.id ? updated : b)));
    }

    setEditingExpenseCat(null);
    showToast(`Категорію «${trimmed}» успішно оновлено!`);
  };

  const handleOpenDeleteExpense = (cat: BudgetCategory) => {
    if (budgets.length <= 1) {
      showToast('Неможливо видалити останню категорію витрат!', 'warning');
      return;
    }

    setDeletingExpenseCat(cat);
    // Find another category as default reassignment
    const fallback = budgets.find((b) => b.id !== cat.id);
    setReassignExpenseTarget(fallback ? fallback.name : '');
  };

  const handleConfirmDeleteExpense = () => {
    if (!deletingExpenseCat) return;

    const catId = deletingExpenseCat.id;
    const catName = deletingExpenseCat.name;

    if (onDeleteExpenseCategory) {
      onDeleteExpenseCategory(catId, reassignExpenseTarget || undefined);
    } else {
      onUpdateBudgets(budgets.filter((b) => b.id !== catId));
    }

    setDeletingExpenseCat(null);
    showToast(`Категорію «${catName}» видалено`);
  };

  // Subcategory management in edit modal
  const handleAddSubcategoryToEdit = () => {
    const trimmed = newSubcatInput.trim();
    if (!trimmed) return;
    if (!editExpenseSubcategoriesList.includes(trimmed)) {
      setEditExpenseSubcategoriesList([...editExpenseSubcategoriesList, trimmed]);
    }
    setNewSubcatInput('');
  };

  const handleRemoveSubcategoryFromEdit = (sub: string) => {
    setEditExpenseSubcategoriesList(
      editExpenseSubcategoriesList.filter((s) => s !== sub)
    );
  };

  // -------------------------------------------------------------
  // INCOME CATEGORIES ACTIONS
  // -------------------------------------------------------------
  const handleCreateIncomeCategory = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newIncomeName.trim();
    if (!trimmed) return;

    if (incomeCategories.some((i) => i.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast(`Категорія доходу «${trimmed}» вже існує!`, 'warning');
      return;
    }

    const subs = newIncomeSubcategories
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const created: IncomeCategory = {
      id: `inc-${Date.now().toString().slice(-6)}`,
      name: trimmed,
      icon: newIncomeIcon || '💼',
      subcategories: subs.length > 0 ? subs : ['Основний дохід'],
      isSalary: newIncomeIsSalary,
    };

    onUpdateIncomeCategories([...incomeCategories, created]);
    setNewIncomeName('');
    setNewIncomeIcon('💼');
    setNewIncomeSubcategories('');
    setNewIncomeIsSalary(false);
    showToast(`Категорію доходу «${created.name}» створено!`);
  };

  const handleOpenEditIncome = (inc: IncomeCategory) => {
    setEditingIncomeCat(inc);
    setEditIncomeName(inc.name);
    setEditIncomeIcon(inc.icon || '💼');
    setEditIncomeSubcategoriesList([...inc.subcategories]);
    setEditIncomeSubcategoryIcons({ ...(inc.subcategoryIcons || {}) });
    setEditIncomeIsSalary(Boolean(inc.isSalary));
    setNewIncomeSubcatInput('');
  };

  const handleSaveEditIncome = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIncomeCat) return;

    const trimmed = editIncomeName.trim();
    if (!trimmed) {
      showToast('Назва категорії доходу не може бути порожньою', 'warning');
      return;
    }

    if (
      trimmed.toLowerCase() !== editingIncomeCat.name.toLowerCase() &&
      incomeCategories.some((i) => i.name.toLowerCase() === trimmed.toLowerCase())
    ) {
      showToast(`Категорія доходу «${trimmed}» вже існує`, 'warning');
      return;
    }

    const oldName = editingIncomeCat.name;
    const updated: IncomeCategory = {
      ...editingIncomeCat,
      name: trimmed,
      icon: editIncomeIcon || undefined,
      subcategories:
        editIncomeSubcategoriesList.length > 0
          ? editIncomeSubcategoriesList
          : ['Основний дохід'],
      subcategoryIcons: editIncomeSubcategoryIcons,
      isSalary: editIncomeIsSalary,
    };

    if (onUpdateIncomeCategory) {
      onUpdateIncomeCategory(updated, oldName);
    } else {
      onUpdateIncomeCategories(
        incomeCategories.map((i) => (i.id === updated.id ? updated : i))
      );
    }

    setEditingIncomeCat(null);
    showToast(`Категорію доходу «${trimmed}» оновлено!`);
  };

  const handleOpenDeleteIncome = (inc: IncomeCategory) => {
    if (incomeCategories.length <= 1) {
      showToast('Неможливо видалити останню категорію доходів!', 'warning');
      return;
    }

    setDeletingIncomeCat(inc);
    const fallback = incomeCategories.find((i) => i.id !== inc.id);
    setReassignIncomeTarget(fallback ? fallback.name : '');
  };

  const handleConfirmDeleteIncome = () => {
    if (!deletingIncomeCat) return;

    const catId = deletingIncomeCat.id;
    const catName = deletingIncomeCat.name;

    if (onDeleteIncomeCategory) {
      onDeleteIncomeCategory(catId, reassignIncomeTarget || undefined);
    } else {
      onUpdateIncomeCategories(incomeCategories.filter((i) => i.id !== catId));
    }

    setDeletingIncomeCat(null);
    showToast(`Категорію доходу «${catName}» видалено`);
  };

  // Count transactions for a given category name
  const countTransactionsForExpense = (name: string) => {
    const matching = transactions.filter(
      (t) => t.type === 'expense' && t.category === name
    );
    const sum = matching.reduce((acc, t) => acc + t.amount, 0);
    const subTotals = new Map<string, number>();
    matching.forEach((t) => {
      if (t.splits && t.splits.length > 0) {
        t.splits.forEach((sp) => {
          const k = sp.subcategory?.trim() || 'Без підкатегорії';
          subTotals.set(k, (subTotals.get(k) || 0) + sp.amount);
        });
      } else {
        const k = t.subcategory?.trim() || 'Без підкатегорії';
        subTotals.set(k, (subTotals.get(k) || 0) + t.amount);
      }
    });
    return { count: matching.length, total: sum, subTotals };
  };

  const countTransactionsForIncome = (name: string) => {
    const matching = transactions.filter(
      (t) => t.type === 'income' && t.category === name
    );
    const sum = matching.reduce((acc, t) => acc + t.amount, 0);
    return { count: matching.length, total: sum };
  };

  return (
    <div className="space-y-6 max-w-full overflow-hidden">
      {/* Toast Feedback Notification */}
      {toastMessage && (
        <div
          className={`rounded-lg border px-4 py-3 text-xs flex items-center justify-between shadow-sm animate-fadeIn ${
            toastType === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastType === 'warning' ? (
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            ) : (
              <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            )}
            <span className="font-medium">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-slate-500 hover:text-slate-800 p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Header & Tabs */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Tags className="h-5 w-5 text-slate-900" />
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Управління категоріями
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Додавайте, редагуйте та безпечно видаляйте категорії витрат і доходів. При перейменуванні всі збережені операції оновлюються автоматично.
            </p>
          </div>

          {onNavigateToBudget && (
            <button
              type="button"
              onClick={onNavigateToBudget}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-900 hover:text-white transition-colors self-start shadow-2xs"
            >
              <span>Контроль бюджету</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Tab Switcher: Expense vs Income */}
        <div className="mt-4 flex rounded-lg bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('expense')}
            className={`flex-1 rounded-md py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'expense'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Категорії витрат</span>
            <span className="font-mono text-[11px] bg-slate-200 text-slate-800 px-1.5 py-0.5 rounded-full">
              {budgets.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('income')}
            className={`flex-1 rounded-md py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'income'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Категорії доходів</span>
            <span className="font-mono text-[11px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full">
              {incomeCategories.length}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 1. EXPENSE CATEGORIES VIEW */}
      {/* ========================================================= */}
      {activeTab === 'expense' && (
        <div className="space-y-6">
          {/* Create New Expense Category Form */}
          <form
            onSubmit={handleCreateExpenseCategory}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FolderPlus className="h-4 w-4 text-blue-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Додати нову категорію витрат
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Palette className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-[11px] text-slate-500">Колір:</span>
                <div className="flex items-center gap-1">
                  {CATEGORY_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setNewExpenseColor(c.value)}
                      className={`h-4 w-4 rounded-full border transition-transform ${
                        newExpenseColor === c.value
                          ? 'border-slate-900 scale-125'
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                  <label
                    className="relative flex items-center cursor-pointer ml-1"
                    title="Обрати власний колір"
                  >
                    <input
                      type="color"
                      value={newExpenseColor}
                      onChange={(e) => setNewExpenseColor(e.target.value)}
                      className="sr-only"
                    />
                    <span
                      className="h-4 w-4 rounded-full border border-slate-300 ring-1 ring-slate-200 shadow-2xs hover:scale-110 transition-transform cursor-pointer"
                      style={{ backgroundColor: newExpenseColor }}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-4">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Значок та назва категорії
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setIconPickerModal({
                        isOpen: true,
                        title: 'Оберіть значок категорії витрат',
                        currentIcon: newExpenseIcon,
                        onSelect: (icon) => setNewExpenseIcon(icon),
                      })
                    }
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xl hover:bg-slate-100 transition-colors shadow-2xs"
                    title="Обрати значок"
                  >
                    {newExpenseIcon || '🏷️'}
                  </button>
                  <input
                    type="text"
                    required
                    placeholder="Напр. Автомобіль, Одяг, Зв'язок"
                    value={newExpenseName}
                    onChange={(e) => setNewExpenseName(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Базовий ліміт ({currencySymbol}/міс)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={newExpenseLimit}
                  onChange={(e) => setNewExpenseLimit(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Підкатегорії (через кому)
                </label>
                <input
                  type="text"
                  placeholder="Паливо, Мийка, Ремонт"
                  value={newExpenseSubcategories}
                  onChange={(e) => setNewExpenseSubcategories(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors h-[38px] whitespace-nowrap shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Створити</span>
                </button>
              </div>
            </div>
          </form>

          {/* Expense Categories List */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Список категорій витрат ({budgets.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Кожна категорія може бути відредагована або видалена з безпечною перевіркою транзакцій
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {budgets.map((cat) => {
                const txInfo = countTransactionsForExpense(cat.name);

                const isBranchOpen = expandedExpenseBranches.has(cat.name);

                return (
                  <div
                    key={cat.id}
                    className="p-4 hover:bg-slate-50/60 transition-colors space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => toggleExpenseBranch(cat.name)}
                            className="p-1 rounded hover:bg-slate-200/60 text-slate-400 hover:text-slate-800 transition-colors"
                            title={isBranchOpen ? 'Згорнути підкатегорії' : 'Відкрити гілку підкатегорій'}
                          >
                            {isBranchOpen ? (
                              <ChevronDown className="h-4 w-4 text-blue-600" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-slate-400" />
                            )}
                          </button>

                          <span
                            className="h-3.5 w-3.5 rounded-full shrink-0 shadow-2xs border border-white ring-1 ring-slate-200"
                            style={{ backgroundColor: cat.color || '#2563eb' }}
                          />
                          {cat.icon && <span className="text-base shrink-0">{cat.icon}</span>}
                          <span
                            onClick={() => toggleExpenseBranch(cat.name)}
                            className="font-semibold text-sm text-slate-900 cursor-pointer hover:text-blue-600"
                          >
                            {cat.name}
                          </span>
                          <span className="font-mono text-xs text-slate-500 tabular-nums">
                            · Ліміт: {cat.monthlyLimit?.toLocaleString('uk-UA')} {currencySymbol}
                          </span>
                          {txInfo.count > 0 && (
                            <span className="text-[11px] font-mono font-medium text-slate-600 tabular-nums bg-slate-100 px-2 py-0.5 rounded-full">
                              {txInfo.count} опер. · Разом: {txInfo.total.toLocaleString('uk-UA')}{' '}
                              {currencySymbol}
                            </span>
                          )}
                        </div>

                        {/* Subcategories tags summary */}
                        <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
                          {cat.subcategories.map((sub) => {
                            const subIcon = cat.subcategoryIcons?.[sub];
                            return (
                              <span
                                key={sub}
                                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-medium"
                              >
                                {subIcon && <span>{subIcon}</span>}
                                <span>{sub}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Action Buttons: Edit & Delete */}
                      <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleExpenseBranch(cat.name)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                          title="Детальна інформація по підкатегоріях"
                        >
                          <span>Гілка</span>
                          {isBranchOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 text-blue-600" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenEditExpense(cat)}
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-colors shadow-2xs"
                          title="Редагувати назву, колір, ліміт та підкатегорії"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>

                        {budgets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteExpense(cat)}
                            className="inline-flex items-center gap-1 rounded-lg border border-transparent p-1.5 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Видалити категорію"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sm:hidden text-xs">Видалити</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* EXPANDED SUBCATEGORY BRANCH */}
                    {isBranchOpen && (
                      <div className="ml-7 rounded-xl border border-blue-100 bg-blue-50/20 p-3.5 space-y-2 animate-fadeIn">
                        <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
                          <span>Витрати по підкатегоріях ({cat.name}):</span>
                          <span className="font-mono text-[11px] text-slate-500">
                            Всього: {txInfo.total.toLocaleString('uk-UA')} {currencySymbol}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                          {cat.subcategories.map((sub) => {
                            const subAmt = txInfo.subTotals.get(sub) || 0;
                            const subPct = txInfo.total > 0 ? (subAmt / txInfo.total) * 100 : 0;
                            return (
                              <div
                                key={sub}
                                className="rounded-lg border border-slate-200 bg-white p-2.5 flex flex-col justify-between shadow-2xs"
                              >
                                <div className="flex items-center justify-between text-xs font-medium text-slate-800">
                                  <span className="truncate flex items-center gap-1">
                                    <span className="text-slate-400 font-mono text-[11px]">└─</span>
                                    {cat.subcategoryIcons?.[sub] && <span>{cat.subcategoryIcons[sub]}</span>}
                                    <span>{sub}</span>
                                  </span>
                                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                                    {subAmt.toLocaleString('uk-UA')} {currencySymbol}
                                  </span>
                                </div>
                                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      style={{ width: `${Math.min(subPct, 100)}%` }}
                                      className="h-full bg-blue-500 rounded-full"
                                    />
                                  </div>
                                  <span className="font-semibold text-slate-600">{subPct.toFixed(0)}%</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. INCOME CATEGORIES VIEW */}
      {/* ========================================================= */}
      {activeTab === 'income' && (
        <div className="space-y-6">
          {/* Create New Income Category Form */}
          <form
            onSubmit={handleCreateIncomeCategory}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Додати нову категорію доходу
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-5">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Значок та назва категорії доходу
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setIconPickerModal({
                        isOpen: true,
                        title: 'Оберіть значок категорії доходу',
                        currentIcon: newIncomeIcon,
                        onSelect: (icon) => setNewIncomeIcon(icon),
                      })
                    }
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xl hover:bg-slate-100 transition-colors shadow-2xs"
                    title="Обрати значок"
                  >
                    {newIncomeIcon || '💼'}
                  </button>
                  <input
                    type="text"
                    required
                    placeholder="Напр. Фріланс, Інвестиції, Бонуси"
                    value={newIncomeName}
                    onChange={(e) => setNewIncomeName(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Підкатегорії (через кому)
                </label>
                <input
                  type="text"
                  placeholder="Проєктне замовлення, Дивіденди"
                  value={newIncomeSubcategories}
                  onChange={(e) => setNewIncomeSubcategories(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-3 flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={newIncomeIsSalary}
                    onChange={(e) => setNewIncomeIsSalary(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>Зарплата / години</span>
                </label>

                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors h-[38px] whitespace-nowrap shadow-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Створити</span>
                </button>
              </div>
            </div>
          </form>

          {/* Income Categories List */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Список категорій доходів ({incomeCategories.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Використовуються у формі доходів та обліку заробітної плати
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {incomeCategories.map((inc) => {
                const txInfo = countTransactionsForIncome(inc.name);

                return (
                  <div
                    key={inc.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50/60 transition-colors gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5">
                        <span className="h-3 w-3 rounded-full bg-emerald-600 shrink-0" />
                        {inc.icon && <span className="text-base shrink-0">{inc.icon}</span>}
                        <span className="font-semibold text-sm text-slate-900">
                          {inc.name}
                        </span>
                        {inc.isSalary && (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 border border-emerald-200">
                            Облік робочих годин
                          </span>
                        )}
                        {txInfo.count > 0 && (
                          <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                            · {txInfo.count} опер. (+{txInfo.total.toLocaleString('uk-UA')}{' '}
                            {currencySymbol})
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {inc.subcategories.map((sub) => {
                          const sIcon = inc.subcategoryIcons?.[sub];
                          return (
                            <span
                              key={sub}
                              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-medium"
                            >
                              {sIcon && <span>{sIcon}</span>}
                              <span>{sub}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditIncome(inc)}
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 transition-colors shadow-2xs"
                        title="Редагувати категорію доходу"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenDeleteIncome(inc)}
                        className="inline-flex items-center gap-1 rounded-lg border border-transparent p-1.5 text-slate-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Видалити категорію доходу"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sm:hidden text-xs">Видалити</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: EDIT EXPENSE CATEGORY DIALOG */}
      {/* ========================================================= */}
      {editingExpenseCat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900">
                  Редагування категорії витрат
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingExpenseCat(null)}
                className="rounded p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Значок та назва категорії
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setIconPickerModal({
                        isOpen: true,
                        title: 'Оберіть значок категорії',
                        currentIcon: editExpenseIcon,
                        onSelect: (icon) => setEditExpenseIcon(icon),
                      })
                    }
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-xl hover:bg-slate-100 transition-colors shadow-2xs"
                    title="Обрати значок категорії"
                  >
                    {editExpenseIcon || '🏷️'}
                  </button>
                  <input
                    type="text"
                    required
                    value={editExpenseName}
                    onChange={(e) => setEditExpenseName(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  При зміні назви категорія буде автоматично оновлена в усіх існуючих транзакціях та лімітах.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Місячний ліміт ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editExpenseLimit}
                    onChange={(e) => setEditExpenseLimit(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Колір категорії
                  </label>
                  <div className="flex items-center gap-1.5 pt-1">
                    {CATEGORY_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setEditExpenseColor(c.value)}
                        className={`h-5 w-5 rounded-full border transition-transform ${
                          editExpenseColor === c.value
                            ? 'border-slate-900 scale-125'
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      />
                    ))}
                    <label
                      className="relative flex items-center cursor-pointer ml-1"
                      title="Власний колір"
                    >
                      <input
                        type="color"
                        value={editExpenseColor}
                        onChange={(e) => setEditExpenseColor(e.target.value)}
                        className="sr-only"
                      />
                      <span
                        className="h-5 w-5 rounded-full border border-slate-300 ring-1 ring-slate-200 shadow-2xs hover:scale-110 cursor-pointer"
                        style={{ backgroundColor: editExpenseColor }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Subcategories tag manager */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Підкатегорії ({editExpenseSubcategoriesList.length})
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2 p-2 rounded-lg bg-slate-50 border border-slate-200 min-h-[42px]">
                  {editExpenseSubcategoriesList.length === 0 ? (
                    <span className="text-[11px] text-slate-400">
                      Немає окремих підкатегорій
                    </span>
                  ) : (
                    editExpenseSubcategoriesList.map((sub) => {
                      const sIcon = editExpenseSubcategoryIcons[sub];
                      return (
                        <span
                          key={sub}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-xs text-slate-800 border border-slate-200 shadow-2xs"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setIconPickerModal({
                                isOpen: true,
                                title: `Значок для підкатегорії «${sub}»`,
                                currentIcon: sIcon || '🏷️',
                                onSelect: (icon) =>
                                  setEditExpenseSubcategoryIcons((prev) => ({
                                    ...prev,
                                    [sub]: icon,
                                  })),
                              })
                            }
                            className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-100 text-sm"
                            title="Змінити значок підкатегорії"
                          >
                            {sIcon || '🏷️'}
                          </button>
                          <span>{sub}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveSubcategoryFromEdit(sub)}
                            className="text-slate-400 hover:text-red-600 ml-0.5"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Додати підкатегорію"
                    value={newSubcatInput}
                    onChange={(e) => setNewSubcatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubcategoryToEdit();
                      }
                    }}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubcategoryToEdit}
                    className="rounded-lg bg-slate-100 border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    + Додати
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingExpenseCat(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs"
                >
                  Зберегти зміни
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: DELETE EXPENSE CATEGORY DIALOG */}
      {/* ========================================================= */}
      {deletingExpenseCat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Видалити категорію «{deletingExpenseCat.name}»?
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Категорію буде назавжди видалено зі списку витрат.
                </p>
              </div>
            </div>

            {/* Check affected transactions */}
            {(() => {
              const info = countTransactionsForExpense(deletingExpenseCat.name);
              const otherCategories = budgets.filter(
                (b) => b.id !== deletingExpenseCat.id
              );

              return (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  {info.count > 0 ? (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                      <div className="font-semibold">
                        Увага: виявлено {info.count} операцій на суму{' '}
                        {info.total.toLocaleString('uk-UA')} {currencySymbol}
                      </div>
                      <p className="mt-1 text-amber-800">
                        Оберіть, куди перенести ці транзакції, щоб вони не залишилися без категорії:
                      </p>

                      <div className="mt-2.5">
                        <label className="block text-[11px] font-medium text-amber-900 mb-1">
                          Перенести операції до:
                        </label>
                        <select
                          value={reassignExpenseTarget}
                          onChange={(e) => setReassignExpenseTarget(e.target.value)}
                          className="w-full rounded border border-amber-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                        >
                          {otherCategories.map((b) => (
                            <option key={b.id} value={b.name}>
                              {b.name}
                            </option>
                          ))}
                          <option value="">Без категорії (залишити без змін)</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                      У цій категорії немає збережених транзакцій. Видалення безпечне.
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setDeletingExpenseCat(null)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Скасувати
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDeleteExpense}
                      className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 shadow-xs"
                    >
                      Видалити категорію
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: EDIT INCOME CATEGORY DIALOG */}
      {/* ========================================================= */}
      {editingIncomeCat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-emerald-600" />
                <h3 className="text-base font-semibold text-slate-900">
                  Редагування категорії доходу
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingIncomeCat(null)}
                className="rounded p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditIncome} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Значок та назва категорії доходу
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setIconPickerModal({
                        isOpen: true,
                        title: 'Оберіть значок категорії доходу',
                        currentIcon: editIncomeIcon,
                        onSelect: (icon) => setEditIncomeIcon(icon),
                      })
                    }
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-slate-50 text-xl hover:bg-slate-100 transition-colors shadow-2xs"
                    title="Обрати значок"
                  >
                    {editIncomeIcon || '💼'}
                  </button>
                  <input
                    type="text"
                    required
                    value={editIncomeName}
                    onChange={(e) => setEditIncomeName(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={editIncomeIsSalary}
                    onChange={(e) => setEditIncomeIsSalary(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span>Зарплата та облік робочих годин</span>
                </label>
              </div>

              {/* Subcategories tag manager */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Підкатегорії ({editIncomeSubcategoriesList.length})
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2 p-2 rounded-lg bg-slate-50 border border-slate-200 min-h-[42px]">
                  {editIncomeSubcategoriesList.length === 0 ? (
                    <span className="text-[11px] text-slate-400">
                      Немає підкатегорій
                    </span>
                  ) : (
                    editIncomeSubcategoriesList.map((sub) => {
                      const sIcon = editIncomeSubcategoryIcons[sub];
                      return (
                        <span
                          key={sub}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-xs text-slate-800 border border-slate-200 shadow-2xs"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setIconPickerModal({
                                isOpen: true,
                                title: `Значок для підкатегорії «${sub}»`,
                                currentIcon: sIcon || '🏷️',
                                onSelect: (icon) =>
                                  setEditIncomeSubcategoryIcons((prev) => ({
                                    ...prev,
                                    [sub]: icon,
                                  })),
                              })
                            }
                            className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-100 text-sm"
                            title="Змінити значок підкатегорії"
                          >
                            {sIcon || '🏷️'}
                          </button>
                          <span>{sub}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setEditIncomeSubcategoriesList(
                                editIncomeSubcategoriesList.filter((s) => s !== sub)
                              )
                            }
                            className="text-slate-400 hover:text-red-600 ml-0.5"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Додати підкатегорію доходу"
                    value={newIncomeSubcatInput}
                    onChange={(e) => setNewIncomeSubcatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newIncomeSubcatInput.trim()) {
                          if (
                            !editIncomeSubcategoriesList.includes(
                              newIncomeSubcatInput.trim()
                            )
                          ) {
                            setEditIncomeSubcategoriesList([
                              ...editIncomeSubcategoriesList,
                              newIncomeSubcatInput.trim(),
                            ]);
                          }
                          setNewIncomeSubcatInput('');
                        }
                      }
                    }}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newIncomeSubcatInput.trim()) {
                        if (
                          !editIncomeSubcategoriesList.includes(
                            newIncomeSubcatInput.trim()
                          )
                        ) {
                          setEditIncomeSubcategoriesList([
                            ...editIncomeSubcategoriesList,
                            newIncomeSubcatInput.trim(),
                          ]);
                        }
                        setNewIncomeSubcatInput('');
                      }
                    }}
                    className="rounded-lg bg-slate-100 border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                  >
                    + Додати
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingIncomeCat(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs"
                >
                  Зберегти зміни
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: DELETE INCOME CATEGORY DIALOG */}
      {/* ========================================================= */}
      {deletingIncomeCat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Видалити категорію доходу «{deletingIncomeCat.name}»?
                </h3>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Категорію буде вилучено зі списку доходів.
                </p>
              </div>
            </div>

            {(() => {
              const info = countTransactionsForIncome(deletingIncomeCat.name);
              const otherCategories = incomeCategories.filter(
                (i) => i.id !== deletingIncomeCat.id
              );

              return (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  {info.count > 0 ? (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                      <div className="font-semibold">
                        Виявлено {info.count} надходжень на суму +
                        {info.total.toLocaleString('uk-UA')} {currencySymbol}
                      </div>
                      <p className="mt-1 text-amber-800">
                        Оберіть категорію для перенесення цих доходів:
                      </p>

                      <div className="mt-2.5">
                        <select
                          value={reassignIncomeTarget}
                          onChange={(e) => setReassignIncomeTarget(e.target.value)}
                          className="w-full rounded border border-amber-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
                        >
                          {otherCategories.map((i) => (
                            <option key={i.id} value={i.name}>
                              {i.name}
                            </option>
                          ))}
                          <option value="">Без категорії (залишити без змін)</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                      Немає прив’язаних надходжень. Видалення безпечне.
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setDeletingIncomeCat(null)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Скасувати
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDeleteIncome}
                      className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 shadow-xs"
                    >
                      Видалити категорію
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* GLOBAL ICON PICKER MODAL */}
      <IconPickerModal
        isOpen={iconPickerModal.isOpen}
        title={iconPickerModal.title}
        currentIcon={iconPickerModal.currentIcon}
        onSelect={iconPickerModal.onSelect}
        onClose={() =>
          setIconPickerModal((prev) => ({ ...prev, isOpen: false }))
        }
      />
    </div>
  );
};
