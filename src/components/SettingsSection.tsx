import React, { useState, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  AppSettings,
  BudgetCategory,
  CATEGORY_COLORS,
  CurrencyConfig,
  DashboardWidgetsConfig,
  IncomeCategory,
  PRESET_CURRENCIES,
  SpreadsheetFileInfo,
  SpreadsheetMetadataInfo,
  TransactionItem,
  WALLET_COLORS,
  WALLET_ICONS,
  WalletItem,
  WorkHourEntry,
} from '../types/finance';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  exportTransactionsToCsv,
  exportWalletsToCsv,
  exportBudgetsReportToCsv,
  exportWorkHoursToCsv,
  exportFullCombinedCsvReport,
  parseImportedTransactionsCsv,
} from '../utils/csvExport';
import {
  Coins,
  Clock,
  LayoutDashboard,
  Mail,
  X,
  Plus,
  Trash2,
  Check,
  PanelLeftClose,
  Sparkles,
  Wallet,
  Palette,
  Database,
  Calendar,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  PlusCircle,
  ExternalLink,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Download,
  Upload,
  ShieldCheck,
  FileJson,
  FileText,
  AlertTriangle,
  RotateCcw,
  Unlink,
} from 'lucide-react';
import { exportFinancialReportToPdf } from '../utils/pdfExport';
import { formatMonthName, AVAILABLE_MONTHS } from './BudgetControlSection';

interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: 'general' | 'wallets' | 'categories' | 'google' | 'widgets' | 'currency';
  onClose: () => void;
  settings: AppSettings;
  wallets: WalletItem[];
  budgets: BudgetCategory[];
  incomeCategories: IncomeCategory[];
  transactions: TransactionItem[];
  workLogs?: WorkHourEntry[];
  onImportTransactions?: (imported: TransactionItem[]) => void;
  embedded?: boolean;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onApplyHourlyRateToAllLogs: (rate: number) => void;
  onAddWallet?: (wallet: Omit<WalletItem, 'id'>) => void;
  onUpdateWallet?: (wallet: WalletItem, oldName?: string) => void;
  onDeleteWallet?: (id: string) => void;
  onUpdateBudgets: (newBudgets: BudgetCategory[]) => void;
  onUpdateIncomeCategories: (newIncomeCats: IncomeCategory[]) => void;
  onUpdateExpenseCategory?: (updated: BudgetCategory, oldName?: string) => void;
  onDeleteExpenseCategory?: (id: string, reassignToName?: string) => void;
  onUpdateIncomeCategory?: (updated: IncomeCategory, oldName?: string) => void;
  onDeleteIncomeCategory?: (id: string, reassignToName?: string) => void;
  // Google Workspace
  user?: User | null;
  needsAuth?: boolean;
  isLoggingIn?: boolean;
  spreadsheets?: SpreadsheetFileInfo[];
  selectedSpreadsheetId?: string;
  spreadsheetMetadata?: SpreadsheetMetadataInfo | null;
  expensesTabName?: string;
  budgetsTabName?: string;
  workHoursTabName?: string;
  isSyncing?: boolean;
  syncStatusMessage?: string | null;
  syncError?: string | null;
  onLogin?: () => void;
  onLogout?: () => void;
  onRefreshSpreadsheets?: () => void;
  onSelectSpreadsheet?: (id: string) => void;
  onCreateNewSpreadsheet?: (title: string) => void;
  onChangeTabNames?: (tabs: {
    expensesTabName: string;
    budgetsTabName: string;
    workHoursTabName: string;
  }) => void;
  onRequestPushToSheets?: () => void;
  onRequestPullFromSheets?: () => void;
  onRestoreFullBackup?: (data: {
    transactions?: TransactionItem[];
    budgets?: BudgetCategory[];
    incomeCategories?: IncomeCategory[];
    wallets?: WalletItem[];
    workLogs?: WorkHourEntry[];
    settings?: AppSettings;
    monthlyBudgets?: Record<string, Record<string, number>>;
  }) => void;
  monthlyBudgets?: Record<string, Record<string, number>>;
  currencySymbol?: string;
  currencyCode?: string;
  selectedMonth?: string;
  onClearSyncAndIntegrations?: () => void;
  onClearFinancialData?: () => void;
}

const WIDGET_LABELS: { key: keyof DashboardWidgetsConfig; label: string; desc: string }[] = [
  {
    key: 'kpiStrip',
    label: 'Ключові фінансові показники (KPI)',
    desc: 'Витрати, залишок бюджету, відпрацьовані години та чистий баланс',
  },
  {
    key: 'charts',
    label: 'Графіки витрат у реальному часі',
    desc: 'Структура витрат за категоріями та крива динаміки за днями',
  },
  {
    key: 'walletsOverview',
    label: 'Картки гаманців та баланси',
    desc: 'Швидкий огляд рахунків з піктограмами, кольорами та валютами',
  },
  {
    key: 'pendingRecurring',
    label: 'Циклічні платежі та нагадування',
    desc: 'Блок регулярних платежів для швидкого підтвердження та синхронізації з Google Calendar',
  },
  {
    key: 'quickTransaction',
    label: 'Форма транзакцій та журнал операцій',
    desc: 'Додавання витрат, доходів і переказів між картками',
  },
  {
    key: 'budgetsPreview',
    label: 'Контроль бюджету за категоріями',
    desc: 'Таблиця лімітів, підкатегорій та прогрес-барів використання бюджету',
  },
  {
    key: 'workHoursPreview',
    label: 'Облік робочих годин та табель',
    desc: 'Підсумок за календарний місяць по гаманцях та журнал робочого часу',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  initialTab = 'general',
  onClose,
  settings,
  wallets,
  budgets,
  incomeCategories,
  transactions = [],
  workLogs = [],
  onImportTransactions,
  embedded = false,
  onUpdateSettings,
  onApplyHourlyRateToAllLogs,
  onAddWallet,
  onDeleteWallet,
  onUpdateBudgets,
  onUpdateIncomeCategories,
  onUpdateExpenseCategory,
  onDeleteExpenseCategory,
  onUpdateIncomeCategory,
  onDeleteIncomeCategory,
  user,
  needsAuth = false,
  isLoggingIn = false,
  spreadsheets = [],
  selectedSpreadsheetId = '',
  spreadsheetMetadata = null,
  isSyncing = false,
  syncStatusMessage = null,
  syncError = null,
  onLogin,
  onLogout,
  onRefreshSpreadsheets,
  onSelectSpreadsheet,
  onCreateNewSpreadsheet,
  onRequestPushToSheets,
  onRequestPullFromSheets,
  onRestoreFullBackup,
  monthlyBudgets = {},
  currencySymbol,
  currencyCode,
  selectedMonth = '2026-10',
  onClearSyncAndIntegrations,
  onClearFinancialData,
}) => {
  const [activeTab, setActiveTab] = useState<
    'general' | 'wallets' | 'categories' | 'google' | 'widgets' | 'currency'
  >(initialTab);

  const txCsvInputRef = useRef<HTMLInputElement | null>(null);
  const jsonInputRef = useRef<HTMLInputElement | null>(null);

  const [reportMonth, setReportMonth] = useState<string>(selectedMonth || '2026-10');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // PDF Export
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportFinancialReportToPdf({
        month: reportMonth,
        currencySymbol: currencySymbol || settings.currency.symbol,
        currencyCode: currencyCode || settings.currency.code,
        transactions,
        budgets,
        wallets,
        workLogs: workLogs || [],
        monthlyBudgets,
      });
      showSavedFeedback(`Фінансовий звіт за ${formatMonthName(reportMonth)} успішно завантажено (PDF)!`);
    } catch (err: any) {
      alert(err?.message || 'Помилка формування PDF-звіту');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Separate Clear Handlers
  const handleTriggerClearSync = () => {
    if (
      window.confirm(
        'Очистити синхронізацію та відключити підключення Google?\n\n' +
        '• Буде здійснено вихід з облікового запису Google.\n' +
        '• Буде видалено збережені токени для Календаря та Email.\n' +
        '• УСІ ВАШІ ЛОКАЛЬНІ ДАНІ (гаманці, транзакції, бюджети, робочі години) ЗАЛИШАЮТЬСЯ В ПОВНІЙ БЕЗПЕЦІ на цьому пристрої.\n\n' +
        'Продовжити очищення синхронізації?'
      )
    ) {
      if (onClearSyncAndIntegrations) {
        onClearSyncAndIntegrations();
      } else if (onLogout) {
        onLogout();
      }
      showSavedFeedback('Синхронізацію успішно очищено та відключено.');
    }
  };

  const handleTriggerClearData = () => {
    if (
      window.confirm(
        'УВАГА: Очищення всіх локальних даних!\n\n' +
        '• Буде безповоротно видалено історію всіх транзакцій та табель робочих годин.\n' +
        '• Поточні баланси гаманців скинуться.\n' +
        '• Категорії та налаштування повертаються до початкових.\n\n' +
        'Перед очищенням настійно рекомендуємо натиснути «Зберегти JSON».\n\n' +
        'Ви дійсно бажаєте повністю очистити локальні дані додатку?'
      )
    ) {
      if (onClearFinancialData) {
        onClearFinancialData();
      }
      showSavedFeedback('Усі локальні фінансові дані успішно очищено.');
    }
  };

  // JSON Full Backup Export
  const handleExportJsonBackup = () => {
    const backupData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      appName: 'FinPulse',
      settings,
      wallets,
      transactions,
      budgets,
      incomeCategories,
      workLogs: workLogs || [],
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `finpulse-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showSavedFeedback('Повну резервну копію (JSON) успішно завантажено!');
  };

  // JSON Backup Restore
  const handleRestoreJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result || '{}'));
        if (!parsed.wallets && !parsed.transactions && !parsed.budgets) {
          throw new Error('Файл не містить валідних даних FinPulse.');
        }
        if (
          window.confirm(
            'Відновити дані з цього резервного файлу? Поточні дані буде замінено даними з копії.'
          )
        ) {
          if (onRestoreFullBackup) {
            onRestoreFullBackup(parsed);
            showSavedFeedback('Дані успішно відновлено з резервної копії!');
          }
        }
      } catch (err: any) {
        showSavedFeedback(`Помилка читання файлу JSON: ${err?.message || 'Некоректний формат'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Currency
  const [customCode, setCustomCode] = useState(settings.currency.code);
  const [customSymbol, setCustomSymbol] = useState(settings.currency.symbol);
  const [customName, setCustomName] = useState(settings.currency.name);

  // Work defaults
  const [defaultRateInput, setDefaultRateInput] = useState(
    String(settings.defaultHourlyRate)
  );
  const [defaultBreakInput, setDefaultBreakInput] = useState(
    String(settings.defaultBreakMinutes)
  );
  const [defaultProjectInput, setDefaultProjectInput] = useState(
    settings.defaultProject
  );
  const [defaultWalletInput, setDefaultWalletInput] = useState(
    settings.defaultWorkWalletId || wallets[0]?.name || 'Картка PKO BP'
  );
  const [emailInput, setEmailInput] = useState(settings.notificationEmail);
  const [savedBanner, setSavedBanner] = useState<string | null>(null);

  // Wallets form state
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletBalance, setNewWalletBalance] = useState('1000');
  const [newWalletCurrency, setNewWalletCurrency] = useState(settings.currency.code);
  const [newWalletType, setNewWalletType] = useState<WalletItem['type']>('card');
  const [newWalletIcon, setNewWalletIcon] = useState(WALLET_ICONS[0]);
  const [newWalletColor, setNewWalletColor] = useState(WALLET_COLORS[0].value);

  // Categories Sub-Tab in Settings: 'expense' | 'income'
  const [categorySubTab, setCategorySubTab] = useState<'expense' | 'income'>('expense');

  // New Income Category form state
  const [newIncomeName, setNewIncomeName] = useState('');
  const [newIncomeSubcategories, setNewIncomeSubcategories] = useState('');
  const [newIncomeIsSalary, setNewIncomeIsSalary] = useState(false);

  // New Expense Category form state
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseLimit, setNewExpenseLimit] = useState('500');
  const [newExpenseSubcategories, setNewExpenseSubcategories] = useState('');
  const [newExpenseColor, setNewExpenseColor] = useState(CATEGORY_COLORS[0].value);

  // Google Sheets state
  const [newSheetTitle, setNewSheetTitle] = useState(
    'FinPulse — Особисті фінанси та Робочі години'
  );
  const [manualSheetId, setManualSheetId] = useState('');

  const handleImportTransactionsFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const defaultWallet = wallets[0]?.name || 'Основний рахунок';
      const parsed = parseImportedTransactionsCsv(text, defaultWallet);
      if (parsed.length > 0) {
        if (onImportTransactions) {
          onImportTransactions(parsed);
          showSavedFeedback(`Успішно імпортовано ${parsed.length} транзакцій!`);
        }
      } else {
        showSavedFeedback('Не вдалося розпізнати транзакції у вибраному CSV файлі.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  if (!isOpen && !embedded) return null;

  const showSavedFeedback = (msg: string) => {
    setSavedBanner(msg);
    setTimeout(() => setSavedBanner(null), 3000);
  };

  const handleToggleWidget = (key: keyof DashboardWidgetsConfig) => {
    onUpdateSettings({
      ...settings,
      dashboardWidgets: {
        ...settings.dashboardWidgets,
        [key]: !settings.dashboardWidgets[key],
      },
    });
  };

  const handleSelectPresetCurrency = (preset: CurrencyConfig) => {
    setCustomCode(preset.code);
    setCustomSymbol(preset.symbol);
    setCustomName(preset.name);
    onUpdateSettings({
      ...settings,
      currency: preset,
    });
    showSavedFeedback(
      `Основну валюту змінено на ${preset.name} (${preset.symbol})`
    );
  };

  const handleSaveCustomCurrency = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCode.trim() || !customSymbol.trim()) return;
    const updatedCurrency: CurrencyConfig = {
      code: customCode.trim().toUpperCase(),
      symbol: customSymbol.trim(),
      name: customName.trim() || customCode.trim().toUpperCase(),
    };
    onUpdateSettings({
      ...settings,
      currency: updatedCurrency,
    });
    showSavedFeedback(
      `Встановлено власну валюту: ${updatedCurrency.code} (${updatedCurrency.symbol})`
    );
  };

  const handleSaveWorkAndEmailDefaults = (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(defaultRateInput);
    const brk = parseInt(defaultBreakInput, 10);
    if (isNaN(rate) || rate < 0) return;

    onUpdateSettings({
      ...settings,
      defaultHourlyRate: rate,
      defaultBreakMinutes: isNaN(brk) || brk < 0 ? 0 : brk,
      defaultProject: defaultProjectInput.trim() || 'Основний проєкт',
      defaultWorkWalletId: defaultWalletInput,
      notificationEmail: emailInput.trim() || settings.notificationEmail,
    });
    showSavedFeedback('Базові налаштування збережено');
  };

  // Add Wallet
  const handleAddWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim() || !onAddWallet) return;

    const currPreset = PRESET_CURRENCIES.find((c) => c.code === newWalletCurrency);
    const symbol = currPreset?.symbol || settings.currency.symbol;

    onAddWallet({
      name: newWalletName.trim(),
      type: newWalletType,
      initialBalance: parseFloat(newWalletBalance) || 0,
      currencyCode: newWalletCurrency,
      currencySymbol: symbol,
      icon: newWalletIcon,
      color: newWalletColor,
    });

    setNewWalletName('');
    setNewWalletBalance('1000');
    showSavedFeedback(`Гаманець «${newWalletName.trim()}» успішно додано!`);
  };

  // Add Income Category
  const handleAddIncomeCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncomeName.trim()) return;

    const subs = newIncomeSubcategories
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const created: IncomeCategory = {
      id: `inc-${Date.now().toString().slice(-5)}`,
      name: newIncomeName.trim(),
      subcategories: subs.length > 0 ? subs : ['Основний дохід'],
      isSalary: newIncomeIsSalary,
    };

    onUpdateIncomeCategories([...incomeCategories, created]);
    setNewIncomeName('');
    setNewIncomeSubcategories('');
    setNewIncomeIsSalary(false);
    showSavedFeedback(`Додано категорію доходу «${created.name}»`);
  };

  const handleDeleteIncomeCategory = (id: string) => {
    if (incomeCategories.length <= 1) {
      showSavedFeedback('Необхідно залишити хоча б одну категорію доходу');
      return;
    }
    const cat = incomeCategories.find((c) => c.id === id);
    if (onDeleteIncomeCategory) {
      onDeleteIncomeCategory(id);
    } else {
      onUpdateIncomeCategories(incomeCategories.filter((c) => c.id !== id));
    }
    showSavedFeedback(`Категорію доходу «${cat?.name}» видалено`);
  };

  // Add Expense Category
  const handleAddExpenseCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExpenseName.trim()) return;

    const subs = newExpenseSubcategories
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const created: BudgetCategory = {
      id: `cat-${Date.now().toString().slice(-5)}`,
      name: newExpenseName.trim(),
      color: newExpenseColor,
      subcategories: subs.length > 0 ? subs : ['Загальні витрати'],
      monthlyLimit: parseFloat(newExpenseLimit) || 0,
      alertThresholdPercent: 80,
    };

    onUpdateBudgets([...budgets, created]);
    setNewExpenseName('');
    setNewExpenseLimit('500');
    setNewExpenseSubcategories('');
    setNewExpenseColor(CATEGORY_COLORS[0].value);
    showSavedFeedback(`Додано категорію витрат «${created.name}»`);
  };

  const handleDeleteExpenseCategory = (id: string) => {
    if (budgets.length <= 1) {
      showSavedFeedback('Необхідно залишити хоча б одну категорію витрат');
      return;
    }
    const cat = budgets.find((b) => b.id === id);
    if (onDeleteExpenseCategory) {
      onDeleteExpenseCategory(id);
    } else {
      onUpdateBudgets(budgets.filter((b) => b.id !== id));
    }
    showSavedFeedback(`Категорію витрат «${cat?.name}» видалено`);
  };

  const sym = settings.currency.symbol;

  const innerContent = (
    <>
      {/* Modal Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Налаштування параметрів
          </h2>
          <p className="text-xs text-slate-500">
            Google Sheets (імпорт/експорт), гаманці, категорії, валюта та робочі години
          </p>
        </div>
        {!embedded && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Закрити налаштування"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

        {/* Tab Navigation in Settings */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`border-b-2 py-3 px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'general'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Основне та години
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wallets')}
            className={`border-b-2 py-3 px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'wallets'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Гаманці ({wallets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`border-b-2 py-3 px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'categories'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Категорії та кольори
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('google')}
            className={`border-b-2 py-3 px-3 text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              activeTab === 'google'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Download className="h-3.5 w-3.5 text-blue-600" />
            <span>Імпорт, Експорт, Календар & Email</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('widgets')}
            className={`border-b-2 py-3 px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'widgets'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Головний екран
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('currency')}
            className={`border-b-2 py-3 px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'currency'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Валюта ({settings.currency.code})
          </button>
        </div>

        {/* Content */}
        <div className={`${embedded ? '' : 'flex-1 overflow-y-auto'} p-6 space-y-6`}>
          {savedBanner && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900 flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>{savedBanner}</span>
            </div>
          )}

          {/* TAB 1: GENERAL & WORK HOURS & MENU TOGGLES */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Appearance & Navigation toggles */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <PanelLeftClose className="h-4 w-4 text-slate-700" />
                    <h3 className="text-sm font-semibold text-slate-900">
                      Зовнішній вигляд та меню навігації
                    </h3>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start justify-between cursor-pointer gap-4">
                    <div>
                      <div className="text-xs font-semibold text-slate-900">
                        Автоматичне ховання лівого меню
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Коли курсор прибирається з лівого меню, воно згортається у вузьку панель з піктограмами та розгортається при наведенні.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoHideSidebar}
                      onChange={(e) => {
                        onUpdateSettings({
                          ...settings,
                          autoHideSidebar: e.target.checked,
                        });
                        showSavedFeedback(
                          e.target.checked
                            ? 'Увімкнено автозгортання лівого меню'
                            : 'Ліве меню закріплено розгорнутим'
                        );
                      }}
                      className="h-4 w-4 mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                  </label>

                  <div className="pt-3 border-t border-slate-100">
                    <label className="flex items-start justify-between cursor-pointer gap-4">
                      <div>
                        <div className="text-xs font-semibold text-slate-900">
                          Відображати таймер робочої зміни
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Показувати блок секундоміра на сторінці «Години роботи» для фіксації початку та завершення зміни в реальному часі.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings.showShiftTimer}
                        onChange={(e) => {
                          onUpdateSettings({
                            ...settings,
                            showShiftTimer: e.target.checked,
                          });
                          showSavedFeedback(
                            e.target.checked
                              ? 'Таймер зміни активовано'
                              : 'Таймер зміни приховано'
                          );
                        }}
                        className="h-4 w-4 mt-0.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Work Hours Rates & Defaults */}
              <form
                onSubmit={handleSaveWorkAndEmailDefaults}
                className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Базові параметри обліку годин та сповіщень
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Базова ставка ({sym}/год)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      value={defaultRateInput}
                      onChange={(e) => setDefaultRateInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Гаманець для зарплати за замовчуванням
                    </label>
                    <select
                      value={defaultWalletInput}
                      onChange={(e) => setDefaultWalletInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
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
                      Типова перерва (хв)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={defaultBreakInput}
                      onChange={(e) => setDefaultBreakInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Основний проєкт
                    </label>
                    <input
                      type="text"
                      value={defaultProjectInput}
                      onChange={(e) => setDefaultProjectInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-xs font-medium text-slate-700 mb-1 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-blue-600" />
                    <span>Email для автоматичних сповіщень ліміту бюджету</span>
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="krb.aurel.sl@gmail.com"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
                  >
                    Зберегти параметри
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const rate = parseFloat(defaultRateInput);
                      if (!isNaN(rate) && rate >= 0) {
                        onApplyHourlyRateToAllLogs(rate);
                        showSavedFeedback(
                          `Усі зміни в журналі перераховано за ставкою ${rate} ${sym}/год`
                        );
                      }
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Перерахувати всі зміни за ставкою {defaultRateInput} {sym}/год
                  </button>
                </div>
              </form>

              {/* Quick Data & Sync Management Card */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4 text-slate-700" />
                    <h3 className="text-sm font-semibold text-slate-900">
                      Швидке скидання та керування даними
                    </h3>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Окремі дії для скидання синхронізації або повного очищення локальних записів:
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleTriggerClearSync}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Unlink className="h-3.5 w-3.5 text-amber-600" />
                    <span>Очистити синхронізацію</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerClearData}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    <span>Очистити локальні дані</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('google')}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline sm:ml-auto cursor-pointer"
                  >
                    <span>Перейти до експорту PDF / CSV та резервних копій</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: WALLETS MANAGEMENT (Add & Edit Wallets) */}
          {activeTab === 'wallets' && (
            <div className="space-y-6">
              {/* Add New Wallet Form */}
              <form
                onSubmit={handleAddWallet}
                className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-slate-900" />
                    <h3 className="text-sm font-semibold text-slate-900">
                      Додати новий гаманець / рахунок
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Назва гаманця
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Напр., Картка Santander, Готівка USD"
                      value={newWalletName}
                      onChange={(e) => setNewWalletName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Початковий баланс
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={newWalletBalance}
                      onChange={(e) => setNewWalletBalance(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Валюта гаманця
                    </label>
                    <select
                      value={newWalletCurrency}
                      onChange={(e) => setNewWalletCurrency(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                    >
                      {PRESET_CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} ({c.symbol}) — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Тип рахунку
                    </label>
                    <select
                      value={newWalletType}
                      onChange={(e) => setNewWalletType(e.target.value as any)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900"
                    >
                      <option value="card">Банківська картка</option>
                      <option value="cash">Готівка</option>
                      <option value="bank">Рахунок IBAN / ФОП</option>
                      <option value="crypto">Цифровий / Мультивалютний</option>
                    </select>
                  </div>
                </div>

                {/* Icon & Color Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Піктограма гаманця
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {WALLET_ICONS.map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setNewWalletIcon(ic)}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg text-base border transition-transform ${
                            newWalletIcon === ic
                              ? 'border-slate-900 bg-slate-100 scale-110 shadow-xs'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Колір картки
                    </label>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {WALLET_COLORS.map((col) => (
                        <button
                          key={col.value}
                          type="button"
                          onClick={() => setNewWalletColor(col.value)}
                          className={`h-6 w-6 rounded-full border transition-transform ${
                            newWalletColor === col.value
                              ? 'border-slate-900 scale-125 ring-2 ring-slate-900/20'
                              : 'border-transparent hover:scale-110'
                          }`}
                          style={{ backgroundColor: col.value }}
                          title={col.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Створити гаманець</span>
                </button>
              </form>

              {/* Existing Wallets List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Наявні гаманці ({wallets.length})
                </h4>
                <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                  {wallets.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between p-3.5 hover:bg-slate-50/50"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-lg text-white shadow-2xs"
                          style={{ backgroundColor: w.color }}
                        >
                          {w.icon}
                        </span>
                        <div>
                          <div className="font-semibold text-xs text-slate-900">
                            {w.name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            Початковий: {w.initialBalance.toLocaleString('uk-UA')}{' '}
                            {w.currencySymbol} ({w.currencyCode})
                          </div>
                        </div>
                      </div>

                      {wallets.length > 1 && onDeleteWallet && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Видалити гаманець «${w.name}»?`)) {
                              onDeleteWallet(w.id);
                              showSavedFeedback(`Гаманець «${w.name}» видалено`);
                            }
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Видалити гаманець"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SEPARATE INCOME & EXPENSE CATEGORIES + COLORS */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              {/* Category sub-switcher */}
              <div className="flex rounded-lg bg-slate-100 p-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setCategorySubTab('expense')}
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                    categorySubTab === 'expense'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Категорії витрат та кольори ({budgets.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCategorySubTab('income')}
                  className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                    categorySubTab === 'income'
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Категорії доходу ({incomeCategories.length})
                </button>
              </div>

              {/* EXPENSE CATEGORIES MANAGER WITH COLOR PICKER */}
              {categorySubTab === 'expense' && (
                <div className="space-y-4">
                  {/* Add Expense Category Form */}
                  <form
                    onSubmit={handleAddExpenseCategory}
                    className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="text-xs font-semibold text-slate-900">
                        Додати категорію витрат з лімітом та кольором
                      </div>
                      <div className="flex items-center gap-1.5 text-xs">
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
                          <label className="relative flex items-center cursor-pointer ml-1" title="Власний колір">
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

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          Назва категорії
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Напр. Хобі, Подорожі"
                          value={newExpenseName}
                          onChange={(e) => setNewExpenseName(e.target.value)}
                          className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          Місячний ліміт ({sym})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={newExpenseLimit}
                          onChange={(e) => setNewExpenseLimit(e.target.value)}
                          className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          Підкатегорії (через кому)
                        </label>
                        <input
                          type="text"
                          placeholder="Книги, Квитки, Готелі"
                          value={newExpenseSubcategories}
                          onChange={(e) => setNewExpenseSubcategories(e.target.value)}
                          className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-slate-800 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Створити категорію витрат</span>
                    </button>
                  </form>

                  {/* Expense categories list with color swatches */}
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                    {budgets.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-3.5 hover:bg-slate-50/50"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full shrink-0 shadow-2xs"
                              style={{ backgroundColor: b.color || '#2563eb' }}
                              title="Колір категорії"
                            />
                            <span className="font-semibold text-xs text-slate-900">
                              {b.name}
                            </span>
                            <span className="font-mono text-[11px] text-slate-600">
                              (ліміт: {b.monthlyLimit} {sym}/міс)
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {b.subcategories.map((sub) => (
                              <span
                                key={sub}
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 font-mono"
                              >
                                {sub}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Color Selector for each existing category */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {CATEGORY_COLORS.map((col) => (
                              <button
                                key={col.value}
                                type="button"
                                onClick={() => {
                                  onUpdateBudgets(
                                    budgets.map((item) =>
                                      item.id === b.id
                                        ? { ...item, color: col.value }
                                        : item
                                    )
                                  );
                                  showSavedFeedback(`Змінено колір для «${b.name}»`);
                                }}
                                className={`h-3.5 w-3.5 rounded-full border ${
                                  (b.color || '#2563eb') === col.value
                                    ? 'border-slate-900 scale-125'
                                    : 'border-transparent hover:scale-110'
                                }`}
                                style={{ backgroundColor: col.value }}
                                title={col.label}
                              />
                            ))}
                            <label className="relative flex items-center cursor-pointer ml-1" title="Обрати довільний колір">
                              <input
                                type="color"
                                value={b.color || '#2563eb'}
                                onChange={(e) => {
                                  onUpdateBudgets(
                                    budgets.map((item) =>
                                      item.id === b.id
                                        ? { ...item, color: e.target.value }
                                        : item
                                    )
                                  );
                                  showSavedFeedback(`Змінено колір для «${b.name}»`);
                                }}
                                className="sr-only"
                              />
                              <span
                                className="h-3.5 w-3.5 rounded-full border border-slate-300 ring-1 ring-slate-200 shadow-2xs cursor-pointer"
                                style={{ backgroundColor: b.color || '#2563eb' }}
                              />
                            </label>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteExpenseCategory(b.id)}
                            className="text-slate-400 hover:text-red-600 p-1"
                            title="Видалити категорію витрат"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* INCOME CATEGORIES MANAGER */}
              {categorySubTab === 'income' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                      Категорії для надходжень та доходів
                    </h3>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      Категорії доходу додаються окремо від витрат і відображаються у формі надходжень.
                    </p>
                  </div>

                  {/* Add Income Category Form */}
                  <form
                    onSubmit={handleAddIncomeCategory}
                    className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
                  >
                    <div className="text-xs font-semibold text-slate-900">
                      Додати нову категорію доходу
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          Назва категорії доходу
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Напр. Фріланс, Інвестиції"
                          value={newIncomeName}
                          onChange={(e) => setNewIncomeName(e.target.value)}
                          className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-700 mb-1">
                          Підкатегорії (через кому)
                        </label>
                        <input
                          type="text"
                          placeholder="Проєкти, Консультації, Бонуси"
                          value={newIncomeSubcategories}
                          onChange={(e) => setNewIncomeSubcategories(e.target.value)}
                          className="w-full rounded border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={newIncomeIsSalary}
                        onChange={(e) => setNewIncomeIsSalary(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900"
                      />
                      <span>
                        Є категорією заробітної плати (дозволяє обирати дохід за календарний місяць відпрацьованих годин)
                      </span>
                    </label>

                    <button
                      type="submit"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Створити категорію доходу</span>
                    </button>
                  </form>

                  {/* Income categories list */}
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                    {incomeCategories.map((inc) => (
                      <div
                        key={inc.id}
                        className="flex items-start justify-between p-3.5 hover:bg-slate-50/50"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-900">
                              {inc.name}
                            </span>
                            {inc.isSalary && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-2 py-0.2 text-[10px] font-semibold text-blue-800">
                                <Sparkles className="h-2.5 w-2.5" />
                                Заробітна плата
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {inc.subcategories.map((sub) => (
                              <span
                                key={sub}
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 font-mono"
                              >
                                {sub}
                              </span>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteIncomeCategory(inc.id)}
                          className="text-slate-400 hover:text-red-600 p-1"
                          title="Видалити категорію доходу"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: LOCAL STORAGE, BACKUP & INTEGRATIONS (CALENDAR / GMAIL) */}
          {activeTab === 'google' && (
            <div className="space-y-6">
              {/* Local Storage & Privacy Banner */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/50">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <span>Локальне збереження та безпека даних</span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60">
                        Автономно
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Вся інформація зберігається виключно локально на вашому пристрої у сховищі браузера. Синхронізацію з Google Таблицями вимкнено для забезпечення приватності, швидкості та надійності без затримок мережі.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="rounded-lg bg-slate-50/70 p-2.5 border border-slate-100">
                    <div className="text-[11px] text-slate-500">Транзакції:</div>
                    <div className="font-mono font-bold text-slate-800">{transactions.length}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50/70 p-2.5 border border-slate-100">
                    <div className="text-[11px] text-slate-500">Гаманці:</div>
                    <div className="font-mono font-bold text-slate-800">{wallets.length}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50/70 p-2.5 border border-slate-100">
                    <div className="text-[11px] text-slate-500">Бюджети:</div>
                    <div className="font-mono font-bold text-slate-800">{budgets.length}</div>
                  </div>
                  <div className="rounded-lg bg-slate-50/70 p-2.5 border border-slate-100">
                    <div className="text-[11px] text-slate-500">Робочі години:</div>
                    <div className="font-mono font-bold text-slate-800">{workLogs?.length || 0}</div>
                  </div>
                </div>
              </div>

              {/* Full JSON Backup & Restore */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                    <FileJson className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      Повна резервна копія (JSON)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Створіть файл резервної копії або відновіть стан фінансів на новому комп'ютері чи телефоні
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3.5 flex flex-col justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                        <Download className="h-4 w-4 text-blue-600" />
                        <span>Експорт у JSON файл</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Зберегти всі рахунки, витрати, бюджети та налаштування на диск
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportJsonBackup}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Завантажити копію (.json)</span>
                    </button>
                  </div>

                  <div className="rounded-lg border border-slate-200 p-3.5 flex flex-col justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                        <Upload className="h-4 w-4 text-emerald-600" />
                        <span>Відновлення з JSON файлу</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Завантажити раніше збережений файл резервної копії
                      </div>
                    </div>
                    <div>
                      <input
                        ref={jsonInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleRestoreJsonBackup}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => jsonInputRef.current?.click()}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>Обрати файл (.json)</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Google Workspace Connection Card (For Google Calendar & Gmail) */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <Calendar className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">
                        Інтеграція Google (Календар та Email)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Підключіть Google для додавання нагадувань у Calendar та відправки звітів на Gmail
                      </p>
                    </div>
                  </div>

                  {user ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {user.photoURL && (
                          <img
                            src={user.photoURL}
                            alt=""
                            className="h-7 w-7 rounded-full border border-slate-200"
                          />
                        )}
                        <span className="text-xs font-semibold text-slate-800">
                          {user.email}
                        </span>
                      </div>
                      {onLogout && (
                        <button
                          type="button"
                          onClick={onLogout}
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                          title="Вийти з акаунта Google"
                        >
                          <LogOut className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    onLogin && <GoogleSignInButton onClick={onLogin} disabled={isLoggingIn} />
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-slate-50/70 p-3 border border-slate-100">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-blue-600" />
                      <span>Google Calendar</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Синхронізація регулярних платежів з нагадуванням за 24 години у вашому календарі.
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50/70 p-3 border border-slate-100">
                    <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-red-600" />
                      <span>Gmail Сповіщення & Звіти</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Отримання підсумкових рапортів за місяць та попереджень при перевищенні лімітів.
                    </div>
                  </div>
                </div>

                {syncStatusMessage && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-900 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{syncStatusMessage}</span>
                  </div>
                )}

                {syncError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-900 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                    <span>{syncError}</span>
                  </div>
                )}
              </div>

              {/* SECTION: ALL IMPORT AND EXPORT EXCLUSIVELY HERE */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                    <Download className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">
                      Імпорт та Експорт даних (CSV)
                    </h4>
                    <p className="text-xs text-slate-500">
                      Централізований експорт звітів та імпорт операцій у форматі CSV для автономного використання чи перенесення даних
                    </p>
                  </div>
                </div>

                {/* Full Combined Report Card: PDF & CSV */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200/60">
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-red-600" />
                        <span>Зведений фінансовий звіт (PDF та CSV)</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Офіційний графічний звіт з картками KPI, аналітикою пріоритетів, таблицею лімітів категорій та залишками.
                      </div>
                    </div>

                    {/* Month Picker for Report */}
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <span className="text-[11px] font-medium text-slate-600 whitespace-nowrap">Період:</span>
                      <select
                        value={reportMonth}
                        onChange={(e) => setReportMonth(e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                      >
                        {AVAILABLE_MONTHS.map((m) => (
                          <option key={m.key} value={m.key}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {/* PDF Download Button */}
                    <button
                      type="button"
                      onClick={handleExportPdf}
                      disabled={isExportingPdf}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors whitespace-nowrap shadow-xs cursor-pointer"
                    >
                      <FileText className={`h-3.5 w-3.5 ${isExportingPdf ? 'animate-bounce' : ''}`} />
                      <span>
                        {isExportingPdf
                          ? 'Створення PDF...'
                          : `Завантажити звіт у PDF (${formatMonthName(reportMonth)})`}
                      </span>
                    </button>

                    {/* CSV Download Button */}
                    <button
                      type="button"
                      onClick={() =>
                        exportFullCombinedCsvReport(
                          transactions,
                          budgets,
                          workLogs || [],
                          settings.currency.code
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shadow-2xs cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5 text-slate-700" />
                      <span>Завантажити повний звіт (CSV)</span>
                    </button>
                  </div>
                </div>

                {/* Individual Export & Import Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {/* Export Transactions */}
                  <div className="rounded-lg border border-slate-200 bg-white p-3.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-800">
                        Транзакції ({transactions.length})
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Журнал витрат, доходів та переказів
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => exportTransactionsToCsv(transactions, settings.currency.code)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shadow-2xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Експорт CSV</span>
                    </button>
                  </div>

                  {/* Import Transactions from CSV */}
                  <div className="rounded-lg border border-slate-200 bg-white p-3.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-800">
                        Імпорт транзакцій
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Завантажити з CSV файлу
                      </div>
                    </div>
                    <div>
                      <input
                        ref={txCsvInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleImportTransactionsFile}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => txCsvInputRef.current?.click()}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors whitespace-nowrap shadow-2xs"
                      >
                        <UploadCloud className="h-3.5 w-3.5 text-blue-700" />
                        <span>Імпортувати CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Export Budgets */}
                  <div className="rounded-lg border border-slate-200 bg-white p-3.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-800">
                        Категорії та Бюджети ({budgets.length})
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Ліміти, витрати та відсотки використання
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => exportBudgetsReportToCsv(budgets, transactions, settings.currency.code)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shadow-2xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Експорт CSV</span>
                    </button>
                  </div>

                  {/* Export Work Hours */}
                  <div className="rounded-lg border border-slate-200 bg-white p-3.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-800">
                        Робочі години ({workLogs.length})
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Табель змін, години та дохід
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => exportWorkHoursToCsv(workLogs, settings.currency.symbol)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shadow-2xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Експорт CSV</span>
                    </button>
                  </div>

                  {/* Export Wallets */}
                  <div className="rounded-lg border border-slate-200 bg-white p-3.5 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-800">
                        Гаманці ({wallets.length})
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Рахунки, типи та поточні баланси
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => exportWalletsToCsv(wallets)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shadow-2xs"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Експорт CSV</span>
                    </button>
                  </div>
                </div>

                {/* SECTION: SEPARATE CLEAR BUTTONS (SYNC vs DATA) */}
                <div className="rounded-xl border border-red-200/80 bg-red-50/20 p-5 space-y-4">
                  <div className="flex items-start gap-3 pb-3 border-b border-red-100">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 border border-red-200">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Керування очищенням та видаленням (Окремі кнопки)
                      </h4>
                      <p className="text-xs text-slate-500">
                        Окремі незалежні дії: скидання підключення синхронізації БЕЗ видалення фінансових записів, або повне очищення локальної бази даних.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Button 1: Clear Sync Only */}
                    <div className="rounded-xl border border-amber-200 bg-white p-4 flex flex-col justify-between gap-3 shadow-2xs">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                          <Unlink className="h-4 w-4 text-amber-600" />
                          <span>1. Очистити синхронізацію</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
                          Відключає обліковий запис Google, видаляє збережені токени синхронізації для Google Calendar та сповіщень на пошту.
                        </p>
                        <div className="mt-2 text-[11px] font-semibold text-emerald-700 bg-emerald-50/80 rounded px-2 py-1 border border-emerald-100 inline-block">
                          ✓ Локальні дані (гаманці, транзакції, бюджети) залишаються недоторканими
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleTriggerClearSync}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors shadow-2xs cursor-pointer"
                      >
                        <Unlink className="h-3.5 w-3.5 text-amber-600" />
                        <span>Очистити синхронізацію</span>
                      </button>
                    </div>

                    {/* Button 2: Clear Local Financial Data */}
                    <div className="rounded-xl border border-red-200 bg-white p-4 flex flex-col justify-between gap-3 shadow-2xs">
                      <div>
                        <div className="flex items-center gap-2 text-xs font-bold text-red-900">
                          <Trash2 className="h-4 w-4 text-red-600" />
                          <span>2. Очистити локальні дані</span>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
                          Видаляє всі локальні транзакції та табель робочих годин, скидаючи поточні баланси. Рекомендуємо попередньо завантажити файл резервної копії JSON.
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <button
                          type="button"
                          onClick={handleExportJsonBackup}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shadow-2xs cursor-pointer"
                          title="Зберегти файл резервної копії перед очищенням"
                        >
                          <FileJson className="h-3.5 w-3.5 text-blue-600" />
                          <span>Зберегти JSON</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleTriggerClearData}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          <span>Очистити всі дані</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: CUSTOMIZE HOME SCREEN WIDGETS */}
          {activeTab === 'widgets' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <LayoutDashboard className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Редагування головного екрана
                  </h3>
                  <p className="text-xs text-slate-500">
                    Увімкніть або вимкніть блоки, які відображаються на вкладці «Головний екран»
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {WIDGET_LABELS.map((item) => {
                  const isChecked = settings.dashboardWidgets[item.key];
                  return (
                    <label
                      key={item.key}
                      className="flex items-center justify-between py-3 cursor-pointer"
                    >
                      <div className="pr-4">
                        <div className="text-xs font-semibold text-slate-900">
                          {item.label}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {item.desc}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleWidget(item.key)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 6: CURRENCY CONFIGURATION */}
          {activeTab === 'currency' && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-800">
                  <Coins className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Основна валюта дашборду
                  </h3>
                  <p className="text-xs text-slate-500">
                    Оберіть основну валюту (кожен гаманець також має власну індивідуальну валюту)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {PRESET_CURRENCIES.map((preset) => {
                  const isActive = settings.currency.code === preset.code;
                  return (
                    <button
                      key={preset.code}
                      type="button"
                      onClick={() => handleSelectPresetCurrency(preset)}
                      className={`flex flex-col items-start rounded-lg border p-2.5 text-left transition-colors ${
                        isActive
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between font-mono text-xs font-semibold tabular-nums">
                        <span>{preset.code}</span>
                        <span>{preset.symbol}</span>
                      </div>
                      <div
                        className={`mt-0.5 text-[11px] truncate w-full ${
                          isActive ? 'text-slate-300' : 'text-slate-500'
                        }`}
                      >
                        {preset.name}
                      </div>
                    </button>
                  );
                })}
              </div>

              <form
                onSubmit={handleSaveCustomCurrency}
                className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-12 gap-2 items-end"
              >
                <div className="col-span-3">
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Код (ISO)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    className="w-full rounded border border-slate-200 px-2.5 py-1.5 font-mono text-xs uppercase"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Символ
                  </label>
                  <input
                    type="text"
                    maxLength={5}
                    value={customSymbol}
                    onChange={(e) => setCustomSymbol(e.target.value)}
                    className="w-full rounded border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
                  />
                </div>
                <div className="col-span-6">
                  <button
                    type="submit"
                    className="w-full rounded border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-slate-100"
                  >
                    Застосувати власну валюту
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </>
  );

  if (embedded) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {innerContent}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl overflow-hidden">
        {innerContent}
        {/* Modal Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
};

export const SettingsSection = SettingsModal;
