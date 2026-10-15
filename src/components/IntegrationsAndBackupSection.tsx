import React, { useState, useRef } from 'react';
import {
  BudgetCategory,
  IncomeCategory,
  RecurringPayment,
  TransactionItem,
  WalletItem,
  WorkHourEntry,
  WorkShiftTemplate,
  AppSettings,
} from '../types/finance';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  Download,
  Upload,
  Calendar,
  Mail,
  ShieldCheck,
  HardDrive,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  FileJson,
  FileText,
  Send,
  CalendarCheck,
  Check,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Unlink,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  exportTransactionsToCsv,
  exportBudgetsReportToCsv,
  exportWorkHoursToCsv,
  exportWalletsToCsv,
  exportFullCombinedCsvReport,
  parseImportedTransactionsCsv,
} from '../utils/csvExport';
import { exportFinancialReportToPdf } from '../utils/pdfExport';
import {
  sendMonthlySummaryReportEmail,
  syncRecurringPaymentToCalendar,
} from '../services/googleSheetsService';
import { getCategoryLimitForMonth, formatMonthName } from './BudgetControlSection';

interface IntegrationsAndBackupSectionProps {
  user: User | null;
  needsAuth: boolean;
  isLoggingIn: boolean;
  transactions: TransactionItem[];
  budgets: BudgetCategory[];
  incomeCategories: IncomeCategory[];
  wallets: WalletItem[];
  workLogs: WorkHourEntry[];
  recurringPayments: RecurringPayment[];
  shiftTemplates: WorkShiftTemplate[];
  settings: AppSettings;
  monthlyBudgets: Record<string, Record<string, number>>;
  currencySymbol: string;
  currencyCode: string;
  selectedMonth: string;
  onLogin: () => void;
  onLogout: () => void;
  onImportTransactions: (txs: TransactionItem[]) => void;
  onRestoreFullBackup: (data: {
    transactions?: TransactionItem[];
    budgets?: BudgetCategory[];
    incomeCategories?: IncomeCategory[];
    wallets?: WalletItem[];
    workLogs?: WorkHourEntry[];
    recurringPayments?: RecurringPayment[];
    shiftTemplates?: WorkShiftTemplate[];
    settings?: AppSettings;
    monthlyBudgets?: Record<string, Record<string, number>>;
  }) => void;
  onClearSyncAndIntegrations?: () => void;
  onClearFinancialData?: () => void;
  onFactoryReset?: () => void;
}

export const IntegrationsAndBackupSection: React.FC<
  IntegrationsAndBackupSectionProps
> = ({
  user,
  needsAuth,
  isLoggingIn,
  transactions,
  budgets,
  incomeCategories,
  wallets,
  workLogs,
  recurringPayments,
  shiftTemplates,
  settings,
  monthlyBudgets,
  currencySymbol,
  currencyCode,
  selectedMonth,
  onLogin,
  onLogout,
  onImportTransactions,
  onRestoreFullBackup,
  onClearSyncAndIntegrations,
  onClearFinancialData,
  onFactoryReset,
}) => {
  const [reportMonth, setReportMonth] = useState<string>(selectedMonth || '2026-10');
  const [recipientEmail, setRecipientEmail] = useState<string>(
    settings.notificationEmail || user?.email || ''
  );
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [isSyncingCalendar, setIsSyncingCalendar] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const jsonInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  const showTempSuccess = (msg: string) => {
    setStatusMessage(msg);
    setErrorMessage(null);
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const showTempError = (msg: string) => {
    setErrorMessage(msg);
    setStatusMessage(null);
    setTimeout(() => setErrorMessage(null), 6000);
  };

  // PDF Export
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportFinancialReportToPdf({
        month: reportMonth,
        currencySymbol,
        currencyCode,
        transactions,
        budgets,
        wallets,
        workLogs,
        monthlyBudgets,
      });
      showTempSuccess(`Фінансовий звіт за ${formatMonthName(reportMonth)} успішно завантажено у форматі PDF!`);
    } catch (err: any) {
      showTempError(err?.message || 'Помилка створення PDF-звіту.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Separate Clear Handlers
  const handleConfirmClearSync = () => {
    if (
      window.confirm(
        "Очистити синхронізацію та інтеграції? Буде відключено Google-акаунт, прибрано нагадування з Календаря та видалено email для сповіщень. Ваші фінансові дані (транзакції, гаманці, бюджети) залишаться недоторканими."
      )
    ) {
      onClearSyncAndIntegrations?.();
      showTempSuccess('Синхронізацію та підключення Google успішно очищено!');
    }
  };

  const handleConfirmClearData = () => {
    if (
      window.confirm(
        "УВАГА! Ви дійсно хочете видалити ВСІ транзакції та табель робочих годин? Рахунки гаманців та категорії залишаться. Перед цим настійно радимо завантажити резервну копію (JSON) вище."
      )
    ) {
      onClearFinancialData?.();
      showTempSuccess('Усі транзакції та табель годин успішно видалено.');
    }
  };

  const handleConfirmFactoryReset = () => {
    if (
      window.confirm(
        "КРИТИЧНА ДІЯ: Ви дійсно хочете виконати ПОВНЕ скидання додатку до початкового стану? Це видалить абсолютно всі дані з локального сховища вашого пристрою."
      )
    ) {
      onFactoryReset?.();
    }
  };

  // 1. JSON Full Backup Export
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
      monthlyBudgets,
      recurringPayments,
      shiftTemplates,
      workLogs,
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

    showTempSuccess('Повну резервну копію (JSON) успішно завантажено!');
  };

  // 2. JSON Backup Restore
  const handleRestoreJsonBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result || '{}'));
        if (
          !parsed.wallets &&
          !parsed.transactions &&
          !parsed.budgets &&
          !parsed.workLogs
        ) {
          throw new Error('Файл не містить валідних даних FinPulse.');
        }

        if (
          window.confirm(
            'Відновити дані з цього резервного файлу? Поточні дані буде замінено даними з бекапу.'
          )
        ) {
          onRestoreFullBackup(parsed);
          showTempSuccess('Дані успішно відновлено з резервної копії!');
        }
      } catch (err: any) {
        showTempError(
          `Помилка читання резервного файлу JSON: ${err?.message || 'Некоректний формат'}`
        );
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 3. CSV Import
  const handleImportCsvFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const defaultWallet = wallets[0]?.name || 'Основний гаманець';
      const parsed = parseImportedTransactionsCsv(
        String(reader.result || ''),
        defaultWallet
      );
      if (parsed.length > 0) {
        onImportTransactions(parsed);
        showTempSuccess(`Успішно імпортовано ${parsed.length} транзакцій з CSV!`);
      } else {
        showTempError('Не вдалося розпізнати транзакції у наданому CSV файлі.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 4. Send Monthly Report via Gmail API
  const handleSendEmailReport = async () => {
    if (needsAuth || !user) {
      showTempError('Для надсилання на пошту увійдіть через Google.');
      return;
    }
    const targetEmail = recipientEmail.trim() || user.email;
    if (!targetEmail) {
      showTempError('Вкажіть адресу електронної пошти.');
      return;
    }

    try {
      setIsSendingEmail(true);

      // Compute statistics for reportMonth
      const monthTx = transactions.filter((t) => t.date.startsWith(reportMonth));
      const totalExpenses = monthTx
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      const totalIncome = monthTx
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0);

      // Work hours by wallet
      const monthLogs = workLogs.filter((w) => w.date.startsWith(reportMonth));
      const walletMap: Record<string, { hours: number; earned: number }> = {};
      monthLogs.forEach((log) => {
        const wName = log.walletName || 'Основний';
        if (!walletMap[wName]) walletMap[wName] = { hours: 0, earned: 0 };
        walletMap[wName].hours += log.hoursWorked;
        walletMap[wName].earned += log.totalEarned;
      });
      const walletWorkHours = Object.entries(walletMap).map(([name, data]) => ({
        walletName: name,
        hours: data.hours,
        earned: data.earned,
      }));

      // Categories planned vs spent
      const categoriesSummary = budgets.map((b) => {
        const planned = getCategoryLimitForMonth(b, reportMonth, monthlyBudgets);
        const spent = monthTx
          .filter((t) => t.type === 'expense' && t.category === b.name)
          .reduce((sum, t) => sum + t.amount, 0);
        return {
          name: b.name,
          planned,
          spent,
          diff: planned - spent,
        };
      });

      // Priorities
      let needTotal = 0;
      let couldTotal = 0;
      let wantTotal = 0;
      monthTx
        .filter((t) => t.type === 'expense')
        .forEach((t) => {
          if (t.splits && t.splits.length > 0) {
            t.splits.forEach((s) => {
              const p = s.expensePriority || t.expensePriority || 'need';
              if (p === 'want') wantTotal += s.amount;
              else if (p === 'could') couldTotal += s.amount;
              else needTotal += s.amount;
            });
          } else {
            const p = t.expensePriority || 'need';
            if (p === 'want') wantTotal += t.amount;
            else if (p === 'could') couldTotal += t.amount;
            else needTotal += t.amount;
          }
        });

      await sendMonthlySummaryReportEmail({
        recipientEmail: targetEmail,
        monthLabel: reportMonth,
        periodDates: `${reportMonth}-01 – ${reportMonth}-31`,
        totalIncome,
        totalExpenses,
        cashFlow: totalIncome - totalExpenses,
        walletWorkHours,
        categories: categoriesSummary,
        currencySymbol,
        priorities: {
          needTotal,
          couldTotal,
          wantTotal,
        },
      });

      showTempSuccess(`Фінансовий звіт за ${reportMonth} успішно надіслано на ${targetEmail}!`);
    } catch (err: any) {
      showTempError(err?.message || 'Помилка надсилання звіту на email через Gmail API.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // 5. Sync Recurring Payments to Google Calendar
  const handleSyncAllToCalendar = async () => {
    if (needsAuth || !user) {
      showTempError('Для синхронізації з Календарем увійдіть через Google.');
      return;
    }

    if (recurringPayments.length === 0) {
      showTempError('Немає запланованих циклічних платежів для синхронізації.');
      return;
    }

    try {
      setIsSyncingCalendar(true);
      let successCount = 0;

      for (const rec of recurringPayments) {
        try {
          await syncRecurringPaymentToCalendar(rec, currencySymbol);
          successCount++;
        } catch (e) {
          console.warn('Calendar sync error for item', rec.title, e);
        }
      }

      showTempSuccess(
        `Синхронізовано ${successCount} з ${recurringPayments.length} циклічних платежів з вашим Google Календарем!`
      );
    } catch (err: any) {
      showTempError(err?.message || 'Помилка синхронізації з Google Календарем.');
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Local Storage Status */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/50">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  Локальне сховище, Експорт, Імпорт та Інтеграції
                </h2>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200/60">
                  Автономно
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Всі ваші дані зберігаються виключно локально на цьому пристрої. Синхронізацію із Google Таблицями вимкнено — ваші фінанси залишаються приватними, надійними та швидкими.
              </p>
            </div>
          </div>

          {/* Google Auth Status for Calendar & Email */}
          <div className="shrink-0">
            {needsAuth || !user ? (
              <div className="flex flex-col items-end gap-1">
                <GoogleSignInButton
                  onClick={onLogin}
                  disabled={isLoggingIn}
                  label={isLoggingIn ? 'Підключення...' : 'Google для Календаря & Пошти'}
                />
                <span className="text-[10px] text-slate-400">
                  Потрібно лише для Google Calendar & Gmail
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-800">
                    {user.displayName || user.email}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-medium">
                    Google підключено (Календар & Пошта)
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                  title="Вийти з акаунта Google"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Local Storage Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <div className="text-[11px] text-slate-500">Гаманці</div>
            <div className="font-mono text-base font-bold text-slate-900 mt-0.5">
              {wallets.length}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <div className="text-[11px] text-slate-500">Транзакції</div>
            <div className="font-mono text-base font-bold text-slate-900 mt-0.5">
              {transactions.length}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <div className="text-[11px] text-slate-500">Категорії витрат</div>
            <div className="font-mono text-base font-bold text-slate-900 mt-0.5">
              {budgets.length}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <div className="text-[11px] text-slate-500">Зміни годин</div>
            <div className="font-mono text-base font-bold text-slate-900 mt-0.5">
              {workLogs.length}
            </div>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 col-span-2 sm:col-span-1">
            <div className="text-[11px] text-slate-500">Циклічні платежі</div>
            <div className="font-mono text-base font-bold text-slate-900 mt-0.5">
              {recurringPayments.length}
            </div>
          </div>
        </div>

        {/* Status messages */}
        {statusMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="rounded-lg border border-red-200 bg-red-50/80 p-3 text-xs text-red-900 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* 2. Full JSON Backup & Restore Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
            <FileJson className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Повна резервна копія додатку (JSON)
            </h3>
            <p className="text-xs text-slate-500">
              Збережіть усі ваші транзакції, гаманці, історію годин, місячні бюджети та персональні налаштування в єдиному файлі.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Download JSON Backup */}
          <div className="rounded-lg border border-slate-200 p-4 flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                <Download className="h-4 w-4 text-blue-600" />
                <span>Створити резервну копію (JSON)</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Завантажує повний знімок системи на ваш комп'ютер для збереження чи перенесення на інший пристрій.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportJsonBackup}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Завантажити повну резервну копію (.json)</span>
            </button>
          </div>

          {/* Restore JSON Backup */}
          <div className="rounded-lg border border-slate-200 p-4 flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                <Upload className="h-4 w-4 text-emerald-600" />
                <span>Відновити дані з копії (JSON)</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Оберіть раніше збережений `.json` файл для миттєвого відновлення усіх записів та балансів.
              </p>
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
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Обрати файл резервної копії (.json)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. CSV Export and Import Center */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200/50">
            <FileSpreadsheet className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Експорт та Імпорт даних (CSV)
            </h3>
            <p className="text-xs text-slate-500">
              Вивантаження та завантаження таблиць для аналізу в Excel, Numbers чи інших додатках.
            </p>
          </div>
        </div>

        {/* Combined Reports: PDF & CSV */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* PDF Report Card */}
          <div className="rounded-lg border border-red-200/70 bg-red-50/40 p-4 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-red-600" />
                  <span>Фінансовий звіт (PDF)</span>
                </span>
                <span className="rounded bg-red-100 text-red-700 font-mono text-[10px] font-bold px-1.5 py-0.5">
                  A4 Документ
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Офіційний PDF-звіт за {formatMonthName(reportMonth)}: графічні картки KPI, розбивка за пріоритетами, таблиця лімітів категорій та залишки на гаманцях.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors shadow-xs"
            >
              <Download className={`h-3.5 w-3.5 ${isExportingPdf ? 'animate-bounce' : ''}`} />
              <span>{isExportingPdf ? 'Створення PDF-файлу...' : 'Завантажити звіт (PDF)'}</span>
            </button>
          </div>

          {/* Full Combined CSV Report */}
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                  <span>Повний зведений звіт (CSV)</span>
                </span>
                <span className="rounded bg-slate-200 text-slate-700 font-mono text-[10px] font-bold px-1.5 py-0.5">
                  Таблиці
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Об'єднує транзакції, бюджети та робочі години в один файл для детальної обробки в Excel, Numbers чи Google Таблицях.
              </p>
            </div>
            <button
              type="button"
              onClick={() => exportFullCombinedCsvReport(transactions, budgets, workLogs, currencyCode)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Завантажити повний звіт (CSV)</span>
            </button>
          </div>
        </div>

        {/* Individual CSV modules */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          {/* Export Transactions */}
          <div className="rounded-lg border border-slate-200 p-3.5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-800">
                Транзакції ({transactions.length})
              </div>
              <div className="text-[11px] text-slate-500">Журнал витрат та доходів</div>
            </div>
            <button
              type="button"
              onClick={() => exportTransactionsToCsv(transactions, currencyCode)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Експорт</span>
            </button>
          </div>

          {/* Import Transactions */}
          <div className="rounded-lg border border-slate-200 p-3.5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-800">
                Імпорт транзакцій
              </div>
              <div className="text-[11px] text-slate-500">Завантажити з CSV</div>
            </div>
            <div>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                onChange={handleImportCsvFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors"
              >
                <Upload className="h-3.5 w-3.5 text-blue-700" />
                <span>Імпортувати</span>
              </button>
            </div>
          </div>

          {/* Export Budgets */}
          <div className="rounded-lg border border-slate-200 p-3.5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-800">
                Бюджети та категорії ({budgets.length})
              </div>
              <div className="text-[11px] text-slate-500">Ліміти та відсотки використання</div>
            </div>
            <button
              type="button"
              onClick={() => exportBudgetsReportToCsv(budgets, transactions, currencyCode)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Експорт</span>
            </button>
          </div>

          {/* Export Work Hours */}
          <div className="rounded-lg border border-slate-200 p-3.5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-800">
                Робочі години ({workLogs.length})
              </div>
              <div className="text-[11px] text-slate-500">Табель змін та заробіток</div>
            </div>
            <button
              type="button"
              onClick={() => exportWorkHoursToCsv(workLogs, currencySymbol)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Експорт</span>
            </button>
          </div>

          {/* Export Wallets */}
          <div className="rounded-lg border border-slate-200 p-3.5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-800">
                Гаманці ({wallets.length})
              </div>
              <div className="text-[11px] text-slate-500">Рахунки та початкові баланси</div>
            </div>
            <button
              type="button"
              onClick={() => exportWalletsToCsv(wallets)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Експорт</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Google Calendar Synchronization & Gmail Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Google Calendar Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200/50">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Синхронізація з Google Календарем
                </h3>
                <p className="text-xs text-slate-500">
                  Створення нагадувань про обов'язкові платежі та планування робочих змін прямо у вашому Google Calendar.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 space-y-2 text-xs">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <CalendarCheck className="h-3.5 w-3.5 text-blue-600" />
                <span>Циклічні платежі до синхронізації: {recurringPayments.length}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Події створюються на дату платежу з нагадуванням за 24 години на телефон та email.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleSyncAllToCalendar}
              disabled={isSyncingCalendar || needsAuth || !user}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncingCalendar ? 'animate-spin' : ''}`} />
              <span>
                {isSyncingCalendar
                  ? 'Синхронізація з Календарем...'
                  : 'Синхронізувати платежі з Google Календарем'}
              </span>
            </button>
            {needsAuth && (
              <p className="text-[10px] text-amber-600 mt-1.5 text-center">
                * Потрібно увійти через Google (кнопка вгорі праворуч)
              </p>
            )}
          </div>
        </div>

        {/* Gmail API Monthly Summary Report */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 border border-red-200/50">
                <Mail className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Відправка фінансового звіту на пошту (Email)
                </h3>
                <p className="text-xs text-slate-500">
                  Отримайте підсумковий місячний рапорт з доходами, витратами, бюджетами та відпрацьованими годинами на вашу пошту.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Звіт за місяць:
                  </label>
                  <input
                    type="month"
                    value={reportMonth}
                    onChange={(e) => setReportMonth(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Адреса Email:
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={handleSendEmailReport}
              disabled={isSendingEmail || needsAuth || !user}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
            >
              <Send className={`h-3.5 w-3.5 ${isSendingEmail ? 'animate-pulse' : ''}`} />
              <span>
                {isSendingEmail
                  ? 'Формування та надсилання звіту...'
                  : 'Надіслати підсумковий звіт на пошту'}
              </span>
            </button>
            {needsAuth && (
              <p className="text-[10px] text-amber-600 mt-1.5 text-center">
                * Потрібно увійти через Google (кнопка вгорі праворуч)
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 5. Separate Data Management & Clear Actions */}
      <div className="rounded-xl border border-red-200/70 bg-white p-5 sm:p-6 space-y-4">
        <div className="flex items-start gap-3 pb-3 border-b border-red-100">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 border border-red-200/50">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Керування даними та Очищення (Окремі кнопки)
            </h3>
            <p className="text-xs text-slate-500">
              Ви можете окремо скинути налаштування синхронізації або очистити записи без впливу на інші частини додатку
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Button 1: Clear Sync */}
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3.5 flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Unlink className="h-4 w-4 text-amber-600" />
                <span>Очистити синхронізацію</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Відключає Google акаунт, очищає прив'язки Календаря та Email. Ваші фінансові дані залишаються недоторканими.
              </p>
            </div>
            <button
              type="button"
              onClick={handleConfirmClearSync}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100/70 transition-colors shadow-2xs"
            >
              <Unlink className="h-3.5 w-3.5 text-amber-600" />
              <span>Скинути синхронізацію</span>
            </button>
          </div>

          {/* Button 2: Clear Financial Transactions */}
          <div className="rounded-lg border border-red-200 bg-red-50/40 p-3.5 flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                <Trash2 className="h-4 w-4 text-red-600" />
                <span>Очистити транзакції та табель</span>
              </div>
              <p className="text-[11px] text-slate-600 mt-1">
                Видаляє всі операції витрат, доходів та відпрацьовані години. Рахунки гаманців та категорії зберігаються.
              </p>
            </div>
            <button
              type="button"
              onClick={handleConfirmClearData}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors shadow-2xs"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-600" />
              <span>Очистити транзакції</span>
            </button>
          </div>

          {/* Button 3: Factory Reset */}
          <div className="rounded-lg border border-red-300 bg-red-100/50 p-3.5 flex flex-col justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-red-950 flex items-center gap-1.5">
                <RotateCcw className="h-4 w-4 text-red-700" />
                <span>Повне скидання додатку</span>
              </div>
              <p className="text-[11px] text-red-800 mt-1">
                Повністю очищає пам'ять пристрою (localStorage) та повертає систему до чистого початкового стану.
              </p>
            </div>
            <button
              type="button"
              onClick={handleConfirmFactoryReset}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-800 transition-colors shadow-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Скинути все (Factory Reset)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
