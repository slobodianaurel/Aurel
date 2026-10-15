import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TransactionItem,
  WalletItem,
  WorkHourEntry,
  WorkShiftTemplate,
} from '../types/finance';
import {
  Download,
  Play,
  Square,
  Plus,
  Trash2,
  Clock,
  Edit3,
  Check,
  Zap,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  X,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { exportWorkHoursToCsv } from '../utils/csvExport';

interface WorkHoursSectionProps {
  workLogs: WorkHourEntry[];
  wallets: WalletItem[];
  shiftTemplates: WorkShiftTemplate[];
  transactions: TransactionItem[];
  currencySymbol: string;
  currencyCode: string;
  defaultHourlyRate: number;
  defaultBreakMinutes: number;
  defaultProject: string;
  defaultWalletName: string;
  showShiftTimer?: boolean;
  onAddWorkLog: (entry: Omit<WorkHourEntry, 'id'>) => void;
  onUpdateWorkLog: (entry: WorkHourEntry) => void;
  onUpdateStatus: (id: string, status: WorkHourEntry['status']) => void;
  onDeleteWorkLog: (id: string) => void;
  onAddTemplate: (template: Omit<WorkShiftTemplate, 'id'>) => void;
  onDeleteTemplate: (id: string) => void;
  onNavigateToSalaryTransaction?: (month: string, walletName: string, remainingAmount: number) => void;
}

export function calculateHoursBetween(
  startTime: string,
  endTime: string,
  breakMinutes: number
): number {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;

  let totalMinutes = eh * 60 + em - (sh * 60 + sm);
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60; // overnight shift support
  }
  const netMinutes = Math.max(totalMinutes - (breakMinutes || 0), 0);
  return Math.round((netMinutes / 60) * 100) / 100;
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

const ShiftStatusDropdown: React.FC<{
  currentStatus: WorkHourEntry['status'];
  onChangeStatus: (status: WorkHourEntry['status']) => void;
}> = ({ currentStatus, onChangeStatus }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const config = {
    paid: {
      label: 'Оплачено',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100',
      icon: CheckCircle2,
    },
    invoiced: {
      label: 'Виставлено рахунок',
      color: 'text-blue-700 bg-blue-50 border-blue-300 hover:bg-blue-100',
      icon: FileText,
    },
    logged: {
      label: 'Зафіксовано',
      color: 'text-slate-700 bg-slate-100 border-slate-300 hover:bg-slate-200',
      icon: Clock,
    },
  }[currentStatus] || {
    label: 'Зафіксовано',
    color: 'text-slate-700 bg-slate-100 border-slate-300 hover:bg-slate-200',
    icon: Clock,
  };

  const IconComp = config.icon;

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-all shadow-2xs ${config.color}`}
        title={`Статус: ${config.label}. Натисніть для вибору`}
        aria-label={`Змінити статус, поточний: ${config.label}`}
      >
        <IconComp className="h-3.5 w-3.5 shrink-0" />
        <ChevronDown className={`h-3 w-3 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-30 mt-1 w-44 origin-top-right rounded-xl border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5 animate-fadeIn">
          <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
            Змінити статус
          </div>
          <button
            type="button"
            onClick={() => {
              onChangeStatus('paid');
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors hover:bg-emerald-50 hover:text-emerald-900 ${
              currentStatus === 'paid' ? 'bg-emerald-50/70 font-semibold text-emerald-800' : 'text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Оплачено</span>
            </div>
            {currentStatus === 'paid' && <Check className="h-3.5 w-3.5 text-emerald-600" />}
          </button>

          <button
            type="button"
            onClick={() => {
              onChangeStatus('invoiced');
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors hover:bg-blue-50 hover:text-blue-900 ${
              currentStatus === 'invoiced' ? 'bg-blue-50/70 font-semibold text-blue-800' : 'text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-blue-600" />
              <span>Виставлено рахунок</span>
            </div>
            {currentStatus === 'invoiced' && <Check className="h-3.5 w-3.5 text-blue-600" />}
          </button>

          <button
            type="button"
            onClick={() => {
              onChangeStatus('logged');
              setIsOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors hover:bg-slate-100 hover:text-slate-900 ${
              currentStatus === 'logged' ? 'bg-slate-100 font-semibold text-slate-800' : 'text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>Зафіксовано</span>
            </div>
            {currentStatus === 'logged' && <Check className="h-3.5 w-3.5 text-slate-700" />}
          </button>
        </div>
      )}
    </div>
  );
};

export const WorkHoursSection: React.FC<WorkHoursSectionProps> = ({
  workLogs,
  wallets,
  shiftTemplates,
  transactions,
  currencySymbol,
  currencyCode,
  defaultHourlyRate,
  defaultBreakMinutes,
  defaultProject,
  defaultWalletName,
  showShiftTimer = true,
  onAddWorkLog,
  onUpdateWorkLog,
  onUpdateStatus,
  onDeleteWorkLog,
  onAddTemplate,
  onDeleteTemplate,
  onNavigateToSalaryTransaction,
}) => {
  // Month selector for calendar month aggregation (e.g. '2026-10')
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    // Default to current month of work logs or current date
    const latestLog = workLogs[0];
    if (latestLog?.date) {
      return latestLog.date.slice(0, 7);
    }
    return new Date().toISOString().slice(0, 7);
  });

  // Manual Entry Form State
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [project, setProject] = useState(defaultProject || 'Основний проєкт');
  const [taskDescription, setTaskDescription] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:30');
  const [breakMinutes, setBreakMinutes] = useState(String(defaultBreakMinutes));
  const [hourlyRate, setHourlyRate] = useState(String(defaultHourlyRate));
  const [walletName, setWalletName] = useState(
    defaultWalletName || wallets[0]?.name || 'Картка PKO BP'
  );
  const [statusFilter, setStatusFilter] = useState<'all' | WorkHourEntry['status']>('all');

  const [isAddShiftModalOpen, setIsAddShiftModalOpen] = useState(false);

  // Sync defaults when updated in Settings
  useEffect(() => {
    setHourlyRate(String(defaultHourlyRate));
  }, [defaultHourlyRate]);

  useEffect(() => {
    setBreakMinutes(String(defaultBreakMinutes));
  }, [defaultBreakMinutes]);

  useEffect(() => {
    if (defaultProject) {
      setProject(defaultProject);
    }
  }, [defaultProject]);

  useEffect(() => {
    if (wallets.length > 0 && !wallets.some((w) => w.name === walletName)) {
      setWalletName(wallets[0].name);
    }
  }, [wallets, walletName]);

  // Inline Edit State for Work Logs
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editProject, setEditProject] = useState('');
  const [editHours, setEditHours] = useState('');
  const [editRate, setEditRate] = useState('');
  const [editWallet, setEditWallet] = useState('');

  // Multi-selection state for work log batch operations
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);

  // Live Work Timer State
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerStartStamp, setTimerStartStamp] = useState<string | null>(null);

  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const handleToggleTimer = () => {
    if (!isTimerRunning) {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setTimerStartStamp(`${hh}:${mm}`);
      setStartTime(`${hh}:${mm}`);
      setIsTimerRunning(true);
    } else {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setEndTime(`${hh}:${mm}`);
      setIsTimerRunning(false);
    }
  };

  const previewHours = useMemo(
    () =>
      calculateHoursBetween(
        startTime,
        endTime,
        parseInt(breakMinutes, 10) || 0
      ),
    [startTime, endTime, breakMinutes]
  );

  const previewEarned = useMemo(() => {
    const rate = parseFloat(hourlyRate) || 0;
    return Math.round(previewHours * rate * 100) / 100;
  }, [previewHours, hourlyRate]);

  // Check if current parameters match any saved template
  const matchedTemplate = useMemo(() => {
    const rate = parseFloat(hourlyRate);
    const brk = parseInt(breakMinutes, 10) || 0;
    const currentRate = isNaN(rate) ? defaultHourlyRate : rate;
    return shiftTemplates.find((t) => {
      const matchProject = t.project.trim().toLowerCase() === project.trim().toLowerCase();
      const matchTime = t.startTime === startTime && t.endTime === endTime;
      const matchBreak = (t.breakMinutes || 0) === brk;
      const matchRate = Math.abs((t.hourlyRate || 0) - currentRate) < 0.01;
      const matchWallet = !t.walletName || !walletName || t.walletName === walletName;
      return matchProject && matchTime && matchBreak && matchRate && matchWallet;
    });
  }, [shiftTemplates, project, startTime, endTime, breakMinutes, hourlyRate, defaultHourlyRate, walletName]);

  // Checkbox state for "Зберегти як шаблон"
  const [saveAsTemplateChecked, setSaveAsTemplateChecked] = useState(false);
  const [customTemplateName, setCustomTemplateName] = useState('');

  // Whenever matchedTemplate changes or user edits inputs:
  // if matchedTemplate exists, checked is true automatically.
  // If user modifies parameters and they don't match, checked is false by default.
  useEffect(() => {
    if (matchedTemplate) {
      setSaveAsTemplateChecked(true);
      setCustomTemplateName(matchedTemplate.name);
    } else {
      setSaveAsTemplateChecked(false);
      setCustomTemplateName('');
    }
  }, [matchedTemplate]);

  const handleApplyTemplate = (tpl: WorkShiftTemplate) => {
    setProject(tpl.project);
    setTaskDescription(tpl.taskDescription);
    setStartTime(tpl.startTime);
    setEndTime(tpl.endTime);
    setBreakMinutes(String(tpl.breakMinutes));
    setHourlyRate(String(tpl.hourlyRate));
    setWalletName(tpl.walletName);
    setSaveAsTemplateChecked(true);
    setCustomTemplateName(tpl.name);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hrs = previewHours;
    const rate = parseFloat(hourlyRate);
    if (hrs <= 0 || isNaN(rate) || rate < 0) return;

    // If checkbox is checked and there's no existing template with these parameters, save it as a new template!
    if (saveAsTemplateChecked && !matchedTemplate) {
      const tplName =
        customTemplateName.trim() ||
        `${project.trim() || 'Зміна'} (${hrs.toFixed(1)} год)`;
      onAddTemplate({
        name: tplName,
        project: project.trim() || defaultProject || 'Основний проєкт',
        taskDescription: taskDescription.trim() || 'Робоча зміна',
        startTime,
        endTime,
        breakMinutes: parseInt(breakMinutes, 10) || 0,
        hourlyRate: rate,
        walletName,
      });
    }

    onAddWorkLog({
      date,
      project: project.trim() || defaultProject || 'Основний проєкт',
      taskDescription: taskDescription.trim() || 'Робоча зміна',
      startTime,
      endTime,
      breakMinutes: parseInt(breakMinutes, 10) || 0,
      hoursWorked: hrs,
      hourlyRate: rate,
      totalEarned: previewEarned,
      status: 'logged',
      walletName,
    });

    setTaskDescription('');
    setIsAddShiftModalOpen(false);
  };

  const startEditLog = (log: WorkHourEntry) => {
    setEditingLogId(log.id);
    setEditProject(log.project);
    setEditHours(String(log.hoursWorked));
    setEditRate(String(log.hourlyRate));
    setEditWallet(log.walletName || walletName);
  };

  const saveEditLog = (log: WorkHourEntry) => {
    const hrs = parseFloat(editHours);
    const rate = parseFloat(editRate);
    if (!isNaN(hrs) && hrs > 0 && !isNaN(rate) && rate >= 0) {
      onUpdateWorkLog({
        ...log,
        project: editProject.trim() || log.project,
        hoursWorked: hrs,
        hourlyRate: rate,
        totalEarned: Math.round(hrs * rate * 100) / 100,
        walletName: editWallet,
      });
    }
    setEditingLogId(null);
  };

  // Month Aggregation Calculation:
  // 1. Logs in the selected calendar month
  const monthLogs = useMemo(() => {
    return workLogs.filter((w) => w.date.startsWith(selectedMonth));
  }, [workLogs, selectedMonth]);

  // 2. Summary by wallet for the calendar month
  const walletMonthAggregates = useMemo(() => {
    // Unique wallets that either exist in settings or appear in month logs
    const walletMap = new Map<string, {
      walletName: string;
      walletItem?: WalletItem;
      totalHours: number;
      projectedIncome: number;
      confirmedIncome: number;
      remainingForecast: number;
      logCount: number;
    }>();

    // Initialize with existing wallets
    wallets.forEach((w) => {
      walletMap.set(w.name, {
        walletName: w.name,
        walletItem: w,
        totalHours: 0,
        projectedIncome: 0,
        confirmedIncome: 0,
        remainingForecast: 0,
        logCount: 0,
      });
    });

    // Accumulate hours and projected income from month logs
    monthLogs.forEach((log) => {
      const walName = log.walletName || wallets[0]?.name || 'Картка PKO BP';
      let entry = walletMap.get(walName);
      if (!entry) {
        entry = {
          walletName: walName,
          walletItem: wallets.find((w) => w.name === walName),
          totalHours: 0,
          projectedIncome: 0,
          confirmedIncome: 0,
          remainingForecast: 0,
          logCount: 0,
        };
        walletMap.set(walName, entry);
      }
      entry.totalHours += log.hoursWorked;
      entry.projectedIncome += log.totalEarned;
      entry.logCount += 1;
    });

    // Accumulate confirmed income from transactions linked to this month and wallet
    transactions.forEach((tx) => {
      if (tx.type !== 'income') return;
      const isLinkedToThisMonth =
        tx.linkedWorkMonth === selectedMonth ||
        (!tx.linkedWorkMonth &&
          tx.date.startsWith(selectedMonth) &&
          (tx.category.toLowerCase().includes('заробіт') ||
            tx.category.toLowerCase().includes('зарплат')));

      if (isLinkedToThisMonth) {
        const walName = tx.paymentMethod;
        let entry = walletMap.get(walName);
        if (!entry) {
          entry = {
            walletName: walName,
            walletItem: wallets.find((w) => w.name === walName),
            totalHours: 0,
            projectedIncome: 0,
            confirmedIncome: 0,
            remainingForecast: 0,
            logCount: 0,
          };
          walletMap.set(walName, entry);
        }
        entry.confirmedIncome += tx.amount;
      }
    });

    // Calculate remaining unconfirmed forecast for each wallet
    return Array.from(walletMap.values())
      .map((item) => ({
        ...item,
        remainingForecast: Math.max(0, item.projectedIncome - item.confirmedIncome),
      }))
      .filter((item) => item.totalHours > 0);
  }, [monthLogs, transactions, selectedMonth]);

  // Overall totals for selected month
  const monthTotals = useMemo(() => {
    const totalHours = walletMonthAggregates.reduce((sum, a) => sum + a.totalHours, 0);
    const projectedIncome = walletMonthAggregates.reduce((sum, a) => sum + a.projectedIncome, 0);
    const confirmedIncome = walletMonthAggregates.reduce((sum, a) => sum + a.confirmedIncome, 0);
    const remainingForecast = Math.max(0, projectedIncome - confirmedIncome);
    return {
      totalHours,
      projectedIncome,
      confirmedIncome,
      remainingForecast,
    };
  }, [walletMonthAggregates]);

  // Lifetime summary
  const lifetimeSummary = useMemo(() => {
    const totalHours = workLogs.reduce((sum, w) => sum + w.hoursWorked, 0);
    const totalEarned = workLogs.reduce((sum, w) => sum + w.totalEarned, 0);
    return { totalHours, totalEarned };
  }, [workLogs]);

  const filteredLogs = useMemo(() => {
    const list =
      statusFilter === 'all'
        ? workLogs
        : workLogs.filter((w) => w.status === statusFilter);
    return [...list].sort(
      (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)
    );
  }, [workLogs, statusFilter]);

  const formatTimer = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(
      2,
      '0'
    )}:${String(s).padStart(2, '0')}`;
  };

  const activeWallet = wallets.find((w) => w.name === walletName);
  const activeSym = activeWallet?.currencySymbol || currencySymbol;
  const monthLabel = getMonthDateRangeLabel(selectedMonth);

  return (
    <div className="space-y-6">
      {/* 1. TOP SECTION: MONTH SELECTION & KPI CARDS */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Clock className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Облік робочих годин та заробітку за календарний місяць
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Години підбиваються по гаманцях однією сумою за календарний місяць ({monthLabel}). Дохід є прогнозованим, поки не підтверджений транзакцією.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Calendar Month Picker */}
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5">
              <Calendar className="h-4 w-4 text-slate-500" />
              <label htmlFor="work-month-select" className="text-xs font-medium text-slate-700 whitespace-nowrap">
                Місяць:
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
                  {formatMonthNameUa(selectedMonth)}
                </span>
                <input
                  id="work-month-select"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-900 cursor-pointer"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddShiftModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Додати відпрацьовані години</span>
            </button>
          </div>
        </div>

        {/* Calendar Month Aggregate KPI Grid */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="text-xs font-medium text-slate-500">
              Відпрацьовано за {formatMonthNameUa(selectedMonth)}
            </div>
            <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {monthTotals.totalHours.toFixed(1)} год
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Період: {monthLabel}
            </div>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-blue-700">
                Спрогнозований дохід
              </span>
              <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <div className="mt-1.5 font-mono text-2xl font-bold text-blue-900 tabular-nums">
              {monthTotals.projectedIncome.toLocaleString('uk-UA')} {currencySymbol}
            </div>
            <div className="mt-1 text-[11px] text-blue-600">
              Очікується за ставкою робочого часу
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-700">
                Підтверджено транзакціями
              </span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="mt-1.5 font-mono text-2xl font-bold text-emerald-900 tabular-nums">
              {monthTotals.confirmedIncome.toLocaleString('uk-UA')} {currencySymbol}
            </div>
            <div className="mt-1 text-[11px] text-emerald-600">
              Фактично зараховано на баланс карток
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-700">
                Залишок до виплати
              </span>
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <div className="mt-1.5 font-mono text-2xl font-bold text-amber-900 tabular-nums">
              {monthTotals.remainingForecast.toLocaleString('uk-UA')} {currencySymbol}
            </div>
            <div className="mt-1 text-[11px] text-amber-600">
              Прогноз мінус підтверджені надходження
            </div>
          </div>
        </div>

        {/* 2. AGGREGATION BY WALLET FOR THE CALENDAR MONTH */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Підсумок годин та заробітку по гаманцях ({monthLabel})
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              Всього по гаманцях: {monthTotals.totalHours.toFixed(1)} год
            </span>
          </div>

          {walletMonthAggregates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center text-xs text-slate-500">
              У вибраному місяці ({monthLabel}) немає зафіксованих годин по жодному гаманцю.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs divide-y divide-slate-200">
                <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
                  <tr>
                    <th className="px-4 py-2.5">Гаманець / Рахунок</th>
                    <th className="px-4 py-2.5 font-mono text-right">Загальна к-ть годин</th>
                    <th className="px-4 py-2.5 font-mono text-right">Прогнозований дохід</th>
                    <th className="px-4 py-2.5 font-mono text-right">Підтверджено</th>
                    <th className="px-4 py-2.5 font-mono text-right">Залишок до виплати</th>
                    <th className="px-4 py-2.5 text-center">Статус виплати</th>
                    <th className="px-4 py-2.5 text-right">Дія</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {walletMonthAggregates.map((agg) => {
                    const wSym = agg.walletItem?.currencySymbol || currencySymbol;
                    const isFullyPaid = agg.projectedIncome > 0 && agg.confirmedIncome >= agg.projectedIncome;
                    const isPartiallyPaid = agg.confirmedIncome > 0 && agg.confirmedIncome < agg.projectedIncome;

                    return (
                      <tr key={agg.walletName} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{agg.walletItem?.icon || '💳'}</span>
                            <div>
                              <div className="font-semibold text-slate-900">{agg.walletName}</div>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {agg.walletItem?.currencyCode || currencyCode} · {agg.logCount} змін(и)
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3 font-mono font-bold text-slate-900 text-right tabular-nums">
                          {agg.totalHours.toFixed(1)} год
                        </td>

                        <td className="px-4 py-3 font-mono font-semibold text-blue-800 text-right tabular-nums">
                          {agg.projectedIncome.toLocaleString('uk-UA')} {wSym}
                        </td>

                        <td className="px-4 py-3 font-mono font-semibold text-emerald-700 text-right tabular-nums">
                          {agg.confirmedIncome.toLocaleString('uk-UA')} {wSym}
                        </td>

                        <td className="px-4 py-3 font-mono font-semibold text-amber-700 text-right tabular-nums">
                          {agg.remainingForecast.toLocaleString('uk-UA')} {wSym}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {agg.projectedIncome === 0 ? (
                            <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                              Немає годин
                            </span>
                          ) : isFullyPaid ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-medium text-emerald-800">
                              <CheckCircle2 className="h-3 w-3" />
                              Підтверджено повністю
                            </span>
                          ) : isPartiallyPaid ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-medium text-blue-800">
                              Частково ({Math.round((agg.confirmedIncome / agg.projectedIncome) * 100)}%)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-medium text-amber-800">
                              Прогнозовано (очікує)
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          {agg.remainingForecast > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (onNavigateToSalaryTransaction) {
                                  onNavigateToSalaryTransaction(
                                    selectedMonth,
                                    agg.walletName,
                                    agg.remainingForecast
                                  );
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-slate-800 transition-colors whitespace-nowrap"
                              title="Створити транзакцію зарахування зарплати"
                            >
                              <span>Підтвердити</span>
                              <ArrowRight className="h-3 w-3" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">Розраховано</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 3. OPTIONAL LIVE SHIFT STOPWATCH (Controlled via Settings showShiftTimer) */}
      {showShiftTimer && (
        <div className="rounded-xl border border-slate-200 bg-slate-900 p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold tracking-wider uppercase text-slate-300">
                Живий таймер робочої зміни
              </span>
            </div>
            <div className="font-mono text-4xl font-extrabold tracking-tight tabular-nums">
              {formatTimer(elapsedSeconds)}
            </div>
            <p className="text-xs text-slate-400">
              {timerStartStamp
                ? `Старт зміни о ${timerStartStamp} · Поточна ставка: ${hourlyRate} ${activeSym}/год · Цільовий гаманець: ${walletName}`
                : `Ставка: ${hourlyRate} ${activeSym}/год · Цільовий гаманець: ${walletName}. Натисніть «Почати зміну», щоб запустити відлік.`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleToggleTimer}
              className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                isTimerRunning
                  ? 'bg-red-600 text-white hover:bg-red-700 shadow-md'
                  : 'bg-white text-slate-900 hover:bg-slate-100 shadow-sm'
              }`}
            >
              {isTimerRunning ? (
                <>
                  <Square className="h-4 w-4" />
                  <span>Завершити зміну</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 text-emerald-600" />
                  <span>Почати зміну</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}



      {/* 5. POPUP MODAL: ADD WORK SHIFT */}
      {isAddShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl lg:max-w-3xl rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <Clock className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Додати відпрацьовані години
                  </h3>
                  <p className="text-xs text-slate-500">
                    Запис робочої зміни з автоматичним розрахунком годин та прогнозованого заробітку
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddShiftModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Template Picker inside Modal */}
            {shiftTemplates.length > 0 && (
              <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[11px] font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                    <span>Швидкий шаблон зміни:</span>
                  </div>
                  {matchedTemplate && (
                    <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                      <Check className="h-3 w-3 text-emerald-700" />
                      Вибрано: {matchedTemplate.name}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {shiftTemplates.map((tpl) => {
                    const isSelected = matchedTemplate?.id === tpl.id;
                    return (
                      <div key={tpl.id} className="relative inline-flex items-center group">
                        <button
                          type="button"
                          onClick={() => handleApplyTemplate(tpl)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all shadow-2xs ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/30 font-semibold'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                          }`}
                        >
                          {isSelected && <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[2.5]" />}
                          <span>{tpl.name}</span>
                          <span
                            className={`text-[10px] font-mono ${
                              isSelected ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                            }`}
                          >
                            ({tpl.startTime}–{tpl.endTime})
                          </span>
                        </button>
                        {onDeleteTemplate && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTemplate(tpl.id);
                            }}
                            className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                            title={`Видалити шаблон «${tpl.name}»`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Дата зміни <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Проєкт / Компанія <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Напр. Millennium, Офіс"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Привʼязка до гаманця
                  </label>
                  <select
                    value={walletName}
                    onChange={(e) => setWalletName(e.target.value)}
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
                    Початок
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Кінець
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Перерва (хв)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Опис завдань
                  </label>
                  <input
                    type="text"
                    placeholder="Виконані завдання"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Погодинна ставка ({activeSym}/год)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Calculation Preview Strip */}
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-4">
                  <span className="text-slate-600">
                    Чистий час:{' '}
                    <strong className="font-mono text-slate-900">
                      {previewHours.toFixed(1)} год
                    </strong>
                  </span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-600">
                    Прогноз заробітку:{' '}
                    <strong className="font-mono text-blue-700">
                      {previewEarned.toLocaleString('uk-UA')} {activeSym}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Checkbox: Save as template / Already saved in template */}
              <div
                className={`rounded-xl border p-3.5 transition-colors ${
                  matchedTemplate
                    ? 'border-emerald-200 bg-emerald-50/60'
                    : saveAsTemplateChecked
                    ? 'border-blue-200 bg-blue-50/50'
                    : 'border-slate-200 bg-slate-50/70'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="saveAsTemplateCheckbox"
                    checked={saveAsTemplateChecked}
                    onChange={(e) => setSaveAsTemplateChecked(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="saveAsTemplateCheckbox"
                      className="text-xs font-semibold text-slate-800 cursor-pointer flex flex-wrap items-center gap-2"
                    >
                      <span>Зберегти параметри як шаблон робочої зміни</span>
                      {matchedTemplate && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          <Check className="h-3 w-3" /> Збережено в шаблон «{matchedTemplate.name}»
                        </span>
                      )}
                    </label>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {matchedTemplate
                        ? 'Поточні параметри відповідають збереженому шаблону (галочка активована).'
                        : 'Якщо увімкнути галочку, ці параметри (години, проєкт, ставка) будуть збережені в новий шаблон для швидкого вибору.'}
                    </p>

                    {/* Custom Template Name Input when creating a new template */}
                    {saveAsTemplateChecked && !matchedTemplate && (
                      <div className="mt-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
                        <input
                          type="text"
                          placeholder={`Назва шаблону (напр. ${project || 'Зміна'} ${startTime}–${endTime})`}
                          value={customTemplateName}
                          onChange={(e) => setCustomTemplateName(e.target.value)}
                          className="w-full sm:max-w-md rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                        />
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">
                          (буде додано до швидких шаблонів)
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddShiftModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Додати запис у журнал</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. LOGS TABLE */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              Журнал відпрацьованих змін ({filteredLogs.length})
            </h3>
            {selectedLogIds.length > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-bold text-blue-800">
                Вибрано {selectedLogIds.length}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAddShiftModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-2xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Додати години</span>
            </button>

            <span className="text-xs text-slate-500 ml-2">Фільтр статусу:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-800"
            >
              <option value="all">Усі статуси</option>
              <option value="logged">Зафіксовано (прогноз)</option>
              <option value="invoiced">Виставлено рахунок</option>
              <option value="paid">Оплачено</option>
            </select>
          </div>
        </div>

        {/* BATCH ACTIONS TOOLBAR FOR MULTI-SELECTION */}
        {selectedLogIds.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs">
            <div className="flex items-center gap-2 text-blue-950 font-semibold">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              <span>Вибрано {selectedLogIds.length} змін(и). Змінити статус для всіх:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  selectedLogIds.forEach((id) => onUpdateStatus(id, 'logged'));
                  setSelectedLogIds([]);
                }}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-slate-800 hover:bg-slate-100 font-medium shadow-2xs transition-colors"
                title="Встановити статус Зафіксовано для вибраних"
              >
                Зафіксовано
              </button>
              <button
                type="button"
                onClick={() => {
                  selectedLogIds.forEach((id) => onUpdateStatus(id, 'invoiced'));
                  setSelectedLogIds([]);
                }}
                className="rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-blue-800 hover:bg-blue-50 font-medium shadow-2xs transition-colors"
                title="Встановити статус Виставлено рахунок для вибраних"
              >
                Виставлено рахунок
              </button>
              <button
                type="button"
                onClick={() => {
                  selectedLogIds.forEach((id) => onUpdateStatus(id, 'paid'));
                  setSelectedLogIds([]);
                }}
                className="rounded-lg bg-emerald-600 px-3 py-1 text-white hover:bg-emerald-700 font-medium shadow-2xs transition-colors"
                title="Встановити статус Оплачено для вибраних"
              >
                Оплачено
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Видалити ${selectedLogIds.length} вибраних змін?`)) {
                    selectedLogIds.forEach((id) => onDeleteWorkLog(id));
                    setSelectedLogIds([]);
                  }
                }}
                className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-red-700 hover:bg-red-50 font-medium shadow-2xs transition-colors"
              >
                Видалити вибрані
              </button>
              <button
                type="button"
                onClick={() => setSelectedLogIds([])}
                className="text-slate-500 hover:text-slate-800 underline px-1 text-[11px]"
              >
                Скасувати вибір
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs divide-y divide-slate-200">
            <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
              <tr>
                <th className="w-9 px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    aria-label="Вибрати всі зміни"
                    checked={
                      filteredLogs.length > 0 &&
                      filteredLogs.every((l) => selectedLogIds.includes(l.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedLogIds(filteredLogs.map((l) => l.id));
                      } else {
                        setSelectedLogIds([]);
                      }
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                </th>
                <th className="px-3 py-2.5">Дата</th>
                <th className="px-3 py-2.5">Проєкт та завдання</th>
                <th className="px-3 py-2.5">Час / Перерва</th>
                <th className="px-3 py-2.5 font-mono text-right">Години</th>
                <th className="px-3 py-2.5 font-mono text-right">Ставка</th>
                <th className="px-3 py-2.5 font-mono text-right">Прогноз суми</th>
                <th className="px-3 py-2.5">Гаманець</th>
                <th className="px-3 py-2.5 text-center">Статус</th>
                <th className="px-3 py-2.5 text-right">Дії</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredLogs.map((log) => {
                const isEditing = editingLogId === log.id;
                const logWallet = wallets.find((w) => w.name === log.walletName);
                const sym = logWallet?.currencySymbol || currencySymbol;
                const isSelected = selectedLogIds.includes(log.id);

                return (
                  <tr
                    key={log.id}
                    className={`transition-colors ${
                      isSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Вибрати зміну ${log.date} ${log.project}`}
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedLogIds((prev) => [...prev, log.id]);
                          } else {
                            setSelectedLogIds((prev) => prev.filter((id) => id !== log.id));
                          }
                        }}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                      />
                    </td>
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap text-slate-700">
                      {log.date}
                    </td>

                    <td className="px-3 py-2.5">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editProject}
                          onChange={(e) => setEditProject(e.target.value)}
                          className="rounded border border-slate-300 px-2 py-1 text-xs w-full"
                        />
                      ) : (
                        <div>
                          <div className="font-semibold text-slate-900">{log.project}</div>
                          <div className="text-[11px] text-slate-500">{log.taskDescription}</div>
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2.5 font-mono text-slate-600 whitespace-nowrap text-[11px]">
                      {log.startTime}–{log.endTime} ({log.breakMinutes} хв)
                    </td>

                    <td className="px-3 py-2.5 font-mono font-bold text-slate-900 text-right tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.1"
                          value={editHours}
                          onChange={(e) => setEditHours(e.target.value)}
                          className="w-16 rounded border border-slate-300 px-1 py-0.5 text-right"
                        />
                      ) : (
                        `${log.hoursWorked.toFixed(1)} год`
                      )}
                    </td>

                    <td className="px-3 py-2.5 font-mono text-slate-700 text-right tabular-nums">
                      {isEditing ? (
                        <input
                          type="number"
                          step="any"
                          value={editRate}
                          onChange={(e) => setEditRate(e.target.value)}
                          className="w-16 rounded border border-slate-300 px-1 py-0.5 text-right"
                        />
                      ) : (
                        `${log.hourlyRate} ${sym}`
                      )}
                    </td>

                    <td className="px-3 py-2.5 font-mono font-bold text-blue-700 text-right tabular-nums">
                      {log.totalEarned.toLocaleString('uk-UA')} {sym}
                    </td>

                    <td className="px-3 py-2.5 text-slate-700 whitespace-nowrap">
                      {isEditing ? (
                        <select
                          value={editWallet}
                          onChange={(e) => setEditWallet(e.target.value)}
                          className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                        >
                          {wallets.map((w) => (
                            <option key={w.id} value={w.name}>
                              {w.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-800">
                          {log.walletName || '—'}
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-2.5 text-center">
                      <ShiftStatusDropdown
                        currentStatus={log.status}
                        onChangeStatus={(newStatus) => onUpdateStatus(log.id, newStatus)}
                      />
                    </td>

                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => saveEditLog(log)}
                            className="p-1 text-emerald-600 hover:text-emerald-800"
                            title="Зберегти"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditLog(log)}
                            className="p-1 text-slate-400 hover:text-slate-700"
                            title="Редагувати"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteWorkLog(log.id)}
                          className="p-1 text-slate-400 hover:text-red-600"
                          title="Видалити"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
