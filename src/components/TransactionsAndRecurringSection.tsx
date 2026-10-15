import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BudgetCategory,
  ExpensePriority,
  EXPENSE_PRIORITIES,
  IncomeCategory,
  RecurringPayment,
  TransactionItem,
  TransactionSubcategorySplit,
  TransactionType,
  WalletItem,
  WorkHourEntry,
} from '../types/finance';
import {
  exportTransactionsToCsv,
  parseImportedTransactionsCsv,
} from '../utils/csvExport';
import {
  Plus,
  Download,
  Upload,
  Search,
  Trash2,
  CheckCircle2,
  Calendar,
  Repeat,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Clock,
  Sparkles,
  Info,
  Edit3,
  Store,
  X,
  Check,
  FolderTree,
  CornerDownRight,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  CalendarPlus,
} from 'lucide-react';
import { MathAmountInput } from './MathAmountInput';
import {
  convertCurrency,
  getTransactionCurrencyCode,
} from '../utils/currency';

interface TransactionsAndRecurringSectionProps {
  transactions: TransactionItem[];
  budgets: BudgetCategory[];
  incomeCategories: IncomeCategory[];
  wallets: WalletItem[];
  recurringPayments: RecurringPayment[];
  workLogs: WorkHourEntry[];
  currencySymbol: string;
  currencyCode: string;
  customExchangeRates?: Record<string, number>;
  selectedCategoryFilter: string;
  initialSalaryMonth?: string;
  initialSalaryWallet?: string;
  initialSalaryAmount?: number;
  onSelectCategoryFilter: (cat: string) => void;
  onAddTransaction: (tx: Omit<TransactionItem, 'id'>) => void;
  onUpdateTransaction?: (tx: TransactionItem) => void;
  onDeleteTransaction: (id: string) => void;
  onImportTransactions: (txs: TransactionItem[]) => void;
  onAddRecurringPayment: (rec: Omit<RecurringPayment, 'id'>) => void;
  onConfirmRecurringPayment: (rec: RecurringPayment) => void;
  onDeleteRecurringPayment: (id: string) => void;
  onSyncRecurringToCalendar: (rec: RecurringPayment) => void;
}

export function getMonthDateRangeLabel(monthStr: string): string {
  const [yearStr, monthNumStr] = monthStr.split('-');
  const y = parseInt(yearStr, 10);
  const m = parseInt(monthNumStr, 10);
  if (isNaN(y) || isNaN(m)) return monthStr;
  const daysInMonth = new Date(y, m, 0).getDate();
  const startDay = '01';
  const endDay = String(daysInMonth).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `01.${mm}.${y} – ${endDay}.${mm}.${y}`;
}

export function formatDateUa(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const days = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'Пʼятниця', 'Субота'];
    const months = [
      'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
      'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
    ];
    return `${d} ${months[m - 1]} ${y} · ${days[dt.getDay()]}`;
  } catch {
    return dateStr;
  }
}

export function formatMonthNameUa(monthStr: string): string {
  try {
    const [y, m] = monthStr.split('-').map(Number);
    const monthNames = [
      'Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
      'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'
    ];
    if (m >= 1 && m <= 12) {
      return `${monthNames[m - 1]} ${y}`;
    }
  } catch {}
  return monthStr;
}

export const TransactionsAndRecurringSection: React.FC<
  TransactionsAndRecurringSectionProps
> = ({
  transactions,
  budgets,
  incomeCategories,
  wallets,
  recurringPayments,
  workLogs,
  currencySymbol,
  currencyCode,
  customExchangeRates,
  selectedCategoryFilter,
  initialSalaryMonth,
  initialSalaryWallet,
  initialSalaryAmount,
  onSelectCategoryFilter,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
  onImportTransactions,
  onAddRecurringPayment,
  onConfirmRecurringPayment,
  onDeleteRecurringPayment,
  onSyncRecurringToCalendar,
}: TransactionsAndRecurringSectionProps) => {
  // Transaction Form State
  const [txType, setTxType] = useState<TransactionType>('expense');
  const [txExpensePriority, setTxExpensePriority] = useState<ExpensePriority>('need');
  const [priorityFilter, setPriorityFilter] = useState<'all' | ExpensePriority>('all');
  const [txDate, setTxDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  // Categories are strictly separated: budgets for expense, incomeCategories for income
  const [txExpenseCategory, setTxExpenseCategory] = useState(
    budgets[0]?.name || 'Продукти та супермаркети'
  );
  const [txIncomeCategory, setTxIncomeCategory] = useState(
    incomeCategories[0]?.name || 'Заробітна плата'
  );
  const [txSubcategory, setTxSubcategory] = useState('');

  const [txWallet, setTxWallet] = useState(
    wallets[0]?.name || 'Картка PKO BP'
  );
  const [txToWallet, setTxToWallet] = useState(
    wallets[1]?.name || wallets[0]?.name || 'Revolut'
  );
  const [txAmount, setTxAmount] = useState('');
  const [txToAmount, setTxToAmount] = useState('');
  const [txDescription, setTxDescription] = useState('');
  const [txMerchant, setTxMerchant] = useState('');

  // Modal open state for transaction creation
  const [isAddTransactionModalOpen, setIsAddTransactionModalOpen] = useState(false);

  // Subcategory split state for new transaction
  const [isSplitMode, setIsSplitMode] = useState(false);
  const [txSplits, setTxSplits] = useState<
    {
      id: string;
      subcategory: string;
      amount: string;
      note: string;
      expensePriority: ExpensePriority;
    }[]
  >([{ id: '1', subcategory: '', amount: '', note: '', expensePriority: 'need' }]);

  // Category branch expansion in transaction ledger (default collapsed)
  const [expandedTxIds, setExpandedTxIds] = useState<Set<string>>(new Set());
  const toggleTxExpand = (txId: string) => {
    setExpandedTxIds((prev) => {
      const next = new Set(prev);
      if (next.has(txId)) next.delete(txId);
      else next.add(txId);
      return next;
    });
  };

  // Ledger month filter and 10-operations pagination state
  const [ledgerMonth, setLedgerMonth] = useState<string>(() => {
    if (transactions.length > 0) {
      const dates = transactions.map((t) => t.date).filter(Boolean).sort();
      const latest = dates[dates.length - 1];
      if (latest && latest.length >= 7) return latest.slice(0, 7);
    }
    return new Date().toISOString().slice(0, 7);
  });
  const [showAllLedgerMonths, setShowAllLedgerMonths] = useState<boolean>(false);
  const [isLedgerExpanded, setIsLedgerExpanded] = useState<boolean>(false);

  const handlePrevMonth = () => {
    const [y, m] = ledgerMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const newY = prevDate.getFullYear();
    const newM = String(prevDate.getMonth() + 1).padStart(2, '0');
    setLedgerMonth(`${newY}-${newM}`);
    setIsLedgerExpanded(false);
  };

  const handleNextMonth = () => {
    const [y, m] = ledgerMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const newY = nextDate.getFullYear();
    const newM = String(nextDate.getMonth() + 1).padStart(2, '0');
    setLedgerMonth(`${newY}-${newM}`);
    setIsLedgerExpanded(false);
  };

  // Saved merchants list for reuse & quick selection
  const DEFAULT_MERCHANTS = useMemo(
    () => [
      'Biedronka',
      'Lidl',
      'Żabka',
      'Carrefour',
      'Auchan',
      'Rossmann',
      'Orlen',
      'Kaufland',
      'Allegro',
      'Uber / Bolt',
      'McDonalds',
      'Аптека',
      'Сільпо',
      'АТБ',
    ],
    []
  );

  const [savedMerchants, setSavedMerchants] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('finpulse_merchants_v3');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      'Biedronka',
      'Lidl',
      'Żabka',
      'Carrefour',
      'Auchan',
      'Rossmann',
      'Orlen',
      'Kaufland',
      'Allegro',
      'Uber / Bolt',
      'McDonalds',
      'Аптека',
      'Сільпо',
      'АТБ',
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem('finpulse_merchants_v3', JSON.stringify(savedMerchants));
    } catch {}
  }, [savedMerchants]);

  const allKnownMerchants = useMemo(() => {
    const set = new Set<string>(savedMerchants);
    transactions.forEach((t) => {
      if (t.merchant && t.merchant.trim()) {
        set.add(t.merchant.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'uk-UA'));
  }, [savedMerchants, transactions]);

  const addMerchantIfNew = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!savedMerchants.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
      setSavedMerchants((prev) => [...prev, trimmed]);
    }
  };

  // State for Editing any transaction
  const [editingTx, setEditingTx] = useState<TransactionItem | null>(null);
  const [editType, setEditType] = useState<TransactionType>('expense');
  const [editDate, setEditDate] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editWallet, setEditWallet] = useState('');
  const [editToWallet, setEditToWallet] = useState('');
  const [editToAmount, setEditToAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSubcategory, setEditSubcategory] = useState('');
  const [editMerchant, setEditMerchant] = useState('');
  const [editExpensePriority, setEditExpensePriority] = useState<ExpensePriority>('need');
  const [editDescription, setEditDescription] = useState('');
  const [editIsSplit, setEditIsSplit] = useState(false);
  const [editSplits, setEditSplits] = useState<
    {
      id: string;
      subcategory: string;
      amount: string;
      note: string;
      expensePriority: ExpensePriority;
    }[]
  >([]);

  const handleStartEdit = (tx: TransactionItem) => {
    setEditingTx(tx);
    setEditType(tx.type);
    setEditDate(tx.date);
    setEditAmount(String(tx.amount));
    setEditWallet(tx.paymentMethod);
    setEditToWallet(tx.toWalletName || wallets[1]?.name || wallets[0]?.name || '');
    setEditToAmount(tx.toAmount ? String(tx.toAmount) : String(tx.amount));
    setEditCategory(tx.category);
    setEditSubcategory(tx.subcategory || '');
    setEditMerchant(tx.merchant || '');
    setEditExpensePriority(tx.expensePriority || 'need');
    setEditDescription(tx.description || '');

    if (tx.splits && tx.splits.length > 0) {
      setEditIsSplit(true);
      setEditSplits(
        tx.splits.map((s, idx) => ({
          id: String(idx + 1),
          subcategory: s.subcategory,
          amount: String(s.amount),
          note: s.note || '',
          expensePriority: s.expensePriority || tx.expensePriority || 'need',
        }))
      );
    } else {
      setEditIsSplit(false);
      setEditSplits([
        {
          id: '1',
          subcategory: tx.subcategory || '',
          amount: String(tx.amount || ''),
          note: '',
          expensePriority: tx.expensePriority || 'need',
        },
      ]);
    }
  };

  const handleSaveEditTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt <= 0) return;

    const targetAmt = editType === 'transfer' ? parseFloat(editToAmount) || amt : undefined;

    let validSplits: TransactionSubcategorySplit[] | undefined = undefined;
    if (editType === 'expense' && editIsSplit) {
      const parsedSplits = editSplits
        .filter((s) => s.subcategory.trim() && (parseFloat(s.amount) || 0) > 0)
        .map((s) => ({
          subcategory: s.subcategory.trim(),
          amount: parseFloat(s.amount) || 0,
          note: s.note.trim() || undefined,
          expensePriority: s.expensePriority || editExpensePriority,
        }));
      if (parsedSplits.length > 0) {
        validSplits = parsedSplits;
      }
    }

    const updated: TransactionItem = {
      ...editingTx,
      type: editType,
      date: editDate,
      amount: amt,
      paymentMethod: editWallet,
      category: editType === 'transfer' ? 'Переказ між рахунками' : editCategory,
      subcategory:
        validSplits && validSplits.length > 0
          ? validSplits[0].subcategory
          : editSubcategory.trim() || undefined,
      splits: validSplits,
      merchant: editType === 'expense' ? editMerchant.trim() || undefined : undefined,
      expensePriority:
        editType === 'expense'
          ? validSplits && validSplits.length > 0
            ? validSplits[0].expensePriority
            : editExpensePriority
          : undefined,
      toWalletName: editType === 'transfer' ? editToWallet : undefined,
      toAmount: targetAmt,
      description:
        editDescription.trim() ||
        (editType === 'expense' && editMerchant
          ? `${editCategory} (${editMerchant})`
          : editingTx.description),
    };

    if (editType === 'expense' && editMerchant.trim()) {
      addMerchantIfNew(editMerchant.trim());
    }

    if (onUpdateTransaction) {
      onUpdateTransaction(updated);
    }
    setEditingTx(null);
  };

  // Salary source linkage for income
  const [linkToWorkHoursMonth, setLinkToWorkHoursMonth] = useState<boolean>(true);
  const [selectedSalaryMonth, setSelectedSalaryMonth] = useState<string>(() => {
    return initialSalaryMonth || new Date().toISOString().slice(0, 7);
  });

  // Pre-fill if coming from WorkHours quick confirm
  useEffect(() => {
    if (initialSalaryMonth) {
      setTxType('income');
      setTxIncomeCategory('Заробітна плата');
      setSelectedSalaryMonth(initialSalaryMonth);
      setLinkToWorkHoursMonth(true);
      if (initialSalaryWallet) {
        setTxWallet(initialSalaryWallet);
      }
      if (initialSalaryAmount && initialSalaryAmount > 0) {
        setTxAmount(String(initialSalaryAmount));
      }
    }
  }, [initialSalaryMonth, initialSalaryWallet, initialSalaryAmount]);

  // Ledger Filter State
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [walletFilter, setWalletFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Recurring Payment Creation Form State
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [recTitle, setRecTitle] = useState('');
  const [recAmount, setRecAmount] = useState('');
  const [recType, setRecType] = useState<TransactionType>('expense');
  const [recCategory, setRecCategory] = useState(
    budgets[0]?.name || 'Житло та оренда'
  );
  const [recSubcategory, setRecSubcategory] = useState('');
  const [recWallet, setRecWallet] = useState(
    wallets[0]?.name || 'Картка PKO BP'
  );
  const [recFrequency, setRecFrequency] =
    useState<RecurringPayment['frequency']>('monthly');
  const [recDueDate, setRecDueDate] = useState('2026-10-05');
  const [recReminderMins, setRecReminderMins] = useState('1440'); // 24h

  const csvFileInputRef = useRef<HTMLInputElement | null>(null);

  // Subcategories logic
  const selectedBudgetObj = budgets.find((b) => b.name === txExpenseCategory);
  const selectedIncomeObj = incomeCategories.find((inc) => inc.name === txIncomeCategory);

  const availableSubcategories = useMemo(() => {
    if (txType === 'expense') {
      return selectedBudgetObj?.subcategories || [];
    }
    if (txType === 'income') {
      return selectedIncomeObj?.subcategories || [];
    }
    return [];
  }, [txType, selectedBudgetObj, selectedIncomeObj]);

  useEffect(() => {
    if (availableSubcategories.length > 0) {
      if (!availableSubcategories.includes(txSubcategory)) {
        setTxSubcategory(availableSubcategories[0]);
      }
    } else {
      setTxSubcategory('');
    }
  }, [availableSubcategories, txSubcategory]);

  const recBudgetObj = budgets.find((b) => b.name === recCategory);
  const recIncomeObj = incomeCategories.find((i) => i.name === recCategory);
  const recSubcategories =
    recType === 'expense'
      ? recBudgetObj?.subcategories || []
      : recIncomeObj?.subcategories || [];

  useEffect(() => {
    if (recSubcategories.length > 0) {
      if (!recSubcategories.includes(recSubcategory)) {
        setRecSubcategory(recSubcategories[0]);
      }
    } else {
      setRecSubcategory('');
    }
  }, [recCategory, recType, recSubcategories, recSubcategory]);

  // Split calculations & helpers for Add Transaction
  const totalSplitsAmount = useMemo(() => {
    return txSplits.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
  }, [txSplits]);

  const handleAddSplitRow = () => {
    setIsSplitMode(true);
    const subs = availableSubcategories;
    const used = new Set(txSplits.map((s) => s.subcategory));
    const nextSub = subs.find((s) => !used.has(s)) || subs[0] || '';
    const mainAmt = parseFloat(txAmount) || 0;
    const currentSum = txSplits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    const remainder = mainAmt > currentSum ? Math.round((mainAmt - currentSum) * 100) / 100 : '';

    setTxSplits((prev) => {
      if (prev.length === 1 && !prev[0].amount && !prev[0].subcategory) {
        return [
          {
            id: '1',
            subcategory: txSubcategory || subs[0] || '',
            amount: txAmount || '',
            note: '',
            expensePriority: txExpensePriority || 'need',
          },
          {
            id: String(Date.now()),
            subcategory: nextSub,
            amount: '',
            note: '',
            expensePriority: 'need',
          },
        ];
      }
      return [
        ...prev,
        {
          id: String(Date.now() + Math.random()),
          subcategory: nextSub,
          amount: remainder ? String(remainder) : '',
          note: '',
          expensePriority: 'need',
        },
      ];
    });
  };

  const handleRemoveSplitRow = (id: string) => {
    setTxSplits((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      if (updated.length === 0) {
        return [{ id: '1', subcategory: availableSubcategories[0] || '', amount: '', note: '', expensePriority: txExpensePriority || 'need' }];
      }
      const sum = updated.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);
      if (sum > 0) {
        setTxAmount(String(sum));
      }
      return updated;
    });
  };

  const handleUpdateSplitRow = (
    id: string,
    field: 'subcategory' | 'amount' | 'note' | 'expensePriority',
    val: string
  ) => {
    setTxSplits((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, [field]: val } : s));
      if (field === 'amount') {
        const sum = updated.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);
        if (sum > 0) {
          setTxAmount(String(sum));
        }
      }
      return updated;
    });
  };

  // Split helpers for Edit Transaction
  const editAvailableSubcategories = useMemo(() => {
    if (editType === 'expense') {
      const bObj = budgets.find((b) => b.name === editCategory);
      return bObj?.subcategories || [];
    }
    return [];
  }, [editType, editCategory, budgets]);

  const totalEditSplitsAmount = useMemo(() => {
    return editSplits.reduce((acc, s) => acc + (parseFloat(s.amount) || 0), 0);
  }, [editSplits]);

  const handleAddEditSplitRow = () => {
    setEditIsSplit(true);
    const subs = editAvailableSubcategories;
    const used = new Set(editSplits.map((s) => s.subcategory));
    const nextSub = subs.find((s) => !used.has(s)) || subs[0] || '';
    const mainAmt = parseFloat(editAmount) || 0;
    const currentSum = editSplits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    const remainder = mainAmt > currentSum ? Math.round((mainAmt - currentSum) * 100) / 100 : '';

    setEditSplits((prev) => {
      if (prev.length === 0) {
        return [
          {
            id: '1',
            subcategory: editSubcategory || subs[0] || '',
            amount: editAmount || '',
            note: '',
            expensePriority: editExpensePriority || 'need',
          },
          {
            id: String(Date.now()),
            subcategory: nextSub,
            amount: '',
            note: '',
            expensePriority: 'need',
          },
        ];
      }
      return [
        ...prev,
        {
          id: String(Date.now() + Math.random()),
          subcategory: nextSub,
          amount: remainder ? String(remainder) : '',
          note: '',
          expensePriority: 'need',
        },
      ];
    });
  };

  const handleRemoveEditSplitRow = (id: string) => {
    setEditSplits((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      if (updated.length === 0) {
        return [{ id: '1', subcategory: editAvailableSubcategories[0] || '', amount: '', note: '', expensePriority: editExpensePriority || 'need' }];
      }
      const sum = updated.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);
      if (sum > 0) {
        setEditAmount(String(sum));
      }
      return updated;
    });
  };

  const handleUpdateEditSplitRow = (
    id: string,
    field: 'subcategory' | 'amount' | 'note' | 'expensePriority',
    val: string
  ) => {
    setEditSplits((prev) => {
      const updated = prev.map((s) => (s.id === id ? { ...s, [field]: val } : s));
      if (field === 'amount') {
        const sum = updated.reduce((acc, item) => acc + (parseFloat(item.amount) || 0), 0);
        if (sum > 0) {
          setEditAmount(String(sum));
        }
      }
      return updated;
    });
  };

  const fromWalletObj = wallets.find((w) => w.name === txWallet);
  const toWalletObj = wallets.find((w) => w.name === txToWallet);
  const isDifferentCurrencyTransfer =
    txType === 'transfer' &&
    fromWalletObj &&
    toWalletObj &&
    fromWalletObj.currencyCode !== toWalletObj.currencyCode;

  // Compute live month hours & projected vs confirmed for selected salary month
  const isSalaryIncomeSelected =
    txType === 'income' &&
    (txIncomeCategory === 'Заробітна плата' ||
      selectedIncomeObj?.isSalary ||
      linkToWorkHoursMonth);

  const monthWorkStats = useMemo(() => {
    if (!selectedSalaryMonth) {
      return { totalHours: 0, projected: 0, confirmed: 0, remaining: 0, walletHours: 0, walletProjected: 0, walletConfirmed: 0, walletRemaining: 0 };
    }

    const logsForMonth = workLogs.filter((w) => w.date.startsWith(selectedSalaryMonth));
    const allHours = logsForMonth.reduce((sum, w) => sum + w.hoursWorked, 0);
    const allProjected = logsForMonth.reduce((sum, w) => sum + w.totalEarned, 0);

    const walletLogs = logsForMonth.filter((w) => (w.walletName || wallets[0]?.name) === txWallet);
    const walletHours = walletLogs.reduce((sum, w) => sum + w.hoursWorked, 0);
    const walletProjected = walletLogs.reduce((sum, w) => sum + w.totalEarned, 0);

    // Sum already confirmed transactions for this month & wallet
    let walletConfirmed = 0;
    let allConfirmed = 0;

    transactions.forEach((tx) => {
      if (tx.type !== 'income') return;
      const matchesMonth =
        tx.linkedWorkMonth === selectedSalaryMonth ||
        (!tx.linkedWorkMonth &&
          tx.date.startsWith(selectedSalaryMonth) &&
          (tx.category.toLowerCase().includes('заробіт') ||
            tx.category.toLowerCase().includes('зарплат')));

      if (matchesMonth) {
        allConfirmed += tx.amount;
        if (tx.paymentMethod === txWallet) {
          walletConfirmed += tx.amount;
        }
      }
    });

    const walletRemaining = Math.max(0, walletProjected - walletConfirmed);
    const allRemaining = Math.max(0, allProjected - allConfirmed);

    return {
      totalHours: allHours,
      projected: allProjected,
      confirmed: allConfirmed,
      remaining: allRemaining,
      walletHours,
      walletProjected,
      walletConfirmed,
      walletRemaining,
    };
  }, [workLogs, transactions, selectedSalaryMonth, txWallet, wallets]);

  const handleCreateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(txAmount);
    if (isNaN(amt) || amt <= 0) return;

    if (txType === 'transfer') {
      const targetAmt = isDifferentCurrencyTransfer
        ? parseFloat(txToAmount) || amt
        : amt;
      onAddTransaction({
        date: txDate,
        category: 'Переказ між рахунками',
        subcategory: undefined,
        description:
          txDescription.trim() ||
          `Переказ коштів: ${txWallet} → ${txToWallet}`,
        amount: amt,
        type: 'transfer',
        paymentMethod: txWallet,
        toWalletName: txToWallet,
        toAmount: targetAmt,
      });
    } else if (txType === 'income') {
      const isSalary = isSalaryIncomeSelected && linkToWorkHoursMonth;
      const defaultDesc = isSalary
        ? `Виплата зарплати за ${formatMonthNameUa(selectedSalaryMonth)} (${getMonthDateRangeLabel(selectedSalaryMonth)})`
        : txIncomeCategory;

      onAddTransaction({
        date: txDate,
        category: txIncomeCategory,
        subcategory: undefined,
        description: txDescription.trim() || defaultDesc,
        amount: amt,
        type: 'income',
        paymentMethod: txWallet,
        linkedWorkMonth: isSalary ? selectedSalaryMonth : undefined,
      });
    } else {
      // Expense
      const chosenMerchant = txMerchant.trim();
      let validSplits: TransactionSubcategorySplit[] | undefined = undefined;

      if (isSplitMode) {
        const parsedSplits = txSplits
          .filter((s) => s.subcategory.trim() && (parseFloat(s.amount) || 0) > 0)
          .map((s) => ({
            subcategory: s.subcategory.trim(),
            amount: parseFloat(s.amount) || 0,
            note: s.note?.trim() || undefined,
            expensePriority: s.expensePriority || txExpensePriority,
          }));
        if (parsedSplits.length > 0) {
          validSplits = parsedSplits;
        }
      }

      const finalAmt = validSplits && validSplits.length > 0 ? validSplits.reduce((sum, s) => sum + s.amount, 0) : amt;

      onAddTransaction({
        date: txDate,
        category: txExpenseCategory,
        subcategory:
          validSplits && validSplits.length > 0
            ? validSplits[0].subcategory
            : txSubcategory || undefined,
        splits: validSplits,
        merchant: chosenMerchant || undefined,
        description:
          txDescription.trim() ||
          `${txExpenseCategory}${
            chosenMerchant
              ? ` (${chosenMerchant})`
              : ''
          }`,
        amount: finalAmt,
        type: 'expense',
        expensePriority:
          validSplits && validSplits.length > 0
            ? validSplits[0].expensePriority
            : txExpensePriority || 'need',
        paymentMethod: txWallet,
      });

      if (chosenMerchant) {
        addMerchantIfNew(chosenMerchant);
      }
    }

    setTxAmount('');
    setTxToAmount('');
    setTxDescription('');
    setTxMerchant('');
    setIsSplitMode(false);
    setTxSplits([{ id: '1', subcategory: '', amount: '', note: '', expensePriority: 'need' }]);
    setIsAddTransactionModalOpen(false);
  };

  const handleCreateRecurring = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(recAmount);
    if (!recTitle.trim() || isNaN(amt) || amt <= 0) return;

    onAddRecurringPayment({
      title: recTitle.trim(),
      amount: amt,
      type: recType,
      category: recCategory,
      subcategory: recSubcategory || undefined,
      walletName: recWallet,
      frequency: recFrequency,
      nextDueDate: recDueDate,
      reminderMinutesBefore: parseInt(recReminderMins, 10) || 1440,
      isActive: true,
    });

    setRecTitle('');
    setRecAmount('');
    setShowAddRecurring(false);
  };

  const handleImportCsvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseImportedTransactionsCsv(
        String(reader.result || ''),
        wallets[0]?.name || 'Картка PKO BP'
      );
      if (parsed.length > 0) {
        onImportTransactions(parsed);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Compute breakdown of expenses by priority (Потрібно vs Можу vs Хочу) на основі підкатегорій з конвертацією до основної валюти
  const priorityStats = useMemo(() => {
    let needTotal = 0;
    let couldTotal = 0;
    let wantTotal = 0;
    let totalExp = 0;

    transactions.forEach((tx) => {
      if (tx.type === 'expense') {
        // Respect current ledger period if filtering by month
        if (!showAllLedgerMonths && ledgerMonth) {
          if (!tx.date.startsWith(ledgerMonth)) return;
        }

        const txCurrency = getTransactionCurrencyCode(tx, wallets, currencyCode);

        if (tx.splits && tx.splits.length > 0) {
          tx.splits.forEach((s) => {
            const prio = s.expensePriority || tx.expensePriority || 'need';
            const convertedAmt = convertCurrency(
              s.amount,
              txCurrency,
              currencyCode,
              customExchangeRates
            );
            totalExp += convertedAmt;
            if (prio === 'want') {
              wantTotal += convertedAmt;
            } else if (prio === 'could') {
              couldTotal += convertedAmt;
            } else {
              needTotal += convertedAmt;
            }
          });
        } else {
          const prio = tx.expensePriority || 'need';
          const convertedAmt = convertCurrency(
            tx.amount,
            txCurrency,
            currencyCode,
            customExchangeRates
          );
          totalExp += convertedAmt;
          if (prio === 'want') {
            wantTotal += convertedAmt;
          } else if (prio === 'could') {
            couldTotal += convertedAmt;
          } else {
            needTotal += convertedAmt;
          }
        }
      }
    });

    const needPct = totalExp > 0 ? (needTotal / totalExp) * 100 : 0;
    const couldPct = totalExp > 0 ? (couldTotal / totalExp) * 100 : 0;
    const wantPct = totalExp > 0 ? (wantTotal / totalExp) * 100 : 0;

    return {
      needTotal,
      couldTotal,
      wantTotal,
      totalExp,
      needPct,
      couldPct,
      wantPct,
    };
  }, [transactions, wallets, currencyCode, customExchangeRates, showAllLedgerMonths, ledgerMonth]);

  const filteredTransactions = useMemo(() => {
    const list = transactions.filter((tx) => {
      if (!showAllLedgerMonths && ledgerMonth) {
        if (!tx.date.startsWith(ledgerMonth)) return false;
      }

      const matchesType = typeFilter === 'all' || tx.type === typeFilter;
      if (!matchesType) return false;

      if (priorityFilter !== 'all') {
        if (tx.type !== 'expense') return false;
        if (tx.splits && tx.splits.length > 0) {
          const hasSplitMatching = tx.splits.some(
            (s) => (s.expensePriority || tx.expensePriority || 'need') === priorityFilter
          );
          if (!hasSplitMatching) return false;
        } else {
          const prio = tx.expensePriority || 'need';
          if (prio !== priorityFilter) return false;
        }
      }

      const matchesCat =
        selectedCategoryFilter === 'all' ||
        tx.category === selectedCategoryFilter;
      const matchesWal =
        walletFilter === 'all' ||
        tx.paymentMethod === walletFilter ||
        tx.toWalletName === walletFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        tx.description.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        (tx.subcategory && tx.subcategory.toLowerCase().includes(q)) ||
        (tx.merchant && tx.merchant.toLowerCase().includes(q)) ||
        tx.paymentMethod.toLowerCase().includes(q) ||
        (tx.linkedWorkMonth && tx.linkedWorkMonth.toLowerCase().includes(q));
      return matchesCat && matchesWal && matchesSearch;
    });

    return [...list].sort(
      (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
    );
  }, [
    transactions,
    ledgerMonth,
    showAllLedgerMonths,
    typeFilter,
    priorityFilter,
    selectedCategoryFilter,
    walletFilter,
    searchQuery,
  ]);

  const displayedTransactions = useMemo(() => {
    return isLedgerExpanded ? filteredTransactions : filteredTransactions.slice(0, 10);
  }, [filteredTransactions, isLedgerExpanded]);

  const frequencyLabels: Record<RecurringPayment['frequency'], string> = {
    monthly: 'Щомісяця',
    weekly: 'Щотижня',
    yearly: 'Щороку',
  };

  // Recurring Payments Calendar Widget State
  const [calYearMonth, setCalYearMonth] = useState<string>(() => {
    return (
      recurringPayments[0]?.nextDueDate?.slice(0, 7) ||
      new Date().toISOString().slice(0, 7)
    );
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [selectedRecurringId, setSelectedRecurringId] = useState<string | null>(null);

  const todayDateStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const handleCalPrevMonth = () => {
    const [yStr, mStr] = (calYearMonth || '2026-10').split('-');
    let y = parseInt(yStr, 10) || 2026;
    let m = (parseInt(mStr, 10) || 10) - 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setCalYearMonth(`${y}-${String(m).padStart(2, '0')}`);
  };

  const handleCalNextMonth = () => {
    const [yStr, mStr] = (calYearMonth || '2026-10').split('-');
    let y = parseInt(yStr, 10) || 2026;
    let m = (parseInt(mStr, 10) || 10) + 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setCalYearMonth(`${y}-${String(m).padStart(2, '0')}`);
  };

  const handleCalTodayMonth = () => {
    const now = new Date();
    setCalYearMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  };

  const isPaymentDueOnDate = (rec: RecurringPayment, dateStr: string): boolean => {
    if (rec.nextDueDate === dateStr) return true;
    const [y, m, d] = dateStr.split('-').map(Number);
    const [recY, recM, recD] = (rec.nextDueDate || '').split('-').map(Number);
    if (!recD || isNaN(recD)) return false;

    if (rec.frequency === 'monthly') {
      const daysInThisMonth = new Date(y, m, 0).getDate();
      const targetDay = Math.min(recD, daysInThisMonth);
      return d === targetDay;
    }
    if (rec.frequency === 'weekly') {
      const targetTime = new Date(y, m - 1, d).getTime();
      const recTime = new Date(recY, recM - 1, recD).getTime();
      const diffDays = Math.round((targetTime - recTime) / (1000 * 60 * 60 * 24));
      return diffDays % 7 === 0;
    }
    if (rec.frequency === 'yearly') {
      return m === recM && d === recD;
    }
    return false;
  };

  const getPaymentsForDate = (dateStr: string) => {
    return recurringPayments.filter((rec) => isPaymentDueOnDate(rec, dateStr));
  };

  const calendarGrid = useMemo(() => {
    const [yStr, mStr] = (calYearMonth || '2026-10').split('-');
    const year = parseInt(yStr, 10) || 2026;
    const month = parseInt(mStr, 10) || 10;
    const daysInMonth = new Date(year, month, 0).getDate();
    // Monday = 0, Sunday = 6
    const firstDayDow = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const prevMonthDays = new Date(year, month - 1, 0).getDate();

    const cells: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      payments: RecurringPayment[];
      totalAmount: number;
    }[] = [];

    // Prev month padding
    for (let i = firstDayDow - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevM = month === 1 ? 12 : month - 1;
      const prevY = month === 1 ? year - 1 : year;
      const dateStr = `${prevY}-${String(prevM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const pmts = getPaymentsForDate(dateStr);
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        payments: pmts,
        totalAmount: pmts.reduce((sum, p) => sum + p.amount, 0),
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const pmts = getPaymentsForDate(dateStr);
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        payments: pmts,
        totalAmount: pmts.reduce((sum, p) => sum + p.amount, 0),
      });
    }

    // Trailing days to complete grid to multiple of 7
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const nextM = month === 12 ? 1 : month + 1;
      const nextY = month === 12 ? year + 1 : year;
      const dateStr = `${nextY}-${String(nextM).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const pmts = getPaymentsForDate(dateStr);
      cells.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        payments: pmts,
        totalAmount: pmts.reduce((sum, p) => sum + p.amount, 0),
      });
    }

    return cells;
  }, [calYearMonth, recurringPayments]);

  const currentMonthPaymentsTotal = useMemo(() => {
    return calendarGrid
      .filter((cell) => cell.isCurrentMonth)
      .reduce((sum, cell) => sum + cell.totalAmount, 0);
  }, [calendarGrid]);

  const handleCalendarDayClick = (dateStr: string, pmts: RecurringPayment[]) => {
    if (selectedCalendarDate === dateStr) {
      setSelectedCalendarDate(null);
      setSelectedRecurringId(null);
    } else {
      setSelectedCalendarDate(dateStr);
      if (pmts.length > 0) {
        setSelectedRecurringId(pmts[0].id);
        setTimeout(() => {
          const cardEl = document.getElementById(`recurring-card-${pmts[0].id}`);
          if (cardEl) {
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }, 50);
      } else {
        setSelectedRecurringId(null);
      }
    }
  };

  const handleTileClick = (rec: RecurringPayment) => {
    if (selectedRecurringId === rec.id) {
      setSelectedRecurringId(null);
      setSelectedCalendarDate(null);
    } else {
      setSelectedRecurringId(rec.id);
      setSelectedCalendarDate(rec.nextDueDate);
      if (rec.nextDueDate && rec.nextDueDate.length >= 7) {
        setCalYearMonth(rec.nextDueDate.slice(0, 7));
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP SECTION: RECURRING PAYMENTS & CALENDAR SYNC */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Repeat className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Циклічні платежі та синхронізація з Google Calendar
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Створюйте регулярні щомісячні рахунки. При підтвердженні платіж автоматично потрапляє до журналу транзакцій.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddRecurring(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap self-start shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Новий циклічний платіж</span>
          </button>
        </div>

        {/* POPUP MODAL: ADD RECURRING PAYMENT */}
        {showAddRecurring && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
            <div className="relative w-full max-w-2xl lg:max-w-3xl rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                    <CalendarPlus className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Новий регулярний (циклічний) платіж
                    </h3>
                    <p className="text-xs text-slate-500">
                      Оренда житла, комуналка, абонементи, підписки або регулярні доходи
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddRecurring(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateRecurring} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Назва регулярного платежу <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Напр. Оренда квартири, Netflix, Інтернет, Абонемент gym..."
                      value={recTitle}
                      onChange={(e) => setRecTitle(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Сума ({currencySymbol}) <span className="text-red-500">*</span>
                    </label>
                    <MathAmountInput
                      required
                      value={recAmount}
                      onChange={setRecAmount}
                      placeholder="2200.00"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs font-bold text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Тип платежу
                    </label>
                    <select
                      value={recType}
                      onChange={(e) => setRecType(e.target.value as TransactionType)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                    >
                      <option value="expense">Витрата (списання)</option>
                      <option value="income">Дохід (зарахування)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Категорія
                    </label>
                    <select
                      value={recCategory}
                      onChange={(e) => setRecCategory(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                    >
                      {recType === 'expense'
                        ? budgets.map((b) => (
                            <option key={b.id} value={b.name}>
                              {b.name}
                            </option>
                          ))
                        : incomeCategories.map((inc) => (
                            <option key={inc.id} value={inc.name}>
                              {inc.name}
                            </option>
                          ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                      <span>Підкатегорія {recType === 'expense' ? 'витрати' : 'доходу'}</span>
                      {recType === 'expense' && recSubcategories.length > 0 && (
                        <span className="text-[10px] text-indigo-600 font-normal">
                          {recSubcategories.length} варіантів
                        </span>
                      )}
                    </label>
                    <select
                      value={recSubcategory}
                      onChange={(e) => setRecSubcategory(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                    >
                      <option value="">Загальна (без підкатегорії)</option>
                      {recSubcategories.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                    {recSubcategories.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {recSubcategories.map((sub) => (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => setRecSubcategory(sub)}
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                              recSubcategory === sub
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {sub}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Гаманець для операції
                    </label>
                    <select
                      value={recWallet}
                      onChange={(e) => setRecWallet(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                    >
                      {wallets.map((w) => (
                        <option key={w.id} value={w.name}>
                          {w.icon} {w.name} ({w.currencySymbol})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Періодичність
                    </label>
                    <select
                      value={recFrequency}
                      onChange={(e) =>
                        setRecFrequency(
                          e.target.value as RecurringPayment['frequency']
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                    >
                      <option value="monthly">Щомісяця</option>
                      <option value="weekly">Щотижня</option>
                      <option value="yearly">Щороку</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Наступна дата платежу <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={recDueDate}
                      onChange={(e) => setRecDueDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs font-semibold text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Нагадування у Календарі
                    </label>
                    <select
                      value={recReminderMins}
                      onChange={(e) => setRecReminderMins(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                    >
                      <option value="60">За 1 годину до платежу</option>
                      <option value="360">За 6 годин до платежу</option>
                      <option value="1440">За 1 день (24 год)</option>
                      <option value="2880">За 2 дні (48 год)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddRecurring(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    Скасувати
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Зберегти циклічний платіж</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TWO-PART WIDGET: LEFT TILES (SMALLER) + RIGHT CALENDAR */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT PART: RECURRING PAYMENTS TILES (COMPACT) */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Список циклічних платежів ({recurringPayments.length})
                </span>
                {selectedCalendarDate && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                    Дата: {selectedCalendarDate}
                  </span>
                )}
              </div>
              {selectedCalendarDate && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCalendarDate(null);
                    setSelectedRecurringId(null);
                  }}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-800 underline"
                >
                  Скинути підсвітку
                </button>
              )}
            </div>

            {recurringPayments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                <Repeat className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2 text-xs font-semibold text-slate-700">
                  Немає циклічних платежів
                </p>
                <p className="mt-1 text-[11px] text-slate-500">
                  Додайте регулярні витрати або доходи кнопкою «Новий циклічний платіж» вгорі.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[520px] overflow-y-auto pr-1">
                {recurringPayments.map((rec) => {
                  const isHighlighted =
                    selectedRecurringId === rec.id ||
                    (selectedCalendarDate !== null && isPaymentDueOnDate(rec, selectedCalendarDate));

                  const dueDayStr = rec.nextDueDate ? rec.nextDueDate.split('-')[2] : '•';

                  return (
                    <div
                      key={rec.id}
                      id={`recurring-card-${rec.id}`}
                      onClick={() => handleTileClick(rec)}
                      className={`group relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-2.5 sm:p-3 transition-all cursor-pointer ${
                        isHighlighted
                          ? 'border-indigo-400 bg-indigo-50/80 ring-2 ring-indigo-500 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 shadow-2xs'
                      }`}
                    >
                      {/* Left: Day Badge & Info */}
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        {/* Compact Date Box */}
                        <div
                          className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-lg border text-center transition-colors ${
                            isHighlighted
                              ? 'border-indigo-300 bg-indigo-100 text-indigo-900'
                              : 'border-slate-200 bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="text-[9px] font-bold uppercase leading-none text-slate-400">
                            {rec.frequency === 'monthly' ? 'День' : 'Дата'}
                          </span>
                          <span className="text-xs font-black font-mono leading-tight">
                            {dueDayStr}
                          </span>
                        </div>

                        {/* Title & metadata */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`font-semibold text-xs sm:text-sm truncate ${
                                isHighlighted ? 'text-indigo-950 font-bold' : 'text-slate-900'
                              }`}
                              title={rec.title}
                            >
                              {rec.title}
                            </span>
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 shrink-0">
                              {frequencyLabels[rec.frequency]}
                            </span>
                            {isHighlighted && (
                              <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs shrink-0">
                                Обрано
                              </span>
                            )}
                          </div>

                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 truncate flex-wrap">
                            <span className="truncate">
                              {rec.category}
                              {rec.subcategory ? ` · ${rec.subcategory}` : ''}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="font-medium text-slate-700 truncate">
                              {rec.walletName}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="font-mono text-[10px] text-slate-600">
                              Наст: {rec.nextDueDate}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Amount & Action Buttons */}
                      <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                        <div className="text-right">
                          <div className="font-mono text-sm sm:text-base font-bold text-slate-900 tabular-nums whitespace-nowrap">
                            {rec.amount.toLocaleString('uk-UA')} {currencySymbol}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSyncRecurringToCalendar(rec);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs"
                            title="Додати нагадування у Google Calendar"
                          >
                            <Calendar className="h-3 w-3 text-blue-600" />
                            <span className="hidden md:inline">Календар</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onConfirmRecurringPayment(rec);
                            }}
                            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap shadow-xs"
                            title="Підтвердити оплату та додати до журналу витрат"
                          >
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            <span>Підтвердити</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteRecurringPayment(rec.id);
                            }}
                            className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                            title="Видалити циклічний платіж"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT PART: INTERACTIVE MONTHLY CALENDAR */}
          <div className="lg:col-span-5 xl:col-span-5 rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            {/* Calendar Header with Navigation */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCalPrevMonth}
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                  title="Попередній місяць"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="text-sm font-bold text-slate-900 min-w-[125px] text-center">
                  {formatMonthNameUa(calYearMonth)}
                </div>
                <button
                  type="button"
                  onClick={handleCalNextMonth}
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                  title="Наступний місяць"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCalTodayMonth}
                  className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors"
                  title="Поточний місяць"
                >
                  Сьогодні
                </button>
              </div>

              <div className="text-right">
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Сума у місяці
                </div>
                <div className="font-mono text-xs font-bold text-indigo-700">
                  {currentMonthPaymentsTotal.toLocaleString('uk-UA')} {currencySymbol}
                </div>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="mt-3 grid grid-cols-7 gap-1 text-center">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'].map((dayName, idx) => (
                <div
                  key={dayName}
                  className={`text-[10px] font-bold py-1 uppercase tracking-wider ${
                    idx >= 5 ? 'text-amber-600/80' : 'text-slate-400'
                  }`}
                >
                  {dayName}
                </div>
              ))}
            </div>

            {/* Calendar Days Grid */}
            <div className="mt-1 grid grid-cols-7 gap-1">
              {calendarGrid.map((cell, idx) => {
                const hasPayments = cell.payments.length > 0;
                const isSelected = selectedCalendarDate === cell.dateStr;
                const isToday = cell.dateStr === todayDateStr;

                return (
                  <button
                    key={`${cell.dateStr}-${idx}`}
                    type="button"
                    onClick={() => handleCalendarDayClick(cell.dateStr, cell.payments)}
                    disabled={!cell.isCurrentMonth && !hasPayments}
                    className={`min-h-[50px] p-1 flex flex-col justify-between items-center rounded-lg border text-center transition-all ${
                      !cell.isCurrentMonth
                        ? 'opacity-25 border-transparent bg-slate-50/30 text-slate-400 cursor-default'
                        : isSelected
                        ? 'border-indigo-500 bg-indigo-100/90 text-indigo-950 ring-2 ring-indigo-500 shadow-xs'
                        : hasPayments
                        ? 'border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100/60 hover:border-indigo-300 cursor-pointer shadow-2xs'
                        : 'border-slate-100 bg-white hover:bg-slate-50 cursor-pointer text-slate-700'
                    }`}
                  >
                    <div className="w-full flex items-center justify-between">
                      <span
                        className={`text-[11px] leading-tight ${
                          isToday
                            ? 'font-bold text-indigo-600 underline underline-offset-2'
                            : hasPayments
                            ? 'font-bold text-slate-900'
                            : 'font-medium text-slate-700'
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                      {hasPayments && (
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0" />
                      )}
                    </div>

                    {hasPayments ? (
                      <div className="w-full mt-0.5">
                        <span
                          className={`block w-full truncate rounded px-1 py-0.5 font-mono text-[9px] font-bold leading-none ${
                            isSelected
                              ? 'bg-indigo-600 text-white'
                              : 'bg-indigo-100 text-indigo-800'
                          }`}
                          title={cell.payments
                            .map((p) => `${p.title}: ${p.amount.toLocaleString('uk-UA')} ${currencySymbol}`)
                            .join('\n')}
                        >
                          {cell.totalAmount.toLocaleString('uk-UA')} ₴
                        </span>
                      </div>
                    ) : (
                      <div className="h-3" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Hint & Active Selection Banner */}
            {selectedCalendarDate ? (
              <div className="mt-3 flex items-center justify-between rounded-lg bg-indigo-50 p-2 border border-indigo-100 text-xs">
                <span className="text-[11px] text-indigo-900">
                  Вибрано дату: <strong className="font-mono">{selectedCalendarDate}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCalendarDate(null);
                    setSelectedRecurringId(null);
                  }}
                  className="text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 underline"
                >
                  Скинути
                </button>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                <Info className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                <span>
                  Натисніть на число з сумою, щоб знайти та підсвітити платіж у списку зліва.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. MODAL: ADD NEW TRANSACTION */}
      {isAddTransactionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-3xl lg:max-w-4xl rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <Plus className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Додати нову транзакцію
                  </h3>
                  <p className="text-xs text-slate-500">
                    Витрати (з розбивкою на підкатегорії), доходи або переказ між гаманцями
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTransactionModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={handleCreateTransaction}
              className="mt-4 space-y-4"
            >

          {/* Operation Type Switcher */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            {(
              [
                { id: 'expense', label: 'Витрати' },
                { id: 'income', label: 'Дохід' },
                { id: 'transfer', label: 'Переказ' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTxType(tab.id)}
                className={`flex-1 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  txType === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

        {/* Dynamic Fields based on Type */}
        {txType === 'transfer' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  З гаманця (Списання)
                </label>
                <select
                  value={txWallet}
                  onChange={(e) => setTxWallet(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.name}>
                      {w.icon} {w.name} ({w.currencySymbol})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  На гаманець (Зарахування)
                </label>
                <select
                  value={txToWallet}
                  onChange={(e) => setTxToWallet(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.name}>
                      {w.icon} {w.name} ({w.currencySymbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isDifferentCurrencyTransfer && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Сума зарахування на цільову картку ({toWalletObj?.currencySymbol})
                </label>
                <MathAmountInput
                  value={txToAmount}
                  onChange={setTxToAmount}
                  placeholder="Сума у валюті цільового гаманця"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
                />
              </div>
            )}
          </>
        ) : txType === 'income' ? (
          <>
            {/* Income Specific Form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Категорія доходу (додаються окремо)
                </label>
                <select
                  value={txIncomeCategory}
                  onChange={(e) => setTxIncomeCategory(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  {incomeCategories.map((inc) => (
                    <option key={inc.id} value={inc.name}>
                      {inc.name} {inc.isSalary ? '★' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Гаманець для зарахування
                </label>
                <select
                  value={txWallet}
                  onChange={(e) => setTxWallet(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.name}>
                      {w.icon} {w.name} ({w.currencySymbol})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* DEDICATED SALARY & WORK HOURS MONTH LINKAGE BOX */}
            {isSalaryIncomeSelected && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <span className="text-xs font-bold text-blue-900">
                      Джерело: Дохід за відпрацьовані години за календарний місяць
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-medium text-blue-900">
                      Оберіть календарний місяць:
                    </label>
                    <div className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2 py-0.5">
                      <span className="text-xs font-semibold text-blue-950">
                        {formatMonthNameUa(selectedSalaryMonth)}
                      </span>
                      <input
                        type="month"
                        value={selectedSalaryMonth}
                        onChange={(e) => setSelectedSalaryMonth(e.target.value)}
                        className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-xs font-bold text-blue-900 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="rounded-lg bg-white p-2.5 border border-blue-100">
                    <div className="text-[11px] text-slate-500">Період</div>
                    <div className="mt-0.5 font-semibold text-slate-800">
                      {getMonthDateRangeLabel(selectedSalaryMonth)}
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-2.5 border border-blue-100">
                    <div className="text-[11px] text-slate-500">
                      Годин у {txWallet}
                    </div>
                    <div className="mt-0.5 font-mono font-bold text-slate-900">
                      {monthWorkStats.walletHours.toFixed(1)} год
                    </div>
                    <div className="text-[10px] text-slate-400">
                      (всього по всіх картах: {monthWorkStats.totalHours.toFixed(1)}г)
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-2.5 border border-blue-100">
                    <div className="text-[11px] text-slate-500">
                      Спрогнозовано по годинах
                    </div>
                    <div className="mt-0.5 font-mono font-bold text-blue-700">
                      {monthWorkStats.walletProjected.toLocaleString('uk-UA')} {fromWalletObj?.currencySymbol || currencySymbol}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      (вже підтверджено: {monthWorkStats.walletConfirmed.toLocaleString('uk-UA')})
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-2.5 border border-amber-200">
                    <div className="text-[11px] text-amber-700 font-semibold">
                      Залишок до виплати
                    </div>
                    <div className="mt-0.5 font-mono font-bold text-amber-900">
                      {monthWorkStats.walletRemaining.toLocaleString('uk-UA')} {fromWalletObj?.currencySymbol || currencySymbol}
                    </div>
                    <button
                      type="button"
                      onClick={() => setTxAmount(String(monthWorkStats.walletRemaining))}
                      className="mt-1 text-[10px] text-blue-600 hover:underline font-semibold block"
                    >
                      Вставити залишок у форму
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-blue-800">
                  <Info className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span>
                    Коли ви вказуєте суму приходу, вона автоматично віднімається від спрогнозованої суми по годинах за період {getMonthDateRangeLabel(selectedSalaryMonth)}.
                  </span>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Expense Specific Form with Immediate Subcategory Splits */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Категорія витрат <span className="text-red-500">*</span>
                </label>
                <select
                  value={txExpenseCategory}
                  onChange={(e) => setTxExpenseCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  {budgets.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Гаманець списання <span className="text-red-500">*</span>
                </label>
                <select
                  value={txWallet}
                  onChange={(e) => setTxWallet(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  {wallets.map((w) => (
                    <option key={w.id} value={w.name}>
                      {w.icon} {w.name} ({w.currencySymbol})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Назва продавця (торгова точка)
                </label>
                <input
                  type="text"
                  list="saved-merchants-list"
                  value={txMerchant}
                  onChange={(e) => setTxMerchant(e.target.value)}
                  placeholder="Наприклад: Biedronka, Lidl, Żabka..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
                />
                <datalist id="saved-merchants-list">
                  {allKnownMerchants.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* SUBCATEGORY & SPLIT SECTION */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                    <FolderTree className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Підкатегорії витрати
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {isSplitMode
                        ? 'Чек розбивається на окремі суми по підкатегоріях'
                        : 'Виберіть одну підкатегорію або розбийте чек на декілька із сумами'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!isSplitMode) {
                        setIsSplitMode(true);
                        if (txSplits.length <= 1) {
                          setTxSplits([
                            {
                              id: '1',
                              subcategory: txSubcategory || availableSubcategories[0] || '',
                              amount: txAmount || '',
                              note: '',
                              expensePriority: txExpensePriority || 'need',
                            },
                          ]);
                        }
                      } else {
                        setIsSplitMode(false);
                      }
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isSplitMode
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <FolderTree className="h-3.5 w-3.5" />
                    <span>{isSplitMode ? '✓ Розбивка активна' : 'Розбити на підкатегорії'}</span>
                  </button>
                </div>
              </div>

              {/* Single subcategory view */}
              {!isSplitMode ? (
                <div className="pt-1">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Підкатегорія ({txExpenseCategory})
                  </label>
                  <select
                    value={txSubcategory}
                    onChange={(e) => setTxSubcategory(e.target.value)}
                    className="w-full sm:max-w-md rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
                  >
                    {availableSubcategories.length === 0 ? (
                      <option value="">Загальна</option>
                    ) : (
                      availableSubcategories.map((sub) => (
                        <option key={sub} value={sub}>
                          {sub}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              ) : (
                /* Multi-row Subcategory Splits View */
                <div className="space-y-3 pt-1">
                  <div className="space-y-2.5">
                    {txSplits.map((split, index) => (
                      <div
                        key={split.id}
                        className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs"
                      >
                        <div className="flex items-center gap-1.5 lg:w-7 shrink-0 text-xs font-mono font-bold text-slate-400">
                          <span>#{index + 1}</span>
                        </div>

                        {/* Subcategory Select */}
                        <div className="flex-1 min-w-[170px]">
                          <select
                            value={split.subcategory}
                            onChange={(e) => handleUpdateSplitRow(split.id, 'subcategory', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
                          >
                            <option value="">-- Оберіть підкатегорію --</option>
                            {availableSubcategories.map((sub) => (
                              <option key={sub} value={sub}>
                                {sub}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Amount Input */}
                        <div className="w-full lg:w-36 shrink-0 relative">
                          <MathAmountInput
                            placeholder="Сума"
                            value={split.amount}
                            onChange={(val) => handleUpdateSplitRow(split.id, 'amount', val)}
                            className="w-full rounded-lg border border-slate-200 bg-white pl-3 pr-9 py-2 font-mono text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none tabular-nums"
                          />
                          <span className="absolute right-3 top-2 text-xs font-mono font-semibold text-slate-400 pointer-events-none">
                            {fromWalletObj?.currencySymbol || currencySymbol}
                          </span>
                        </div>

                        {/* Per-split Priority Selector */}
                        <div className="shrink-0 flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                          {EXPENSE_PRIORITIES.map((p) => {
                            const isChosen = (split.expensePriority || 'need') === p.id;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleUpdateSplitRow(split.id, 'expensePriority', p.id)}
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                                  isChosen
                                    ? p.id === 'need'
                                      ? 'bg-red-600 text-white shadow-2xs'
                                      : p.id === 'could'
                                      ? 'bg-amber-500 text-white shadow-2xs'
                                      : 'bg-emerald-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                }`}
                                title={`${p.label}: ${p.desc}`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${isChosen ? 'bg-white' : ''}`}
                                  style={!isChosen ? { backgroundColor: p.color } : undefined}
                                />
                                <span>{p.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Note / Comment */}
                        <div className="flex-1 min-w-[130px]">
                          <input
                            type="text"
                            placeholder="Примітка (опціонально)"
                            value={split.note}
                            onChange={(e) => handleUpdateSplitRow(split.id, 'note', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-slate-900 focus:outline-none"
                          />
                        </div>

                        {/* Delete row */}
                        {txSplits.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSplitRow(split.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors self-end lg:self-center"
                            title="Видалити рядок підкатегорії"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Summary & Remaining Strip with + Додати ще суму button */}
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-slate-600">
                        Розподілено по частинах: <strong className="font-mono font-bold text-slate-900">{totalSplitsAmount.toLocaleString('uk-UA')} {fromWalletObj?.currencySymbol || currencySymbol}</strong>
                      </span>
                      {parseFloat(txAmount) > 0 && (
                        <>
                          <span className="text-slate-300">|</span>
                          <span className="text-slate-600">
                            Загальна сума: <strong className="font-mono font-bold text-slate-900">{parseFloat(txAmount).toLocaleString('uk-UA')} {fromWalletObj?.currencySymbol || currencySymbol}</strong>
                          </span>
                        </>
                      )}
                      {parseFloat(txAmount) > totalSplitsAmount && (
                        <button
                          type="button"
                          onClick={() => {
                            handleAddSplitRow();
                          }}
                          className="inline-flex items-center gap-1 font-mono font-semibold text-amber-700 bg-amber-100/70 hover:bg-amber-100 px-2 py-0.5 rounded-md transition-colors"
                        >
                          Залишок: {(parseFloat(txAmount) - totalSplitsAmount).toFixed(2)} {fromWalletObj?.currencySymbol || currencySymbol} (додати в новий рядок)
                        </button>
                      )}
                      {parseFloat(txAmount) === totalSplitsAmount && totalSplitsAmount > 0 && (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                          <Check className="h-3.5 w-3.5" />
                          Суми повністю збігаються
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleAddSplitRow}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-2xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>+ Додати ще суму</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Expense Priority / Color Tag Selector (Only when single subcategory) */}
            {isSplitMode ? (
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-xs text-indigo-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>
                  Пріоритет витрати («Хочу», «Можу», «Потрібно») налаштовано окремо для кожної підкатегорії у рядках вище.
                </span>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>Пріоритет витрати {txSubcategory ? `(«${txSubcategory}»)` : ''}:</span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    «Хочу» (зелений), «Можу» (жовтий), «Потрібно» (червоний)
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {EXPENSE_PRIORITIES.map((p) => {
                    const isSelected = txExpensePriority === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setTxExpensePriority(p.id)}
                        className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition-all ${
                          isSelected
                            ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border border-white/40"
                          style={{ backgroundColor: p.color }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold leading-tight">
                            {p.label}
                          </div>
                          <div
                            className={`text-[10px] leading-tight mt-0.5 ${
                              isSelected ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {p.desc}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Amount, Date, Description */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Загальна сума ({fromWalletObj?.currencySymbol || currencySymbol}) <span className="text-red-500">*</span>
            </label>
            <MathAmountInput
              required
              value={txAmount}
              onChange={(val) => {
                setTxAmount(val);
                if (!isSplitMode && txSplits.length === 1) {
                  setTxSplits([{ ...txSplits[0], amount: val }]);
                }
              }}
              placeholder="100.00"
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-sm font-bold text-slate-900 tabular-nums focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Дата операції <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs font-semibold text-slate-900 focus:border-slate-900 focus:outline-none tabular-nums"
            />
          </div>

          <div className="sm:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Опис / Примітка до транзакції
            </label>
            <input
              type="text"
              placeholder={
                txType === 'transfer'
                  ? 'Переказ між рахунками'
                  : txType === 'income'
                  ? 'Зарплата, аванс, надходження'
                  : 'Закупівля продуктів, чек'
              }
              value={txDescription}
              onChange={(e) => setTxDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
            />
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsAddTransactionModalOpen(false)}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Скасувати
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>
              {txType === 'expense'
                ? 'Записати витрату'
                : txType === 'income'
                ? 'Зарахувати дохід'
                : 'Виконати переказ'}
            </span>
          </button>
        </div>
      </form>
    </div>
  </div>
)}

      {/* 3. TRANSACTION LEDGER WITH SEARCH & FILTERS */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Журнал операцій ({filteredTransactions.length})
            </h3>
            <p className="text-xs text-slate-500">
              Всі витрати, доходи та перекази з детальними підкатегоріями та прив'язкою до годин
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setIsAddTransactionModalOpen(true);
                setTxAmount('');
                setTxToAmount('');
                setTxDescription('');
                setTxMerchant('');
                setIsSplitMode(false);
                setTxSplits([{ id: '1', subcategory: '', amount: '', note: '', expensePriority: txExpensePriority || 'need' }]);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Додати транзакцію</span>
            </button>
          </div>
        </div>

        {/* EXPENSE PRIORITY BREAKDOWN WIDGET (Хочу vs Можу vs Потрібно) */}
        {priorityStats.totalExp > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Аналітика пріоритетів витрат (Хочу vs Можу vs Потрібно)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Всього витрат: {priorityStats.totalExp.toLocaleString('uk-UA')} {currencySymbol}
                </p>
              </div>

              {/* Priority Filter Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-slate-500 font-medium mr-1">Фільтр:</span>
                <button
                  type="button"
                  onClick={() => setPriorityFilter('all')}
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                    priorityFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  Всі
                </button>
                <button
                  type="button"
                  onClick={() => setPriorityFilter('need')}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                    priorityFilter === 'need'
                      ? 'bg-red-600 text-white shadow-2xs'
                      : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  Потрібно ({priorityStats.needPct.toFixed(0)}%)
                </button>
                <button
                  type="button"
                  onClick={() => setPriorityFilter('could')}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                    priorityFilter === 'could'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Можу ({priorityStats.couldPct.toFixed(0)}%)
                </button>
                <button
                  type="button"
                  onClick={() => setPriorityFilter('want')}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                    priorityFilter === 'want'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Хочу ({priorityStats.wantPct.toFixed(0)}%)
                </button>
              </div>
            </div>

            {/* Proportion Bar */}
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 flex">
              <div
                style={{ width: `${priorityStats.needPct}%` }}
                className="bg-red-500 transition-all"
                title={`Потрібно: ${priorityStats.needTotal.toLocaleString('uk-UA')} ${currencySymbol} (${priorityStats.needPct.toFixed(1)}%)`}
              />
              <div
                style={{ width: `${priorityStats.couldPct}%` }}
                className="bg-amber-500 transition-all"
                title={`Можу: ${priorityStats.couldTotal.toLocaleString('uk-UA')} ${currencySymbol} (${priorityStats.couldPct.toFixed(1)}%)`}
              />
              <div
                style={{ width: `${priorityStats.wantPct}%` }}
                className="bg-emerald-500 transition-all"
                title={`Хочу: ${priorityStats.wantTotal.toLocaleString('uk-UA')} ${currencySymbol} (${priorityStats.wantPct.toFixed(1)}%)`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="rounded-lg bg-white border border-red-200 p-2.5">
                <div className="flex items-center gap-1.5 font-bold text-red-900">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span>Потрібно (Обовʼязкові витрати)</span>
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-red-700">
                  {priorityStats.needTotal.toLocaleString('uk-UA')} {currencySymbol}
                </div>
                <div className="text-[10px] text-red-600">
                  {priorityStats.needPct.toFixed(1)}% загальних витрат
                </div>
              </div>

              <div className="rounded-lg bg-white border border-amber-200 p-2.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>Можу (Комфорт та плани)</span>
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-amber-700">
                  {priorityStats.couldTotal.toLocaleString('uk-UA')} {currencySymbol}
                </div>
                <div className="text-[10px] text-amber-600">
                  {priorityStats.couldPct.toFixed(1)}% загальних витрат
                </div>
              </div>

              <div className="rounded-lg bg-white border border-emerald-200 p-2.5">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span>Хочу (Бажання та розваги)</span>
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-emerald-700">
                  {priorityStats.wantTotal.toLocaleString('uk-UA')} {currencySymbol}
                </div>
                <div className="text-[10px] text-emerald-600">
                  {priorityStats.wantPct.toFixed(1)}% загальних витрат
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Пошук операції..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900"
            />
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
            >
              <option value="all">Усі типи операцій</option>
              <option value="expense">Тільки витрати</option>
              <option value="income">Тільки доходи</option>
              <option value="transfer">Тільки перекази</option>
            </select>
          </div>

          <div>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => onSelectCategoryFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
            >
              <option value="all">Усі категорії</option>
              <optgroup label="Витрати">
                {budgets.map((b) => (
                  <option key={b.id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Доходи">
                {incomeCategories.map((inc) => (
                  <option key={inc.id} value={inc.name}>
                    {inc.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <select
              value={walletFilter}
              onChange={(e) => setWalletFilter(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
            >
              <option value="all">Усі гаманці</option>
              {wallets.map((w) => (
                <option key={w.id} value={w.name}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Month Selector & Period Bar for Transaction Ledger */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Місяць журналу:</span>
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={handlePrevMonth}
                disabled={showAllLedgerMonths}
                className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Попередній місяць"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-3 font-medium text-xs text-slate-900 min-w-[120px] text-center">
                {showAllLedgerMonths ? 'Всі місяці' : formatMonthNameUa(ledgerMonth)}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                disabled={showAllLedgerMonths}
                className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Наступний місяць"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowAllLedgerMonths(!showAllLedgerMonths);
                setIsLedgerExpanded(false);
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                showAllLedgerMonths
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {showAllLedgerMonths ? 'Фільтрувати по місяцю' : 'Всі періоди'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {filteredTransactions.length > 0 ? (
              <span className="text-slate-500">
                Знайдено {filteredTransactions.length}{' '}
                {filteredTransactions.length === 1
                  ? 'операцію'
                  : filteredTransactions.length < 5
                  ? 'операції'
                  : 'операцій'}
              </span>
            ) : (
              <span className="text-slate-400">Немає операцій за цей період</span>
            )}
            {priorityFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-800 font-semibold border border-slate-200">
                Сума за фільтром «{priorityFilter === 'want' ? 'Хочу' : priorityFilter === 'could' ? 'Можу' : 'Потрібно'}»:{' '}
                <strong className="text-slate-900">
                  {(priorityFilter === 'want'
                    ? priorityStats.wantTotal
                    : priorityFilter === 'could'
                    ? priorityStats.couldTotal
                    : priorityStats.needTotal
                  ).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                  {currencySymbol}
                </strong>
              </span>
            )}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
              <tr>
                <th className="px-4 py-2.5">Дата</th>
                <th className="px-4 py-2.5">Тип</th>
                <th className="px-4 py-2.5">Категорія</th>
                <th className="px-4 py-2.5">Опис</th>
                <th className="px-4 py-2.5">Продавець</th>
                <th className="px-4 py-2.5 font-mono text-right">Сума</th>
                <th className="px-4 py-2.5 text-right">Дія</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {displayedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    Немає операцій для відображення
                  </td>
                </tr>
              ) : (
                displayedTransactions.map((tx, idx) => {
                  const txWalletObj = wallets.find((w) => w.name === tx.paymentMethod);
                  const wSym = txWalletObj?.currencySymbol || currencySymbol;
                  const prevTx = idx > 0 ? displayedTransactions[idx - 1] : null;
                  const isNewDay = !prevTx || prevTx.date !== tx.date;

                  // Day summary metrics
                  const dayExpenses = isNewDay
                    ? filteredTransactions
                        .filter((t) => t.date === tx.date && t.type === 'expense')
                        .reduce((sum, t) => sum + t.amount, 0)
                    : 0;
                  const dayCount = isNewDay
                    ? filteredTransactions.filter((t) => t.date === tx.date).length
                    : 0;

                  return (
                    <React.Fragment key={tx.id}>
                      {isNewDay && (
                        <tr className="bg-slate-100/90 border-t-2 border-b border-slate-300">
                          <td colSpan={7} className="px-4 py-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-100 text-indigo-700">
                                  <Calendar className="h-3 w-3" />
                                </span>
                                <span className="font-bold text-slate-800 text-xs">
                                  {formatDateUa(tx.date)}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  ({dayCount} {dayCount === 1 ? 'операція' : dayCount < 5 ? 'операції' : 'операцій'})
                                </span>
                              </div>
                              {dayExpenses > 0 && (
                                <div className="text-[11px] font-mono font-semibold text-red-700">
                                  Витрати за день: -{dayExpenses.toLocaleString('uk-UA')} {currencySymbol}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}

                      <tr className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono whitespace-nowrap text-slate-600 text-[11px]">
                          {tx.date}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          {tx.type === 'expense' ? (
                            <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                              <ArrowDownLeft className="h-3 w-3" />
                              Витрата
                            </span>
                          ) : tx.type === 'income' ? (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                              <ArrowUpRight className="h-3 w-3" />
                              Дохід
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                              <ArrowLeftRight className="h-3 w-3" />
                              Переказ
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{tx.category}</span>
                            {tx.type === 'expense' && (tx.splits?.length || tx.subcategory) ? (
                              <button
                                type="button"
                                onClick={() => toggleTxExpand(tx.id)}
                                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                                  expandedTxIds.has(tx.id)
                                    ? 'bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                                title={expandedTxIds.has(tx.id) ? 'Згорнути підкатегорії' : 'Розгорнути підкатегорії'}
                              >
                                <span>
                                  {tx.splits && tx.splits.length > 0
                                    ? `${tx.splits.length} підкат.`
                                    : 'підкатегорія'}
                                </span>
                                {expandedTxIds.has(tx.id) ? (
                                  <ChevronDown className="h-3 w-3 text-indigo-600" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 text-slate-400" />
                                )}
                              </button>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            {tx.type === 'transfer' ? (
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-700 px-1.5 py-0.5 text-[10px] font-medium border border-slate-200">
                                💳 {tx.paymentMethod} → <strong>{tx.toWalletName}</strong>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-700 px-1.5 py-0.5 text-[10px] font-medium border border-slate-200">
                                💳 {tx.paymentMethod}
                              </span>
                            )}
                          </div>

                          {/* Subcategories revealed ONLY for expenses when expanded */}
                          {tx.type === 'expense' && expandedTxIds.has(tx.id) && (
                            <div className="mt-2 space-y-1 pl-3 pr-2 py-1.5 rounded-lg border border-slate-200/80 bg-slate-50/90 text-xs">
                              {tx.splits && tx.splits.length > 0 ? (
                                <div className="space-y-1">
                                  <div className="text-[10px] font-semibold text-indigo-700 flex items-center gap-1">
                                    <FolderTree className="h-3 w-3" />
                                    <span>Підкатегорії ({tx.splits.length}):</span>
                                  </div>
                                  <div className="space-y-1">
                                    {tx.splits.map((s, sIdx) => {
                                      const pObj = EXPENSE_PRIORITIES.find(
                                        (p) => p.id === (s.expensePriority || tx.expensePriority)
                                      );
                                      return (
                                        <div
                                          key={sIdx}
                                          className="flex items-center justify-between gap-2 text-slate-700 bg-white px-2 py-1 rounded border border-slate-200/80 text-[11px]"
                                        >
                                          <div className="flex items-center gap-1.5 truncate">
                                            <span className="text-slate-400 font-mono text-[10px]">└─</span>
                                            {pObj && (
                                              <span
                                                className="h-2 w-2 rounded-full shrink-0"
                                                style={{ backgroundColor: pObj.color }}
                                                title={`Пріоритет: ${pObj.label}`}
                                              />
                                            )}
                                            <span className="font-semibold text-slate-900 truncate">
                                              {s.subcategory}
                                            </span>
                                            {pObj && (
                                              <span
                                                className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${pObj.badgeBg}`}
                                              >
                                                {pObj.label}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                                            <span className="font-mono font-bold text-slate-900">
                                              {s.amount.toLocaleString('uk-UA')} {wSym}
                                            </span>
                                            {s.note && (
                                              <span className="text-slate-400 text-[10px] truncate max-w-[120px]">
                                                · {s.note}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : tx.subcategory ? (
                                <div className="flex items-center justify-between gap-2 text-slate-700 bg-white px-2 py-1 rounded border border-slate-200/80 text-[11px]">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-slate-400 font-mono text-[10px]">└─</span>
                                    {(() => {
                                      const pObj = EXPENSE_PRIORITIES.find(
                                        (p) => p.id === tx.expensePriority
                                      );
                                      return (
                                        <>
                                          {pObj && (
                                            <span
                                              className="h-2 w-2 rounded-full shrink-0"
                                              style={{ backgroundColor: pObj.color }}
                                              title={`Пріоритет: ${pObj.label}`}
                                            />
                                          )}
                                          <span className="font-semibold text-slate-900">{tx.subcategory}</span>
                                          {pObj && (
                                            <span
                                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${pObj.badgeBg}`}
                                            >
                                              {pObj.label}
                                            </span>
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                                    {tx.amount.toLocaleString('uk-UA')} {wSym}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          <div>{tx.description}</div>
                          {tx.linkedWorkMonth && (
                            <span className="inline-flex items-center gap-1 mt-0.5 rounded bg-blue-100 px-1.5 py-0.2 text-[10px] font-semibold text-blue-800 font-mono">
                              <Clock className="h-2.5 w-2.5" />
                              Години за {tx.linkedWorkMonth}
                            </span>
                          )}
                        </td>

                        {/* Dedicated Merchant Column */}
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-700">
                          {tx.merchant ? (
                            <span className="font-medium text-slate-900">{tx.merchant}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="px-4 py-3 font-mono font-bold text-right tabular-nums whitespace-nowrap">
                          <span
                            className={
                              tx.type === 'expense'
                                ? 'text-red-600'
                                : tx.type === 'income'
                                ? 'text-emerald-700'
                                : 'text-blue-700'
                            }
                          >
                            {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                            {tx.amount.toLocaleString('uk-UA')} {wSym}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(tx)}
                              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-colors shadow-2xs"
                              title="Редагувати транзакцію"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteTransaction(tx.id)}
                              className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                              title="Видалити транзакцію"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 10 Operations Limit & Pagination Toggle */}
        {filteredTransactions.length > 10 && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="text-xs text-slate-500 font-medium">
              {isLedgerExpanded
                ? `Відображено всі ${filteredTransactions.length} операцій`
                : `Відображено останні 10 з ${filteredTransactions.length} операцій`}
            </div>
            <button
              type="button"
              onClick={() => setIsLedgerExpanded(!isLedgerExpanded)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
            >
              {isLedgerExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 text-indigo-600" />
                  <span>Згорнути до 10 операцій</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 text-indigo-600" />
                  <span>Показати всі операції (ще {filteredTransactions.length - 10})</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* 4. MODAL: EDIT TRANSACTION (Allows full editing of any transaction) */}
      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-3xl lg:max-w-4xl rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Edit3 className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Редагування транзакції
                  </h3>
                  <p className="text-xs text-slate-500">
                    ID: {editingTx.id} · {editingTx.date}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTransaction} className="mt-4 space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Тип операції
                </label>
                <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
                  {(
                    [
                      { id: 'expense', label: 'Витрата' },
                      { id: 'income', label: 'Дохід' },
                      { id: 'transfer', label: 'Переказ' },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setEditType(t.id)}
                      className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
                        editType === t.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Дата операції <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900 tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Сума ({currencySymbol}) <span className="text-red-500">*</span>
                  </label>
                  <MathAmountInput
                    required
                    value={editAmount}
                    onChange={(val) => {
                      setEditAmount(val);
                      if (!editIsSplit && editSplits.length === 1) {
                        setEditSplits([{ ...editSplits[0], amount: val }]);
                      }
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 tabular-nums"
                  />
                </div>
              </div>

              {/* Wallet & Transfer Target */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {editType === 'transfer' ? 'З гаманця' : 'Гаманець'}
                  </label>
                  <select
                    value={editWallet}
                    onChange={(e) => setEditWallet(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                  >
                    {wallets.map((w) => (
                      <option key={w.id} value={w.name}>
                        {w.icon} {w.name} ({w.currencySymbol})
                      </option>
                    ))}
                  </select>
                </div>

                {editType === 'transfer' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      На гаманець
                    </label>
                    <select
                      value={editToWallet}
                      onChange={(e) => setEditToWallet(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                    >
                      {wallets.map((w) => (
                        <option key={w.id} value={w.name}>
                          {w.icon} {w.name} ({w.currencySymbol})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Category & Merchant / Subcategory */}
              {editType === 'expense' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Категорія
                      </label>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                      >
                        {budgets.map((b) => (
                          <option key={b.id} value={b.name}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Назва продавця
                      </label>
                      <input
                        type="text"
                        list="edit-merchants-list"
                        value={editMerchant}
                        onChange={(e) => setEditMerchant(e.target.value)}
                        placeholder="Наприклад: Biedronka, Lidl, Żabka..."
                        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                      />
                      <datalist id="edit-merchants-list">
                        {allKnownMerchants.map((m) => (
                          <option key={m} value={m} />
                        ))}
                      </datalist>
                    </div>
                  </div>

                  {/* Subcategories & Splits Editor */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                          <FolderTree className="h-4 w-4" />
                        </span>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">
                            Підкатегорії витрати
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            {editIsSplit
                              ? 'Розподіл суми по підкатегоріях з окремим пріоритетом'
                              : 'Одиночна підкатегорія або розбивка чеку'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!editIsSplit) {
                            setEditIsSplit(true);
                            if (editSplits.length <= 1) {
                              setEditSplits([
                                {
                                  id: '1',
                                  subcategory: editSubcategory || editAvailableSubcategories[0] || '',
                                  amount: editAmount || '',
                                  note: '',
                                  expensePriority: editExpensePriority || 'need',
                                },
                              ]);
                            }
                          } else {
                            setEditIsSplit(false);
                          }
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          editIsSplit
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <FolderTree className="h-3.5 w-3.5" />
                        <span>{editIsSplit ? '✓ Розбивка активна' : 'Розбити на підкатегорії'}</span>
                      </button>
                    </div>

                    {!editIsSplit ? (
                      <div className="pt-1">
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Підкатегорія ({editCategory})
                        </label>
                        <select
                          value={editSubcategory}
                          onChange={(e) => setEditSubcategory(e.target.value)}
                          className="w-full sm:max-w-md rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
                        >
                          {editAvailableSubcategories.length === 0 ? (
                            <option value="">Загальна</option>
                          ) : (
                            editAvailableSubcategories.map((sub) => (
                              <option key={sub} value={sub}>
                                {sub}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-3 pt-1">
                        <div className="space-y-2.5">
                          {editSplits.map((split, index) => (
                            <div
                              key={split.id}
                              className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs"
                            >
                              <div className="flex items-center gap-1.5 lg:w-7 shrink-0 text-xs font-mono font-bold text-slate-400">
                                <span>#{index + 1}</span>
                              </div>

                              <div className="flex-1 min-w-[170px]">
                                <select
                                  value={split.subcategory}
                                  onChange={(e) => handleUpdateEditSplitRow(split.id, 'subcategory', e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 focus:border-slate-900 focus:outline-none"
                                >
                                  <option value="">-- Оберіть підкатегорію --</option>
                                  {editAvailableSubcategories.map((sub) => (
                                    <option key={sub} value={sub}>
                                      {sub}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="w-full lg:w-36 shrink-0 relative">
                                <MathAmountInput
                                  placeholder="Сума"
                                  value={split.amount}
                                  onChange={(val) => handleUpdateEditSplitRow(split.id, 'amount', val)}
                                  className="w-full rounded-lg border border-slate-200 bg-white pl-3 pr-9 py-2 font-mono text-xs font-bold text-slate-900 focus:border-slate-900 focus:outline-none tabular-nums"
                                />
                                <span className="absolute right-3 top-2 text-xs font-mono font-semibold text-slate-400 pointer-events-none">
                                  {currencySymbol}
                                </span>
                              </div>

                              {/* Per-split Priority Selector */}
                              <div className="shrink-0 flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                                {EXPENSE_PRIORITIES.map((p) => {
                                  const isChosen = (split.expensePriority || 'need') === p.id;
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => handleUpdateEditSplitRow(split.id, 'expensePriority', p.id)}
                                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all ${
                                        isChosen
                                          ? p.id === 'need'
                                            ? 'bg-red-600 text-white shadow-2xs'
                                            : p.id === 'could'
                                            ? 'bg-amber-500 text-white shadow-2xs'
                                            : 'bg-emerald-600 text-white shadow-2xs'
                                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                                      }`}
                                      title={`${p.label}: ${p.desc}`}
                                    >
                                      <span
                                        className={`h-2 w-2 rounded-full ${isChosen ? 'bg-white' : ''}`}
                                        style={!isChosen ? { backgroundColor: p.color } : undefined}
                                      />
                                      <span>{p.label}</span>
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="flex-1 min-w-[130px]">
                                <input
                                  type="text"
                                  placeholder="Примітка"
                                  value={split.note}
                                  onChange={(e) => handleUpdateEditSplitRow(split.id, 'note', e.target.value)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-slate-900 focus:outline-none"
                                />
                              </div>

                              {editSplits.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveEditSplitRow(split.id)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors self-end lg:self-center"
                                  title="Видалити рядок"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-slate-600">
                              Розподілено: <strong className="font-mono font-bold text-slate-900">{totalEditSplitsAmount.toLocaleString('uk-UA')} {currencySymbol}</strong>
                            </span>
                            {parseFloat(editAmount) > totalEditSplitsAmount && (
                              <button
                                type="button"
                                onClick={handleAddEditSplitRow}
                                className="inline-flex items-center gap-1 font-mono font-semibold text-amber-700 bg-amber-100/70 hover:bg-amber-100 px-2 py-0.5 rounded-md transition-colors"
                              >
                                Залишок: {(parseFloat(editAmount) - totalEditSplitsAmount).toFixed(2)} {currencySymbol}
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={handleAddEditSplitRow}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-2xs"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>+ Додати ще суму</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Priority selector when not split */}
                  {!editIsSplit && (
                    <div className="pt-2 border-t border-slate-100">
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Пріоритет витрати {editSubcategory ? `(«${editSubcategory}»)` : ''}
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {EXPENSE_PRIORITIES.map((p) => {
                          const isSel = editExpensePriority === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setEditExpensePriority(p.id)}
                              className={`rounded-xl border p-2.5 text-left text-xs transition-colors ${
                                isSel
                                  ? 'border-slate-900 bg-slate-900 text-white font-bold'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: p.color }}
                                />
                                <span>{p.label}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : editType === 'income' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Категорія доходу
                  </label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                  >
                    {incomeCategories.map((i) => (
                      <option key={i.id} value={i.name}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Опис або примітка
                </label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Опис операції..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
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
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
