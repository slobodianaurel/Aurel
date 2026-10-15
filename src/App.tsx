import React, { useState, useEffect, useMemo } from 'react';
import { User } from 'firebase/auth';
import {
  AppSettings,
  BudgetCategory,
  IncomeCategory,
  INITIAL_BUDGETS,
  INITIAL_INCOME_CATEGORIES,
  INITIAL_RECURRING_PAYMENTS,
  INITIAL_SETTINGS,
  INITIAL_SHIFT_TEMPLATES,
  INITIAL_TRANSACTIONS,
  INITIAL_WALLETS,
  INITIAL_WORK_HOURS,
  RecurringPayment,
  SpreadsheetFileInfo,
  SpreadsheetMetadataInfo,
  TransactionItem,
  WalletItem,
  WorkHourEntry,
  WorkShiftTemplate,
} from './types/finance';
import {
  googleSignIn,
  initAuth,
  logout,
  sendBudgetAlertEmail,
  syncRecurringPaymentToCalendar,
} from './services/googleSheetsService';
import { exportFullCombinedCsvReport } from './utils/csvExport';
import { ExpenseVisualizations } from './components/ExpenseVisualizations';
import {
  BudgetControlSection,
  getCategoryLimitForMonth,
  formatMonthName,
} from './components/BudgetControlSection';
import { WorkHoursSection } from './components/WorkHoursSection';
import { WalletsSection, computeWalletBalance } from './components/WalletsSection';
import { TransactionsAndRecurringSection } from './components/TransactionsAndRecurringSection';
import { SettingsModal, SettingsSection } from './components/SettingsSection';
import { IntegrationsAndBackupSection } from './components/IntegrationsAndBackupSection';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ThemeToggle } from './components/ThemeToggle';
import {
  CheckCircle2,
  Settings,
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PieChart,
  Clock,
  Database,
  SlidersHorizontal,
  Menu,
  X,
  PanelLeftClose,
  Pin,
  Download,
  UploadCloud,
  ChevronRight,
  Tags,
} from 'lucide-react';

type ActiveSection =
  | 'overview'
  | 'wallets'
  | 'transactions'
  | 'budgets'
  | 'categories'
  | 'workhours'
  | 'backup'
  | 'settings';

interface PendingConfirmation {
  title: string;
  description: string;
  affectedItemsSummary?: string;
  confirmLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => Promise<void> | void;
}

const STORAGE_KEYS = {
  SETTINGS: 'finpulse_app_settings_v3',
  WALLETS: 'finpulse_wallets_v3',
  BUDGETS: 'finpulse_budgets_v3',
  MONTHLY_BUDGETS: 'finpulse_monthly_budgets_v3',
  INCOME_CATEGORIES: 'finpulse_income_categories_v3',
  TRANSACTIONS: 'finpulse_transactions_v3',
  RECURRING: 'finpulse_recurring_v3',
  TEMPLATES: 'finpulse_shift_templates_v3',
  WORK_LOGS: 'finpulse_work_logs_v3',
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function advanceDateByFrequency(
  dateStr: string,
  freq: RecurringPayment['frequency']
): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  if (freq === 'weekly') {
    d.setDate(d.getDate() + 7);
  } else if (freq === 'monthly') {
    d.setMonth(d.getMonth() + 1);
  } else if (freq === 'yearly') {
    d.setFullYear(d.getFullYear() + 1);
  }
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('overview');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    'general' | 'wallets' | 'categories' | 'google' | 'widgets' | 'currency'
  >('general');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState<boolean>(false);
  const [selectedBudgetMonth, setSelectedBudgetMonth] = useState<string>('2026-10');

  // Theme state: 'light' | 'dark'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('finpulse_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {}
    return 'light';
  });

  useEffect(() => {
    try {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        localStorage.setItem('finpulse_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('finpulse_theme', 'light');
      }
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleOpenSettings = (
    tab: 'general' | 'wallets' | 'categories' | 'google' | 'widgets' | 'currency' = 'general'
  ) => {
    setSettingsInitialTab(tab);
    setIsSettingsOpen(true);
  };

  // Pre-fill state when jumping from Work Hours to Salary Transaction
  const [pendingSalaryPreFill, setPendingSalaryPreFill] = useState<{
    month: string;
    walletName: string;
    amount: number;
  } | null>(null);

  // Core Domain State (OAuth access token is strictly cached in memory only)
  const [settings, setSettings] = useState<AppSettings>(() =>
    loadFromStorage(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS)
  );
  const [wallets, setWallets] = useState<WalletItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.WALLETS, INITIAL_WALLETS)
  );
  const [transactions, setTransactions] = useState<TransactionItem[]>(() =>
    loadFromStorage(STORAGE_KEYS.TRANSACTIONS, INITIAL_TRANSACTIONS)
  );
  const [budgets, setBudgets] = useState<BudgetCategory[]>(() =>
    loadFromStorage(STORAGE_KEYS.BUDGETS, INITIAL_BUDGETS)
  );
  const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>(() =>
    loadFromStorage(STORAGE_KEYS.INCOME_CATEGORIES, INITIAL_INCOME_CATEGORIES)
  );

  // Dedicated Monthly Budgets independent per calendar month (inherits previous month)
  const [monthlyBudgets, setMonthlyBudgets] = useState<Record<string, Record<string, number>>>(() => {
    const loaded = loadFromStorage<Record<string, Record<string, number>>>(STORAGE_KEYS.MONTHLY_BUDGETS, {});
    if (Object.keys(loaded).length > 0) return loaded;
    const initial: Record<string, number> = {};
    INITIAL_BUDGETS.forEach((b) => {
      initial[b.name] = b.monthlyLimit || 500;
    });
    return { '2026-10': initial };
  });

  const handleUpdateMonthBudget = (month: string, categoryLimits: Record<string, number>) => {
    setMonthlyBudgets((prev) => ({
      ...prev,
      [month]: categoryLimits,
    }));
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.MONTHLY_BUDGETS, JSON.stringify(monthlyBudgets));
    } catch {}
  }, [monthlyBudgets]);
  const [recurringPayments, setRecurringPayments] = useState<
    RecurringPayment[]
  >(() => loadFromStorage(STORAGE_KEYS.RECURRING, INITIAL_RECURRING_PAYMENTS));
  const [shiftTemplates, setShiftTemplates] = useState<WorkShiftTemplate[]>(
    () => loadFromStorage(STORAGE_KEYS.TEMPLATES, INITIAL_SHIFT_TEMPLATES)
  );
  const [workLogs, setWorkLogs] = useState<WorkHourEntry[]>(() =>
    loadFromStorage(STORAGE_KEYS.WORK_LOGS, INITIAL_WORK_HOURS)
  );

  // Persist local state
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.WALLETS, JSON.stringify(wallets));
    } catch {}
  }, [wallets]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    } catch {}
  }, [transactions]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets));
    } catch {}
  }, [budgets]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.INCOME_CATEGORIES,
        JSON.stringify(incomeCategories)
      );
    } catch {}
  }, [incomeCategories]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEYS.RECURRING,
        JSON.stringify(recurringPayments)
      );
    } catch {}
  }, [recurringPayments]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(shiftTemplates));
    } catch {}
  }, [shiftTemplates]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.WORK_LOGS, JSON.stringify(workLogs));
    } catch {}
  }, [workLogs]);

  // Filters
  const [selectedCategoryFilter, setSelectedCategoryFilter] =
    useState<string>('all');

  // Google Workspace Auth (For Google Calendar reminders & Email alerts)
  const [needsAuth, setNeedsAuth] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [syncStatusMessage, setSyncStatusMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Confirmation Modal State
  const [pendingConfirm, setPendingConfirm] =
    useState<PendingConfirmation | null>(null);

  const currencySymbol = settings.currency.symbol;
  const currencyCode = settings.currency.code;

  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser) => {
        setUser(authedUser);
        setNeedsAuth(false);
      },
      () => {
        setUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 4000);
  };

  const showTempMessage = showToast;

  const handleLogin = async () => {
    try {
      setIsLoggingIn(true);
      const res = await googleSignIn();
      if (res?.user) {
        showToast('Успішна авторизація для Календаря та Email.');
      }
    } catch (err: any) {
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        return;
      }
      showToast('Помилка авторизації через Google.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setNeedsAuth(true);
      showToast('Ви вийшли з облікового запису Google.');
    } catch (err: any) {
      showToast('Помилка виходу.');
    }
  };

  // Google Calendar Integration
  const handleSyncRecurringToCalendar = async (rec: RecurringPayment) => {
    if (needsAuth || !user) {
      setSyncError(
        'Для створення нагадування в Календарі увійдіть через Google.'
      );
      return;
    }
    setPendingConfirm({
      title: 'Створити подію у Google Calendar?',
      description: `Створити нагадування про платіж «${rec.title}» (${rec.amount} ${currencySymbol}) на дату ${rec.nextDueDate} із сповіщенням за 24 години?`,
      affectedItemsSummary: `${rec.title} · ${rec.amount} ${currencySymbol} · ${rec.nextDueDate}`,
      confirmLabel: 'Створити подію в Календарі',
      isDestructive: false,
      onConfirm: async () => {
        setPendingConfirm(null);
        try {
          setIsSyncing(true);
          const res = await syncRecurringPaymentToCalendar(rec, currencySymbol);
          setRecurringPayments((prev) =>
            prev.map((r) =>
              r.id === rec.id ? { ...r, calendarEventId: res.eventId } : r
            )
          );
          showTempMessage(
            `Подію «${rec.title}» додано до вашого Google Calendar!`
          );
        } catch (err: any) {
          setSyncError(
            err?.message || 'Помилка синхронізації з Google Calendar.'
          );
        } finally {
          setIsSyncing(false);
        }
      },
    });
  };

  // Trigger Budget Alert Email Confirmation
  const triggerBudgetEmailConfirmation = (
    budget: BudgetCategory,
    spent: number,
    limit: number
  ) => {
    if (needsAuth || !user) {
      setSyncError('Для відправки email увійдіть через Google.');
      return;
    }
    const recipientEmail = settings.notificationEmail;
    if (!recipientEmail) {
      setSyncError('Вкажіть email для сповіщень у налаштуваннях.');
      return;
    }
    const percent = Math.round((spent / limit) * 100);
    setPendingConfirm({
      title: 'Надіслати сповіщення про ліміт бюджету через Gmail?',
      description: `Категорія «${budget.name}» досягла ${percent}% від ліміту (${spent.toLocaleString('uk-UA')} з ${limit.toLocaleString('uk-UA')} ${currencySymbol}). Надіслати сповіщення на ${recipientEmail}?`,
      affectedItemsSummary: `Email: ${recipientEmail} · Категорія: ${budget.name}`,
      confirmLabel: 'Надіслати Email',
      isDestructive: false,
      onConfirm: async () => {
        setPendingConfirm(null);
        try {
          setIsSyncing(true);
          await sendBudgetAlertEmail({
            recipientEmail,
            categoryName: budget.name,
            spentAmount: spent,
            limitAmount: limit,
            thresholdPercent: budget.alertThresholdPercent,
            currencySymbol,
            monthLabel: selectedBudgetMonth,
          });
          showTempMessage(
            `Сповіщення про перевищення бюджету надіслано на ${recipientEmail}.`
          );
        } catch (err: any) {
          setSyncError(err?.message || 'Помилка надсилання сповіщення через Gmail.');
        } finally {
          setIsSyncing(false);
        }
      },
    });
  };

  // Check budget limits on new transactions
  const checkBudgetThresholds = (newTx: Omit<TransactionItem, 'id'>) => {
    if (newTx.type !== 'expense' || !settings.autoEmailBudgetAlerts) return;
    const cat = budgets.find((b) => b.name === newTx.category);
    if (!cat) return;
    const month = newTx.date.slice(0, 7);
    const limit = getCategoryLimitForMonth(cat, month, monthlyBudgets);
    if (limit <= 0) return;

    const currentSpent = transactions
      .filter((t) => t.type === 'expense' && t.category === cat.name && t.date.startsWith(month))
      .reduce((sum, t) => sum + t.amount, 0);
    const newSpent = currentSpent + newTx.amount;
    const alertAmount = (limit * cat.alertThresholdPercent) / 100;

    if (newSpent >= alertAmount && currentSpent < alertAmount && settings.notificationEmail && user) {
      triggerBudgetEmailConfirmation(cat, newSpent, limit);
    }
  };

  // Transactions Handlers
  const handleAddTransaction = (newTx: Omit<TransactionItem, 'id'>) => {
    const created: TransactionItem = {
      ...newTx,
      id: `tx-${Date.now().toString().slice(-5)}`,
    };
    checkBudgetThresholds(newTx);
    setTransactions((prev) => [created, ...prev]);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdateTransaction = (updated: TransactionItem) => {
    setTransactions((prev) =>
      prev.map((t) => (t.id === updated.id ? updated : t))
    );
  };

  const handleImportTransactions = (imported: TransactionItem[]) => {
    setTransactions((prev) => [...imported, ...prev]);
    showTempMessage(`Успішно імпортовано ${imported.length} транзакцій.`);
  };

  const handleRestoreFullBackup = (data: {
    transactions?: TransactionItem[];
    budgets?: BudgetCategory[];
    incomeCategories?: IncomeCategory[];
    wallets?: WalletItem[];
    workLogs?: WorkHourEntry[];
    recurringPayments?: RecurringPayment[];
    shiftTemplates?: WorkShiftTemplate[];
    settings?: AppSettings;
    monthlyBudgets?: Record<string, Record<string, number>>;
  }) => {
    if (data.wallets && Array.isArray(data.wallets)) setWallets(data.wallets);
    if (data.transactions && Array.isArray(data.transactions)) setTransactions(data.transactions);
    if (data.budgets && Array.isArray(data.budgets)) setBudgets(data.budgets);
    if (data.incomeCategories && Array.isArray(data.incomeCategories)) setIncomeCategories(data.incomeCategories);
    if (data.monthlyBudgets && typeof data.monthlyBudgets === 'object') setMonthlyBudgets(data.monthlyBudgets);
    if (data.recurringPayments && Array.isArray(data.recurringPayments)) setRecurringPayments(data.recurringPayments);
    if (data.shiftTemplates && Array.isArray(data.shiftTemplates)) setShiftTemplates(data.shiftTemplates);
    if (data.workLogs && Array.isArray(data.workLogs)) setWorkLogs(data.workLogs);
    if (data.settings && typeof data.settings === 'object') setSettings(data.settings);
    showToast('Всі дані успішно відновлено з резервної копії!');
  };

  const handleClearSyncAndIntegrations = async () => {
    try {
      await logout();
    } catch {}
    try {
      window.localStorage.removeItem('finpulse_google_user');
      window.localStorage.removeItem('finpulse_oauth_token');
    } catch {}
    setUser(null);
    setNeedsAuth(true);
    setIsSyncing(false);
    setSyncStatusMessage(null);
    setSyncError(null);
    showToast('Синхронізацію успішно очищено та відключено. Локальні дані збережено.');
  };

  const handleClearFinancialData = () => {
    setTransactions([]);
    setWorkLogs([]);
    setRecurringPayments([]);
    setBudgets(INITIAL_BUDGETS);
    setIncomeCategories(INITIAL_INCOME_CATEGORIES);
    setShiftTemplates(INITIAL_SHIFT_TEMPLATES);
    setMonthlyBudgets({});
    setWallets(INITIAL_WALLETS.map((w) => ({ ...w, initialBalance: 0 })));
    try {
      window.localStorage.removeItem(STORAGE_KEYS.TRANSACTIONS);
      window.localStorage.removeItem(STORAGE_KEYS.WORK_LOGS);
      window.localStorage.removeItem(STORAGE_KEYS.RECURRING);
      window.localStorage.removeItem(STORAGE_KEYS.MONTHLY_BUDGETS);
    } catch {}
    showToast('Усі локальні фінансові дані успішно очищено.');
  };

  const handleConfirmRecurringPayment = (rec: RecurringPayment) => {
    handleAddTransaction({
      date: new Date().toISOString().slice(0, 10),
      category: rec.category,
      subcategory: rec.subcategory,
      description: `Циклічний платіж: ${rec.title}`,
      amount: rec.amount,
      type: rec.type,
      paymentMethod: rec.walletName,
      toWalletName: rec.toWalletName,
      recurringId: rec.id,
    });

    const nextDate = advanceDateByFrequency(rec.nextDueDate, rec.frequency);
    setRecurringPayments((prev) =>
      prev.map((r) =>
        r.id === rec.id
          ? {
              ...r,
              nextDueDate: nextDate,
              lastConfirmedDate: new Date().toISOString().slice(0, 10),
            }
          : r
      )
    );
    showTempMessage(
      `Платіж «${rec.title}» підтверджено та записано в журнал транзакцій.`
    );
  };

  // Wallets Handlers
  const handleAddWallet = (wallet: Omit<WalletItem, 'id'>) => {
    const created: WalletItem = {
      ...wallet,
      id: `wal-${Date.now().toString().slice(-4)}`,
    };
    setWallets((prev) => [...prev, created]);
    showTempMessage(`Створено новий гаманець: ${created.name}`);
  };

  const handleUpdateWallet = (updated: WalletItem, oldName?: string) => {
    setWallets((prev) =>
      prev.map((w) => (w.id === updated.id ? updated : w))
    );
    if (oldName && oldName !== updated.name) {
      setTransactions((prev) =>
        prev.map((t) => ({
          ...t,
          paymentMethod:
            t.paymentMethod === oldName ? updated.name : t.paymentMethod,
          toWalletName:
            t.toWalletName === oldName ? updated.name : t.toWalletName,
        }))
      );
      setRecurringPayments((prev) =>
        prev.map((r) => ({
          ...r,
          walletName: r.walletName === oldName ? updated.name : r.walletName,
        }))
      );
      setWorkLogs((prev) =>
        prev.map((w) => ({
          ...w,
          walletName: w.walletName === oldName ? updated.name : w.walletName,
        }))
      );
    }
  };

  const handleDeleteWallet = (id: string) => {
    const target = wallets.find((w) => w.id === id);
    if (!target) return;
    setWallets((prev) => prev.filter((w) => w.id !== id));
    showTempMessage(`Гаманець «${target.name}» видалено.`);
  };

  const handleImportWallets = (imported: WalletItem[]) => {
    setWallets(imported);
    showTempMessage(`Імпортовано ${imported.length} гаманців.`);
  };

  // Budgets Handlers
  const handleAddBudget = (b: Omit<BudgetCategory, 'id'>) => {
    const created: BudgetCategory = {
      ...b,
      id: `cat-${Date.now().toString().slice(-4)}`,
    };
    setBudgets((prev) => [...prev, created]);
  };

  const handleUpdateBudget = (updated: BudgetCategory, oldName?: string) => {
    setBudgets((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b))
    );
    if (oldName && oldName !== updated.name) {
      setTransactions((prev) =>
        prev.map((t) => (t.category === oldName ? { ...t, category: updated.name } : t))
      );
    }
  };

  const handleDeleteBudget = (id: string) => {
    setBudgets((prev) => prev.filter((b) => b.id !== id));
  };

  const handleCreateNextMonthBudget = (fromMonth: string, toMonth: string) => {
    const fromBudget = monthlyBudgets[fromMonth] || {};
    const cloned: Record<string, number> = {};
    budgets.forEach((b) => {
      cloned[b.name] = fromBudget[b.name] ?? getCategoryLimitForMonth(b, fromMonth, monthlyBudgets);
    });
    setMonthlyBudgets((prev) => ({
      ...prev,
      [toMonth]: cloned,
    }));
    setSelectedBudgetMonth(toMonth);
    showTempMessage(
      `Бюджет на ${toMonth} сформовано на основі лімітів ${fromMonth}.`
    );
  };

  // Recurring Payment Handlers
  const handleAddRecurringPayment = (rec: Omit<RecurringPayment, 'id'>) => {
    const created: RecurringPayment = {
      ...rec,
      id: `rec-${Date.now().toString().slice(-4)}`,
    };
    setRecurringPayments((prev) => [...prev, created]);
  };

  const handleDeleteRecurringPayment = (id: string) => {
    setRecurringPayments((prev) => prev.filter((r) => r.id !== id));
  };

  // Work Hours & Shift Templates Handlers
  const handleAddWorkLog = (entry: Omit<WorkHourEntry, 'id'>) => {
    const newEntry: WorkHourEntry = {
      ...entry,
      id: `wh-${Date.now().toString().slice(-5)}`,
    };
    setWorkLogs((prev) => [newEntry, ...prev]);
  };

  const handleUpdateWorkLog = (updated: WorkHourEntry) => {
    setWorkLogs((prev) =>
      prev.map((w) => (w.id === updated.id ? updated : w))
    );
  };

  const handleUpdateWorkStatus = (
    id: string,
    status: WorkHourEntry['status']
  ) => {
    setWorkLogs((prev) =>
      prev.map((w) => (w.id === id ? { ...w, status } : w))
    );
  };

  const handleDeleteWorkLog = (id: string) => {
    setWorkLogs((prev) => prev.filter((w) => w.id !== id));
  };

  const handleAddTemplate = (tpl: Omit<WorkShiftTemplate, 'id'>) => {
    const created: WorkShiftTemplate = {
      ...tpl,
      id: `tpl-${Date.now().toString().slice(-4)}`,
    };
    setShiftTemplates((prev) => [...prev, created]);
  };

  const handleDeleteTemplate = (id: string) => {
    setShiftTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const handleApplyHourlyRateToAllLogs = (rate: number) => {
    setWorkLogs((prev) =>
      prev.map((w) => ({
        ...w,
        hourlyRate: rate,
        totalEarned: Math.round(w.hoursWorked * rate * 100) / 100,
      }))
    );
  };

  // Jump from Work Hours to Salary Transaction Pre-fill
  const handleNavigateToSalaryTransaction = (
    month: string,
    walletName: string,
    remainingAmount: number
  ) => {
    setPendingSalaryPreFill({
      month,
      walletName,
      amount: remainingAmount,
    });
    setActiveSection('transactions');
  };

  // Category CRUD Handlers with cascade updates to transactions and monthlyBudgets
  const handleAddExpenseCategory = (newCat: BudgetCategory) => {
    setBudgets((prev) => [...prev, newCat]);
    setMonthlyBudgets((prev) => {
      const next: Record<string, Record<string, number>> = {};
      Object.entries(prev).forEach(([m, limits]) => {
        next[m] = {
          ...limits,
          [newCat.name]: newCat.monthlyLimit || 500,
        };
      });
      return next;
    });
  };

  const handleUpdateExpenseCategory = (updatedCat: BudgetCategory, oldName?: string) => {
    setBudgets((prev) =>
      prev.map((b) => (b.id === updatedCat.id ? updatedCat : b))
    );

    if (oldName && oldName !== updatedCat.name) {
      setTransactions((prev) =>
        prev.map((t) =>
          t.type === 'expense' && t.category === oldName
            ? { ...t, category: updatedCat.name }
            : t
        )
      );

      setMonthlyBudgets((prev) => {
        const next: Record<string, Record<string, number>> = {};
        Object.entries(prev).forEach(([m, limits]) => {
          const newLimits: Record<string, number> = {};
          Object.entries(limits).forEach(([catKey, val]) => {
            if (catKey === oldName) {
              newLimits[updatedCat.name] = val;
            } else {
              newLimits[catKey] = val;
            }
          });
          next[m] = newLimits;
        });
        return next;
      });

      setRecurringPayments((prev) =>
        prev.map((r) =>
          r.type === 'expense' && r.category === oldName
            ? { ...r, category: updatedCat.name }
            : r
        )
      );

      if (selectedCategoryFilter === oldName) {
        setSelectedCategoryFilter(updatedCat.name);
      }
    }
  };

  const handleDeleteExpenseCategory = (categoryId: string, reassignToCatName?: string) => {
    const targetCat = budgets.find((b) => b.id === categoryId);
    if (!targetCat) return;
    const catName = targetCat.name;

    setBudgets((prev) => prev.filter((b) => b.id !== categoryId));

    if (reassignToCatName) {
      setTransactions((prev) =>
        prev.map((t) =>
          t.type === 'expense' && t.category === catName
            ? { ...t, category: reassignToCatName }
            : t
        )
      );
      setRecurringPayments((prev) =>
        prev.map((r) =>
          r.type === 'expense' && r.category === catName
            ? { ...r, category: reassignToCatName }
            : r
        )
      );
    }

    setMonthlyBudgets((prev) => {
      const next: Record<string, Record<string, number>> = {};
      Object.entries(prev).forEach(([m, limits]) => {
        const newLimits = { ...limits };
        delete newLimits[catName];
        next[m] = newLimits;
      });
      return next;
    });

    if (selectedCategoryFilter === catName) {
      setSelectedCategoryFilter('all');
    }
  };

  const handleUpdateIncomeCategory = (updatedCat: IncomeCategory, oldName?: string) => {
    setIncomeCategories((prev) =>
      prev.map((i) => (i.id === updatedCat.id ? updatedCat : i))
    );

    if (oldName && oldName !== updatedCat.name) {
      setTransactions((prev) =>
        prev.map((t) =>
          t.type === 'income' && t.category === oldName
            ? { ...t, category: updatedCat.name }
            : t
        )
      );
      setRecurringPayments((prev) =>
        prev.map((r) =>
          r.type === 'income' && r.category === oldName
            ? { ...r, category: updatedCat.name }
            : r
        )
      );
    }
  };

  const handleDeleteIncomeCategory = (categoryId: string, reassignToCatName?: string) => {
    const targetCat = incomeCategories.find((i) => i.id === categoryId);
    if (!targetCat) return;
    const catName = targetCat.name;

    setIncomeCategories((prev) => prev.filter((i) => i.id !== categoryId));

    if (reassignToCatName) {
      setTransactions((prev) =>
        prev.map((t) =>
          t.type === 'income' && t.category === catName
            ? { ...t, category: reassignToCatName }
            : t
        )
      );
      setRecurringPayments((prev) =>
        prev.map((r) =>
          r.type === 'income' && r.category === catName
            ? { ...r, category: reassignToCatName }
            : r
        )
      );
    }
  };

  // Computed Aggregates
  const kpis = useMemo(() => {
    const totalExpenses = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    const totalBudget = budgets.reduce(
      (sum, b) => sum + getCategoryLimitForMonth(b, selectedBudgetMonth, monthlyBudgets),
      0
    );
    const budgetRemaining = totalBudget - totalExpenses;
    const budgetUtilization =
      totalBudget > 0 ? (totalExpenses / totalBudget) * 100 : 0;

    const totalWorkHours = workLogs.reduce((sum, w) => sum + w.hoursWorked, 0);
    const totalWorkEarned = workLogs.reduce((sum, w) => sum + w.totalEarned, 0);
    const netBalanceAfterExpenses = totalIncome - totalExpenses;

    const overBudgetCategoriesCount = budgets.filter((b) => {
      const lim = getCategoryLimitForMonth(b, selectedBudgetMonth, monthlyBudgets);
      if (lim <= 0) return false;
      const spent = transactions
        .filter((t) => t.type === 'expense' && t.category === b.name)
        .reduce((sum, t) => sum + t.amount, 0);
      return spent > lim;
    }).length;

    return {
      totalExpenses,
      totalIncome,
      totalBudget,
      budgetRemaining,
      budgetUtilization,
      totalWorkHours,
      totalWorkEarned,
      netBalanceAfterExpenses,
      overBudgetCategoriesCount,
    };
  }, [transactions, budgets, workLogs, selectedBudgetMonth]);

  // Tab names strictly matching user requirements:
  // "Транзакції", "Гаманці", "Бюджет"
  const navItems: {
    id: ActiveSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[] = [
    { id: 'overview', label: 'Головний екран', icon: LayoutDashboard },
    {
      id: 'wallets',
      label: 'Гаманці',
      icon: Wallet,
      badge: String(wallets.length),
    },
    {
      id: 'transactions',
      label: 'Транзакції',
      icon: ArrowLeftRight,
      badge: String(transactions.length),
    },
    {
      id: 'budgets',
      label: 'Бюджет',
      icon: PieChart,
    },
    {
      id: 'workhours',
      label: 'Години роботи',
      icon: Clock,
      badge: `${kpis.totalWorkHours.toFixed(0)}г`,
    },
    {
      id: 'backup',
      label: 'Імпорт / Експорт / Інтеграції',
      icon: Download,
    },
    {
      id: 'settings',
      label: 'Налаштування',
      icon: Settings,
    },
  ];

  const widgets = settings.dashboardWidgets;

  // Sidebar expanded state on desktop
  const isAutoHideMode = settings.autoHideSidebar;
  const isSidebarExpandedDesktop = !isAutoHideMode || isSidebarHovered;

  return (
    <div className="h-screen bg-[#f8fafc] dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden">
      {/* TOP BAR: App Name on the left, Theme Switcher toggle in the top right corner */}
      <header className="shrink-0 z-30 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 py-3">
        {/* Left Zone: Mobile Menu Toggle + App Name */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
            aria-label="Відкрити меню"
          >
            <Menu className="h-5 w-5" />
          </button>
          <a
            href="#overview"
            onClick={(e) => {
              e.preventDefault();
              setActiveSection('overview');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap flex items-center gap-2"
          >
            <span>FinPulse</span>
          </a>
        </div>

        {/* Right Zone: Theme Toggle Switch (Sun & Moon) */}
        <div className="flex items-center gap-3">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      </header>

      {/* Main Workspace: Navigation Menu on the LEFT (Fixed dock that does not scroll with page) */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Mobile Backdrop */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* LEFT-SIDE NAVIGATION MENU (Dock) */}
        <aside
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
          className={`${
            isMobileMenuOpen
              ? 'fixed inset-y-0 left-0 z-50 flex w-64 shadow-2xl'
              : `hidden lg:flex ${
                  isSidebarExpandedDesktop ? 'w-64' : 'w-16'
                } transition-all duration-300 ease-in-out`
          } shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-3 overflow-y-auto overflow-x-hidden h-full`}
        >
          <div className="space-y-4">
            {/* Sidebar Header: Pin / Auto-hide toggle */}
            <div className="flex items-center justify-between px-2 pt-1">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider text-slate-400 truncate ${
                  !isSidebarExpandedDesktop && !isMobileMenuOpen ? 'hidden' : 'block'
                }`}
              >
                Меню
              </span>

              {/* Pin / Auto-collapse Button */}
              <button
                type="button"
                onClick={() => {
                  setSettings((prev) => ({
                    ...prev,
                    autoHideSidebar: !prev.autoHideSidebar,
                  }));
                }}
                className="hidden lg:flex items-center justify-center rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                title={
                  settings.autoHideSidebar
                    ? 'Закріпити меню розгорнутим'
                    : 'Увімкнути автозгортання при відведенні курсора'
                }
              >
                {settings.autoHideSidebar ? (
                  <PanelLeftClose className="h-4 w-4 text-blue-600" />
                ) : (
                  <Pin className="h-4 w-4 text-slate-400" />
                )}
              </button>

              {/* Mobile Close Button */}
              {isMobileMenuOpen && (
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="lg:hidden rounded p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Navigation links */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                const isExpanded = isSidebarExpandedDesktop || isMobileMenuOpen;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveSection(item.id);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center rounded-lg px-2.5 py-2.5 text-left text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    } ${isExpanded ? 'justify-between' : 'justify-center'}`}
                    title={item.label}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="h-4 w-4 shrink-0" />
                      {isExpanded && <span className="truncate">{item.label}</span>}
                    </div>

                    {isExpanded && item.badge && (
                      <span
                        className={`font-mono text-[11px] tabular-nums ${
                          isActive ? 'text-slate-300' : 'text-slate-400'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Quick Summary in Left Sidebar when expanded */}
            {(isSidebarExpandedDesktop || isMobileMenuOpen) && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Зведення ({formatMonthName(selectedBudgetMonth)})
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Витрати:</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {kpis.totalExpenses.toLocaleString('uk-UA')} {currencySymbol}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Доходи:</span>
                  <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                    +{kpis.totalIncome.toLocaleString('uk-UA')} {currencySymbol}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Години (прогноз):</span>
                  <span className="font-mono font-semibold text-blue-700 tabular-nums">
                    {kpis.totalWorkEarned.toLocaleString('uk-UA')} {currencySymbol}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Actions inside Sidebar */}
          {(isSidebarExpandedDesktop || isMobileMenuOpen) ? (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setActiveSection('settings');
                  setSettingsInitialTab('general');
                  setIsMobileMenuOpen(false);
                }}
                className={`flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium transition-colors ${
                  activeSection === 'settings'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
                <span>Налаштування</span>
              </button>
            </div>
          ) : (
            <div className="pt-3 border-t border-slate-100 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveSection('settings');
                  setSettingsInitialTab('general');
                }}
                className={`p-2 rounded-lg transition-colors ${
                  activeSection === 'settings'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-400 hover:text-slate-900'
                }`}
                title="Налаштування"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          )}
        </aside>

        {/* Main Content Viewport (Scrolls independently while dock remains pinned) */}
        <main className="flex-1 min-w-0 h-full overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1240px] mx-auto">
          {/* Status / Error Banner */}
          {syncStatusMessage && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{syncStatusMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setSyncStatusMessage(null)}
                className="text-emerald-700 hover:underline"
              >
                Закрити
              </button>
            </div>
          )}

          {syncError && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-900">
              <span>{syncError}</span>
              <button
                type="button"
                onClick={() => setSyncError(null)}
                className="text-red-700 hover:underline"
              >
                Закрити
              </button>
            </div>
          )}

          {/* VIEW 1: OVERVIEW (Customizable Home Screen) */}
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* Overview Header with "Редагувати головний екран" */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    Фінансовий та робочий дашборд
                  </h1>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Огляд стану бюджетів, гаманців, відпрацьованих годин та останніх операцій
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap self-start"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  <span>Редагувати головний екран</span>
                </button>
              </div>

              {/* Widget 1: KPI Strip */}
              {widgets.kpiStrip && (
                <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="text-xs font-medium text-slate-500">
                      Витрати за період
                    </div>
                    <div className="mt-2 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                      {kpis.totalExpenses.toLocaleString('uk-UA')} {currencySymbol}
                    </div>
                    <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
                      Використано {kpis.budgetUtilization.toFixed(1)}% ліміту
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="text-xs font-medium text-slate-500">
                      Залишок бюджету ({formatMonthName(selectedBudgetMonth)})
                    </div>
                    <div
                      className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
                        kpis.budgetRemaining < 0 ? 'text-red-600' : 'text-emerald-700'
                      }`}
                    >
                      {kpis.budgetRemaining.toLocaleString('uk-UA')} {currencySymbol}
                    </div>
                    <div className="mt-1.5 text-xs text-slate-500">
                      {kpis.overBudgetCategoriesCount === 0
                        ? 'Усі категорії в межах норми'
                        : `Перевищено у ${kpis.overBudgetCategoriesCount} кат.`}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="text-xs font-medium text-slate-500">
                      Робочі години (прогноз)
                    </div>
                    <div className="mt-2 font-mono text-2xl font-semibold text-blue-700 tabular-nums">
                      {kpis.totalWorkEarned.toLocaleString('uk-UA')} {currencySymbol}
                    </div>
                    <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
                      На основі {kpis.totalWorkHours.toFixed(1)} відпрацьованих годин
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-5">
                    <div className="text-xs font-medium text-slate-500">
                      Чистий потік (Доходи − Витрати)
                    </div>
                    <div
                      className={`mt-2 font-mono text-2xl font-semibold tabular-nums ${
                        kpis.netBalanceAfterExpenses < 0 ? 'text-red-600' : 'text-blue-600'
                      }`}
                    >
                      {kpis.netBalanceAfterExpenses >= 0 ? '+' : ''}
                      {kpis.netBalanceAfterExpenses.toLocaleString('uk-UA')} {currencySymbol}
                    </div>
                    <div className="mt-1.5 text-xs text-slate-500">
                      Оновлюється в реальному часі
                    </div>
                  </div>
                </section>
              )}

              {/* Widget 2: Wallets Overview Strip */}
              {widgets.walletsOverview && (
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-slate-900">
                      Ваші гаманці та поточні залишки
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveSection('wallets')}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Відкрити гаманці →
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {wallets.map((w) => {
                      const st = computeWalletBalance(w, transactions, workLogs);
                      return (
                        <div
                          key={w.id}
                          onClick={() => setActiveSection('wallets')}
                          className="cursor-pointer flex items-center justify-between rounded-lg border border-slate-200 p-3.5 hover:bg-slate-50 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base text-white"
                              style={{ backgroundColor: w.color }}
                            >
                              {w.icon}
                            </span>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-900 truncate">
                                {w.name}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {w.currencyCode}
                              </div>
                            </div>
                          </div>
                          <div className="font-mono text-sm font-semibold text-slate-900 tabular-nums whitespace-nowrap pl-2">
                            {st.currentBalance.toLocaleString('uk-UA')} {w.currencySymbol}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Widget 3: Real-Time Expense Charts */}
              {widgets.charts && (
                <ExpenseVisualizations
                  transactions={transactions}
                  budgets={budgets}
                  wallets={wallets}
                  currencySymbol={currencySymbol}
                  currencyCode={currencyCode}
                  customExchangeRates={settings.customExchangeRates}
                  selectedCategoryFilter={selectedCategoryFilter}
                  onSelectCategory={setSelectedCategoryFilter}
                  selectedMonth={selectedBudgetMonth}
                  onSelectMonth={setSelectedBudgetMonth}
                />
              )}

              {/* Widget 4: Quick Transactions Section */}
              {(widgets.pendingRecurring || widgets.quickTransaction) && (
                <TransactionsAndRecurringSection
                  transactions={transactions}
                  budgets={budgets}
                  incomeCategories={incomeCategories}
                  wallets={wallets}
                  recurringPayments={recurringPayments}
                  workLogs={workLogs}
                  currencySymbol={currencySymbol}
                  currencyCode={currencyCode}
                  customExchangeRates={settings.customExchangeRates}
                  selectedCategoryFilter={selectedCategoryFilter}
                  initialSalaryMonth={pendingSalaryPreFill?.month}
                  initialSalaryWallet={pendingSalaryPreFill?.walletName}
                  initialSalaryAmount={pendingSalaryPreFill?.amount}
                  onSelectCategoryFilter={setSelectedCategoryFilter}
                  onAddTransaction={handleAddTransaction}
                  onUpdateTransaction={handleUpdateTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onImportTransactions={handleImportTransactions}
                  onAddRecurringPayment={handleAddRecurringPayment}
                  onConfirmRecurringPayment={handleConfirmRecurringPayment}
                  onDeleteRecurringPayment={handleDeleteRecurringPayment}
                  onSyncRecurringToCalendar={handleSyncRecurringToCalendar}
                />
              )}

              {/* Widget 5: Budgets Preview */}
              {widgets.budgetsPreview && (
                <BudgetControlSection
                  monthlyBudgets={monthlyBudgets}
                  onUpdateMonthBudget={handleUpdateMonthBudget}
                  budgets={budgets}
                  transactions={transactions}
                  wallets={wallets}
                  workLogs={workLogs}
                  currencySymbol={currencySymbol}
                  currencyCode={currencyCode}
                  selectedMonth={selectedBudgetMonth}
                  notificationEmail={settings.notificationEmail}
                  autoEmailBudgetAlerts={settings.autoEmailBudgetAlerts}
                  onSelectMonth={setSelectedBudgetMonth}
                  onUpdateEmailAlertSettings={(email, autoSend) =>
                    setSettings((prev) => ({
                      ...prev,
                      notificationEmail: email,
                      autoEmailBudgetAlerts: autoSend,
                    }))
                  }
                  onSendBudgetEmailAlert={triggerBudgetEmailConfirmation}
                  onAddExpenseCategory={handleAddExpenseCategory}
                  onUpdateExpenseCategory={handleUpdateExpenseCategory}
                  onDeleteExpenseCategory={handleDeleteExpenseCategory}
                />
              )}

              {/* Widget 6: Work Hours Preview */}
              {widgets.workHoursPreview && (
                <WorkHoursSection
                  workLogs={workLogs}
                  wallets={wallets}
                  shiftTemplates={shiftTemplates}
                  transactions={transactions}
                  currencySymbol={currencySymbol}
                  currencyCode={currencyCode}
                  defaultHourlyRate={settings.defaultHourlyRate}
                  defaultBreakMinutes={settings.defaultBreakMinutes}
                  defaultProject={settings.defaultProject}
                  defaultWalletName={settings.defaultWorkWalletId}
                  showShiftTimer={settings.showShiftTimer}
                  onAddWorkLog={handleAddWorkLog}
                  onUpdateWorkLog={handleUpdateWorkLog}
                  onUpdateStatus={handleUpdateWorkStatus}
                  onDeleteWorkLog={handleDeleteWorkLog}
                  onAddTemplate={handleAddTemplate}
                  onDeleteTemplate={handleDeleteTemplate}
                  onNavigateToSalaryTransaction={handleNavigateToSalaryTransaction}
                />
              )}
            </div>
          )}

          {/* VIEW 2: WALLETS */}
          {activeSection === 'wallets' && (
            <WalletsSection
              wallets={wallets}
              transactions={transactions}
              workLogs={workLogs}
              onOpenSettings={(tab) => handleOpenSettings(tab || 'wallets')}
              onAddWallet={handleAddWallet}
              onUpdateWallet={handleUpdateWallet}
              onDeleteWallet={handleDeleteWallet}
              onImportWallets={handleImportWallets}
              onImportTransactions={handleImportTransactions}
            />
          )}

          {/* VIEW 3: TRANSACTIONS */}
          {activeSection === 'transactions' && (
            <TransactionsAndRecurringSection
              transactions={transactions}
              budgets={budgets}
              incomeCategories={incomeCategories}
              wallets={wallets}
              recurringPayments={recurringPayments}
              workLogs={workLogs}
              currencySymbol={currencySymbol}
              currencyCode={currencyCode}
              customExchangeRates={settings.customExchangeRates}
              selectedCategoryFilter={selectedCategoryFilter}
              initialSalaryMonth={pendingSalaryPreFill?.month}
              initialSalaryWallet={pendingSalaryPreFill?.walletName}
              initialSalaryAmount={pendingSalaryPreFill?.amount}
              onSelectCategoryFilter={setSelectedCategoryFilter}
              onAddTransaction={handleAddTransaction}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onImportTransactions={handleImportTransactions}
              onAddRecurringPayment={handleAddRecurringPayment}
              onConfirmRecurringPayment={handleConfirmRecurringPayment}
              onDeleteRecurringPayment={handleDeleteRecurringPayment}
              onSyncRecurringToCalendar={handleSyncRecurringToCalendar}
            />
          )}

          {/* VIEW 4: BUDGETS */}
          {activeSection === 'budgets' && (
            <BudgetControlSection
              monthlyBudgets={monthlyBudgets}
              onUpdateMonthBudget={handleUpdateMonthBudget}
              budgets={budgets}
              transactions={transactions}
              wallets={wallets}
              workLogs={workLogs}
              currencySymbol={currencySymbol}
              currencyCode={currencyCode}
              selectedMonth={selectedBudgetMonth}
              notificationEmail={settings.notificationEmail}
              autoEmailBudgetAlerts={settings.autoEmailBudgetAlerts}
              onSelectMonth={setSelectedBudgetMonth}
              onUpdateEmailAlertSettings={(email, autoSend) =>
                setSettings((prev) => ({
                  ...prev,
                  notificationEmail: email,
                  autoEmailBudgetAlerts: autoSend,
                }))
              }
              onSendBudgetEmailAlert={triggerBudgetEmailConfirmation}
              onAddExpenseCategory={handleAddExpenseCategory}
              onUpdateExpenseCategory={handleUpdateExpenseCategory}
              onDeleteExpenseCategory={handleDeleteExpenseCategory}
            />
          )}

          {/* VIEW 5: WORK HOURS */}
          {activeSection === 'workhours' && (
            <WorkHoursSection
              workLogs={workLogs}
              wallets={wallets}
              shiftTemplates={shiftTemplates}
              transactions={transactions}
              currencySymbol={currencySymbol}
              currencyCode={currencyCode}
              defaultHourlyRate={settings.defaultHourlyRate}
              defaultBreakMinutes={settings.defaultBreakMinutes}
              defaultProject={settings.defaultProject}
              defaultWalletName={settings.defaultWorkWalletId}
              showShiftTimer={settings.showShiftTimer}
              onAddWorkLog={handleAddWorkLog}
              onUpdateWorkLog={handleUpdateWorkLog}
              onUpdateStatus={handleUpdateWorkStatus}
              onDeleteWorkLog={handleDeleteWorkLog}
              onAddTemplate={handleAddTemplate}
              onDeleteTemplate={handleDeleteTemplate}
              onNavigateToSalaryTransaction={handleNavigateToSalaryTransaction}
            />
          )}

          {/* VIEW 6: BACKUP, EXPORT, IMPORT, CALENDAR & EMAIL */}
          {activeSection === 'backup' && (
            <IntegrationsAndBackupSection
              user={user}
              needsAuth={needsAuth}
              isLoggingIn={isLoggingIn}
              transactions={transactions}
              budgets={budgets}
              incomeCategories={incomeCategories}
              wallets={wallets}
              workLogs={workLogs}
              recurringPayments={recurringPayments}
              shiftTemplates={shiftTemplates}
              settings={settings}
              monthlyBudgets={monthlyBudgets}
              currencySymbol={currencySymbol}
              currencyCode={currencyCode}
              selectedMonth={selectedBudgetMonth}
              onLogin={handleLogin}
              onLogout={handleLogout}
              onImportTransactions={handleImportTransactions}
              onRestoreFullBackup={handleRestoreFullBackup}
              onClearSyncAndIntegrations={handleClearSyncAndIntegrations}
              onClearFinancialData={handleClearFinancialData}
            />
          )}

          {/* VIEW 7: SETTINGS (Dedicated view as tab in the left menu) */}
          {activeSection === 'settings' && (
            <SettingsSection
              isOpen={true}
              embedded={true}
              initialTab={settingsInitialTab}
              onClose={() => setActiveSection('overview')}
              settings={settings}
              wallets={wallets}
              budgets={budgets}
              incomeCategories={incomeCategories}
              transactions={transactions}
              workLogs={workLogs}
              onImportTransactions={handleImportTransactions}
              onUpdateSettings={setSettings}
              onApplyHourlyRateToAllLogs={handleApplyHourlyRateToAllLogs}
              onAddWallet={handleAddWallet}
              onUpdateWallet={handleUpdateWallet}
              onDeleteWallet={handleDeleteWallet}
              onUpdateBudgets={setBudgets}
              onUpdateIncomeCategories={setIncomeCategories}
              onUpdateExpenseCategory={handleUpdateExpenseCategory}
              onDeleteExpenseCategory={handleDeleteExpenseCategory}
              onUpdateIncomeCategory={handleUpdateIncomeCategory}
              onDeleteIncomeCategory={handleDeleteIncomeCategory}
              onRestoreFullBackup={handleRestoreFullBackup}
              monthlyBudgets={monthlyBudgets}
              currencySymbol={currencySymbol}
              currencyCode={currencyCode}
              selectedMonth={selectedBudgetMonth}
              onClearSyncAndIntegrations={handleClearSyncAndIntegrations}
              onClearFinancialData={handleClearFinancialData}
              user={user}
              needsAuth={needsAuth}
              isLoggingIn={isLoggingIn}
              isSyncing={isSyncing}
              syncStatusMessage={syncStatusMessage}
              syncError={syncError}
              onLogin={handleLogin}
              onLogout={handleLogout}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar for smooth access on small screens */}
      <nav className="lg:hidden sticky bottom-0 z-30 flex items-center justify-start sm:justify-around overflow-x-auto scrollbar-none border-t border-slate-200 bg-white/95 backdrop-blur-xs px-2 py-1.5 shadow-xs gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors shrink-0 ${
                isActive
                  ? 'text-slate-900 font-bold bg-slate-100'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-slate-900' : 'text-slate-500'}`} />
              <span className="truncate max-w-[64px] mt-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Settings Modal (Triggered from top-right corner gear icon or sections) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        initialTab={settingsInitialTab}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        wallets={wallets}
        budgets={budgets}
        incomeCategories={incomeCategories}
        transactions={transactions}
        workLogs={workLogs}
        onImportTransactions={handleImportTransactions}
        onRestoreFullBackup={handleRestoreFullBackup}
        onUpdateSettings={setSettings}
        onApplyHourlyRateToAllLogs={handleApplyHourlyRateToAllLogs}
        onAddWallet={handleAddWallet}
        onUpdateWallet={handleUpdateWallet}
        onDeleteWallet={handleDeleteWallet}
        onUpdateBudgets={setBudgets}
        onUpdateIncomeCategories={setIncomeCategories}
        onUpdateExpenseCategory={handleUpdateExpenseCategory}
        onDeleteExpenseCategory={handleDeleteExpenseCategory}
        onUpdateIncomeCategory={handleUpdateIncomeCategory}
        onDeleteIncomeCategory={handleDeleteIncomeCategory}
        monthlyBudgets={monthlyBudgets}
        currencySymbol={currencySymbol}
        currencyCode={currencyCode}
        selectedMonth={selectedBudgetMonth}
        onClearSyncAndIntegrations={handleClearSyncAndIntegrations}
        onClearFinancialData={handleClearFinancialData}
        user={user}
        needsAuth={needsAuth}
        isLoggingIn={isLoggingIn}
        isSyncing={isSyncing}
        syncStatusMessage={syncStatusMessage}
        syncError={syncError}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      {/* Mandatory Confirmation Dialog for Mutating Workspace Operations */}
      <ConfirmDialog
        isOpen={Boolean(pendingConfirm)}
        title={pendingConfirm?.title || ''}
        description={pendingConfirm?.description || ''}
        affectedItemsSummary={pendingConfirm?.affectedItemsSummary}
        confirmLabel={pendingConfirm?.confirmLabel}
        isDestructive={pendingConfirm?.isDestructive}
        onConfirm={() => {
          if (pendingConfirm) {
            pendingConfirm.onConfirm();
          }
        }}
        onCancel={() => setPendingConfirm(null)}
      />
    </div>
  );
}
