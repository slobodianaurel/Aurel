export interface CurrencyConfig {
  code: string;   // e.g. 'PLN', 'UAH', 'USD', 'EUR'
  symbol: string; // e.g. 'zł', '₴', '$', '€'
  name: string;   // e.g. 'Польський злотий'
}

export const PRESET_CURRENCIES: CurrencyConfig[] = [
  { code: 'PLN', symbol: 'zł', name: 'Польський злотий (PLN)' },
  { code: 'UAH', symbol: '₴', name: 'Українська гривня (UAH)' },
  { code: 'EUR', symbol: '€', name: 'Євро (EUR)' },
  { code: 'USD', symbol: '$', name: 'Долар США (USD)' },
  { code: 'GBP', symbol: '£', name: 'Фунт стерлінгів (GBP)' },
  { code: 'CZK', symbol: 'Kč', name: 'Чеська крона (CZK)' },
];

export const WALLET_ICONS = ['💳', '💵', '🏦', '🪙', '💼', '📱', '🏠', '🚗', '✈️', '🛡️'];

export const WALLET_COLORS = [
  { label: 'Сланець', value: '#0f172a' },
  { label: 'Синій', value: '#2563eb' },
  { label: 'Смарагдовий', value: '#059669' },
  { label: 'Бурштиновий', value: '#d97706' },
  { label: 'Фіолетовий', value: '#7c3aed' },
  { label: 'Рубіновий', value: '#dc2626' },
  { label: 'Бірюзовий', value: '#0891b2' },
];

export const CATEGORY_COLORS = [
  { label: 'Синій', value: '#2563eb' },
  { label: 'Смарагдовий', value: '#059669' },
  { label: 'Бурштиновий', value: '#d97706' },
  { label: 'Рубіновий', value: '#dc2626' },
  { label: 'Фіолетовий', value: '#7c3aed' },
  { label: 'Бірюзовий', value: '#0891b2' },
  { label: 'Рожевий', value: '#db2777' },
  { label: 'Індиго', value: '#4f46e5' },
  { label: 'Сланець', value: '#475569' },
];

export interface WalletItem {
  id: string;
  name: string;
  type: 'card' | 'cash' | 'bank' | 'crypto';
  initialBalance: number;
  currencyCode: string;
  currencySymbol: string;
  icon: string;
  color: string;
}

export interface DashboardWidgetsConfig {
  kpiStrip: boolean;
  charts: boolean;
  walletsOverview: boolean;
  pendingRecurring: boolean;
  quickTransaction: boolean;
  budgetsPreview: boolean;
  workHoursPreview: boolean;
}

export interface AppSettings {
  currency: CurrencyConfig;
  defaultHourlyRate: number;
  defaultBreakMinutes: number;
  defaultProject: string;
  defaultWorkWalletId: string;
  notificationEmail: string;
  autoEmailBudgetAlerts: boolean;
  dashboardWidgets: DashboardWidgetsConfig;
  showShiftTimer: boolean;
  autoHideSidebar: boolean;
  customExchangeRates?: Record<string, number>;
}

export interface BudgetCategory {
  id: string;
  name: string;
  color?: string; // Hex color for category
  icon?: string; // Emoji icon for category
  subcategories: string[];
  subcategoryIcons?: Record<string, string>; // Subcategory name -> emoji icon
  monthlyLimit: number;
  /** Optional month-specific limits keyed by YYYY-MM (e.g. '2026-10': 1500) */
  monthlyLimitsByMonth?: Record<string, number>;
  alertThresholdPercent: number; // e.g. 80
  notes?: string;
}

export interface IncomeCategory {
  id: string;
  name: string;
  icon?: string; // Emoji icon for category
  subcategories: string[];
  subcategoryIcons?: Record<string, string>; // Subcategory name -> emoji icon
  isSalary?: boolean; // Whether this category represents salary/work hours
}

export type TransactionType = 'expense' | 'income' | 'transfer';

export type ExpensePriority = 'need' | 'could' | 'want';

export interface ExpensePriorityConfig {
  id: ExpensePriority;
  label: string; // 'Потрібно' | 'Можу' | 'Хочу'
  desc: string;
  color: string;
  badgeBg: string;
  dotColor: string;
}

export const EXPENSE_PRIORITIES: ExpensePriorityConfig[] = [
  {
    id: 'need',
    label: 'Потрібно',
    desc: 'Обов’язкові витрати (житло, їжа, здоров’я, пальне)',
    color: '#dc2626',
    badgeBg: 'bg-red-50 text-red-700 border-red-200',
    dotColor: 'bg-red-500',
  },
  {
    id: 'could',
    label: 'Можу',
    desc: 'Комфортні або плановані витрати (кафе, підписки, таксі)',
    color: '#d97706',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
    dotColor: 'bg-amber-500',
  },
  {
    id: 'want',
    label: 'Хочу',
    desc: 'Бажання, розваги, спонтанні покупки, хобі',
    color: '#059669',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotColor: 'bg-emerald-500',
  },
];

export interface TransactionSubcategorySplit {
  subcategory: string;
  amount: number;
  note?: string;
  expensePriority?: ExpensePriority;
}

export interface TransactionItem {
  id: string;
  date: string; // YYYY-MM-DD
  category: string;
  subcategory?: string;
  splits?: TransactionSubcategorySplit[]; // Optional breakdown of one transaction into multiple subcategories with amounts
  merchant?: string; // Продавець / Заклад / Торгова точка (Biedronka, Lidl, Żabka, Orlen, тощо)
  description: string;
  amount: number;
  type: TransactionType;
  expensePriority?: ExpensePriority; // 'need' | 'could' | 'want'
  paymentMethod: string; // Primary wallet name (or source wallet for transfer)
  toWalletName?: string; // Target wallet name when type === 'transfer'
  toAmount?: number;     // Target amount when transferring between different currency wallets
  currencyCode?: string;
  currencySymbol?: string;
  recurringId?: string;
  linkedWorkMonth?: string; // e.g. '2026-10' when source is salary / work hours
}

export interface RecurringPayment {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  subcategory?: string;
  walletName: string;
  toWalletName?: string;
  frequency: 'monthly' | 'weekly' | 'yearly';
  nextDueDate: string; // YYYY-MM-DD
  reminderMinutesBefore: number; // e.g. 1440 (24h before)
  calendarEventId?: string;
  lastConfirmedDate?: string;
  isActive: boolean;
}

export interface WorkShiftTemplate {
  id: string;
  name: string;
  project: string;
  taskDescription: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hourlyRate: number;
  walletName: string;
}

export interface WorkHourEntry {
  id: string;
  date: string; // YYYY-MM-DD
  project: string;
  taskDescription: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  breakMinutes: number;
  hoursWorked: number;
  hourlyRate: number;
  totalEarned: number;
  status: 'paid' | 'invoiced' | 'logged';
  walletName?: string;
}

export interface SpreadsheetFileInfo {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface SpreadsheetMetadataInfo {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheetTabs: {
    sheetId: number;
    title: string;
    rowCount: number;
    columnCount: number;
  }[];
}

export const INITIAL_WALLETS: WalletItem[] = [
  {
    id: 'wal-1',
    name: 'Картка PKO BP',
    type: 'card',
    initialBalance: 4500,
    currencyCode: 'PLN',
    currencySymbol: 'zł',
    icon: '💳',
    color: '#0f172a',
  },
  {
    id: 'wal-5',
    name: 'Картка Millennium',
    type: 'card',
    initialBalance: 3200,
    currencyCode: 'PLN',
    currencySymbol: 'zł',
    icon: '💳',
    color: '#dc2626',
  },
  {
    id: 'wal-2',
    name: 'Revolut',
    type: 'card',
    initialBalance: 1800,
    currencyCode: 'PLN',
    currencySymbol: 'zł',
    icon: '📱',
    color: '#2563eb',
  },
  {
    id: 'wal-3',
    name: 'Готівка (PLN)',
    type: 'cash',
    initialBalance: 650,
    currencyCode: 'PLN',
    currencySymbol: 'zł',
    icon: '💵',
    color: '#059669',
  },
  {
    id: 'wal-4',
    name: 'Картка Monobank',
    type: 'card',
    initialBalance: 18500,
    currencyCode: 'UAH',
    currencySymbol: '₴',
    icon: '🏦',
    color: '#7c3aed',
  },
];

export const INITIAL_SETTINGS: AppSettings = {
  currency: { code: 'PLN', symbol: 'zł', name: 'Польський злотий (PLN)' },
  defaultHourlyRate: 29,
  defaultBreakMinutes: 30,
  defaultProject: 'Основний проєкт',
  defaultWorkWalletId: 'Картка PKO BP',
  notificationEmail: 'Krb.aurel.sl@gmail.com',
  autoEmailBudgetAlerts: true,
  dashboardWidgets: {
    kpiStrip: true,
    charts: true,
    walletsOverview: true,
    pendingRecurring: true,
    quickTransaction: true,
    budgetsPreview: true,
    workHoursPreview: true,
  },
  showShiftTimer: true,
  autoHideSidebar: false,
};

export const INITIAL_MONTHLY_BUDGETS: Record<string, Record<string, number>> = {
  '2026-09': {
    'Житло та оренда': 2600,
    'Продукти та супермаркети': 1400,
    'Авто та транспорт': 450,
    'Кафе та ресторани': 400,
    'Підписки та звʼязок': 220,
    'Здоровʼя та спорт': 300,
  },
  '2026-10': {
    'Житло та оренда': 2600,
    'Продукти та супермаркети': 1450,
    'Авто та транспорт': 500,
    'Кафе та ресторани': 400,
    'Підписки та звʼязок': 220,
    'Здоровʼя та спорт': 300,
  },
};

export const INITIAL_MERCHANTS: string[] = [
  'Biedronka',
  'Lidl',
  'Żabka',
  'Orlen',
  'Allegro',
  'Carrefour',
  'Rossmann',
  'Uber',
  'Apteka',
  'IKEA',
  'Netflix',
  'Spotify',
];

export const INITIAL_BUDGETS: BudgetCategory[] = [
  {
    id: 'cat-1',
    name: 'Житло та оренда',
    icon: '🏠',
    color: '#2563eb', // Blue
    subcategories: ['Оренда квартири', 'Електроенергія', 'Вода та опалення', 'Інтернет та ТБ'],
    subcategoryIcons: {
      'Оренда квартири': '🔑',
      'Електроенергія': '⚡',
      'Вода та опалення': '💧',
      'Інтернет та ТБ': '🌐',
    },
    monthlyLimit: 2600,
    monthlyLimitsByMonth: { '2026-09': 2600, '2026-10': 2600 },
    alertThresholdPercent: 85,
    notes: 'Оренда квартири та комунальні послуги',
  },
  {
    id: 'cat-2',
    name: 'Продукти та супермаркети',
    icon: '🛒',
    color: '#059669', // Emerald
    subcategories: ['Базові продукти', 'Мʼясо та риба', 'Овочі та Фрукти', 'Алкоголь', 'Солодощі', 'Снеки', 'Побутова хімія'],
    subcategoryIcons: {
      'Базові продукти': '🍞',
      'Мʼясо та риба': '🥩',
      'Овочі та Фрукти': '🥦',
      'Алкоголь': '🍷',
      'Солодощі': '🍫',
      'Снеки': '🍿',
      'Побутова хімія': '🧼',
    },
    monthlyLimit: 1400,
    monthlyLimitsByMonth: { '2026-09': 1400, '2026-10': 1450 },
    alertThresholdPercent: 80,
    notes: 'Щотижневі закупівлі (Biedronka, Lidl, Сільпо)',
  },
  {
    id: 'cat-3',
    name: 'Авто та транспорт',
    icon: '🚗',
    color: '#d97706', // Amber
    subcategories: ['Паливо', 'Громадський транспорт', 'Паркування', 'Сервіс та страхування', 'Таксі'],
    subcategoryIcons: {
      'Паливо': '⛽',
      'Громадський транспорт': '🚌',
      'Паркування': '🅿️',
      'Сервіс та страхування': '🔧',
      'Таксі': '🚕',
    },
    monthlyLimit: 450,
    monthlyLimitsByMonth: { '2026-09': 450, '2026-10': 500 },
    alertThresholdPercent: 80,
    notes: 'Пальне, проїзний, обслуговування авто',
  },
  {
    id: 'cat-4',
    name: 'Кафе та ресторани',
    icon: '☕',
    color: '#dc2626', // Red
    subcategories: ['Кава та пекарні', 'Обіди на роботі', 'Вечері та зустрічі', 'Доставка їжі'],
    subcategoryIcons: {
      'Кава та пекарні': '🥐',
      'Обіди на роботі': '🍱',
      'Вечері та зустрічі': '🍽️',
      'Доставка їжі': '🍕',
    },
    monthlyLimit: 400,
    monthlyLimitsByMonth: { '2026-09': 400, '2026-10': 400 },
    alertThresholdPercent: 75,
    notes: 'Кава, обіди поза домом',
  },
  {
    id: 'cat-5',
    name: 'Підписки та звʼязок',
    icon: '📱',
    color: '#7c3aed', // Purple
    subcategories: ['Мобільний тариф', 'Хмарні сервіси', 'Стрімінг та музика', 'Програмне забезпечення'],
    subcategoryIcons: {
      'Мобільний тариф': '📶',
      'Хмарні сервіси': '☁️',
      'Стрімінг та музика': '🎬',
      'Програмне забезпечення': '💻',
    },
    monthlyLimit: 220,
    monthlyLimitsByMonth: { '2026-09': 220, '2026-10': 220 },
    alertThresholdPercent: 90,
    notes: 'Мобільний інтернет, хмарні сервіси',
  },
  {
    id: 'cat-6',
    name: 'Здоровʼя та спорт',
    icon: '🏋️',
    color: '#0891b2', // Cyan
    subcategories: ['Спортзал', 'Аптека та вітаміни', 'Стоматологія та лікарі'],
    subcategoryIcons: {
      'Спортзал': '💪',
      'Аптека та вітаміни': '💊',
      'Стоматологія та лікарі': '🩺',
    },
    monthlyLimit: 300,
    monthlyLimitsByMonth: { '2026-09': 300, '2026-10': 300 },
    alertThresholdPercent: 80,
    notes: 'Абонемент у зал, аптека',
  },
];

export const INITIAL_INCOME_CATEGORIES: IncomeCategory[] = [
  {
    id: 'inc-1',
    name: 'Заробітна плата',
    icon: '💼',
    subcategories: ['Погодинний заробіток', 'Аванс', 'Основна ставка', 'Премія / Бонус'],
    subcategoryIcons: {
      'Погодинний заробіток': '⏱️',
      'Аванс': '💵',
      'Основна ставка': '🏦',
      'Премія / Бонус': '🎁',
    },
    isSalary: true,
  },
  {
    id: 'inc-2',
    name: 'Фріланс та підробіток',
    icon: '💻',
    subcategories: ['Проєктне замовлення', 'Консультації', 'Погодинні підробітки'],
    subcategoryIcons: {
      'Проєктне замовлення': '📑',
      'Консультації': '💡',
      'Погодинні підробітки': '🕒',
    },
    isSalary: false,
  },
  {
    id: 'inc-3',
    name: 'Пасивний дохід та інвестиції',
    icon: '📈',
    subcategories: ['Дивіденди', 'Відсотки по депозитах', 'Кешбек та бонуси'],
    subcategoryIcons: {
      'Дивіденди': '🪙',
      'Відсотки по депозитах': '💰',
      'Кешбек та бонуси': '✨',
    },
    isSalary: false,
  },
  {
    id: 'inc-4',
    name: 'Інші надходження',
    icon: '🎁',
    subcategories: ['Повернення боргу', 'Подарунки', 'Продаж речей'],
    subcategoryIcons: {
      'Повернення боргу': '🤝',
      'Подарунки': '🎀',
      'Продаж речей': '🏷️',
    },
    isSalary: false,
  },
];

export const INITIAL_RECURRING_PAYMENTS: RecurringPayment[] = [
  {
    id: 'rec-1',
    title: 'Оренда квартири та чинш',
    amount: 2200,
    type: 'expense',
    category: 'Житло та оренда',
    subcategory: 'Оренда квартири',
    walletName: 'Картка PKO BP',
    frequency: 'monthly',
    nextDueDate: '2026-10-05',
    reminderMinutesBefore: 1440,
    isActive: true,
  },
  {
    id: 'rec-2',
    title: 'Домашній інтернет та мобільний пакет',
    amount: 85,
    type: 'expense',
    category: 'Підписки та звʼязок',
    subcategory: 'Мобільний тариф',
    walletName: 'Revolut',
    frequency: 'monthly',
    nextDueDate: '2026-10-10',
    reminderMinutesBefore: 1440,
    isActive: true,
  },
  {
    id: 'rec-3',
    title: 'Місячний абонемент у спортзал CityFit',
    amount: 159,
    type: 'expense',
    category: 'Здоровʼя та спорт',
    subcategory: 'Спортзал',
    walletName: 'Картка PKO BP',
    frequency: 'monthly',
    nextDueDate: '2026-10-15',
    reminderMinutesBefore: 720,
    isActive: true,
  },
];

export const INITIAL_SHIFT_TEMPLATES: WorkShiftTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Денна зміна 8 год (29 zł/год) — PKO BP',
    project: 'Основний проєкт',
    taskDescription: 'Стандартна денна зміна згідно з графіком',
    startTime: '08:00',
    endTime: '16:30',
    breakMinutes: 30,
    hourlyRate: 29,
    walletName: 'Картка PKO BP',
  },
  {
    id: 'tpl-2',
    name: 'Подовжена зміна 10 год (29 zł/год) — PKO BP',
    project: 'Основний проєкт',
    taskDescription: 'Зміна з двома понаднормовими годинами',
    startTime: '08:00',
    endTime: '18:30',
    breakMinutes: 30,
    hourlyRate: 29,
    walletName: 'Картка PKO BP',
  },
  {
    id: 'tpl-3',
    name: 'Зміна Millennium 8 год (29 zł/год)',
    project: 'Проєкт Millennium',
    taskDescription: 'Робоча зміна з нарахуванням на картку Millennium',
    startTime: '08:00',
    endTime: '16:30',
    breakMinutes: 30,
    hourlyRate: 29,
    walletName: 'Картка Millennium',
  },
  {
    id: 'tpl-4',
    name: 'Суботня зміна 6 год (32 zł/год)',
    project: 'Додаткове замовлення',
    taskDescription: 'Робота у вихідний день за підвищеним тарифом',
    startTime: '09:00',
    endTime: '15:30',
    breakMinutes: 30,
    hourlyRate: 32,
    walletName: 'Revolut',
  },
];

export const INITIAL_TRANSACTIONS: TransactionItem[] = [
  {
    id: 'tx-100',
    date: '2026-09-01',
    category: 'Заробітна плата',
    subcategory: 'Аванс',
    description: 'Зарахування авансу на картку',
    amount: 2500,
    type: 'income',
    paymentMethod: 'Картка PKO BP',
    linkedWorkMonth: '2026-09',
  },
  {
    id: 'tx-101',
    date: '2026-09-02',
    category: 'Житло та оренда',
    subcategory: 'Оренда квартири',
    description: 'Оренда житла та комунальні платежі за вересень',
    amount: 2250,
    type: 'expense',
    expensePriority: 'need',
    paymentMethod: 'Картка PKO BP',
  },
  {
    id: 'tx-102',
    date: '2026-09-05',
    category: 'Продукти та супермаркети',
    subcategory: 'Базові продукти',
    description: 'Тижневий кошик продуктів у Biedronka',
    amount: 340,
    type: 'expense',
    expensePriority: 'need',
    paymentMethod: 'Картка PKO BP',
  },
  {
    id: 'tx-103',
    date: '2026-09-08',
    category: 'Авто та транспорт',
    subcategory: 'Паливо',
    description: 'Заправка Orlen 95 (30 л)',
    amount: 195,
    type: 'expense',
    expensePriority: 'need',
    paymentMethod: 'Revolut',
  },
  {
    id: 'tx-104',
    date: '2026-09-11',
    category: 'Підписки та звʼязок',
    subcategory: 'Мобільний тариф',
    description: 'Домашній інтернет, мобільний тариф та хмарні сервіси',
    amount: 135,
    type: 'expense',
    expensePriority: 'could',
    paymentMethod: 'Revolut',
  },
  {
    id: 'tx-105',
    date: '2026-09-14',
    category: 'Переказ між рахунками',
    subcategory: 'Поповнення картки',
    description: 'Переказ коштів з PKO BP на Revolut',
    amount: 500,
    type: 'transfer',
    paymentMethod: 'Картка PKO BP',
    toWalletName: 'Revolut',
    toAmount: 500,
  },
  {
    id: 'tx-106',
    date: '2026-09-18',
    category: 'Продукти та супермаркети',
    subcategory: 'Мʼясо та риба',
    description: 'Закупівля свіжих овочів, мʼяса та продуктів',
    amount: 390,
    type: 'expense',
    expensePriority: 'need',
    paymentMethod: 'Готівка (PLN)',
  },
  {
    id: 'tx-107',
    date: '2026-09-22',
    category: 'Здоровʼя та спорт',
    subcategory: 'Спортзал',
    description: 'Місячний абонемент у спортзал',
    amount: 159,
    type: 'expense',
    expensePriority: 'could',
    paymentMethod: 'Картка PKO BP',
  },
  {
    id: 'tx-108',
    date: '2026-09-26',
    category: 'Продукти та супермаркети',
    subcategory: 'Алкоголь',
    description: 'Напої та продукти до вихідних',
    amount: 145,
    type: 'expense',
    expensePriority: 'want',
    paymentMethod: 'Картка PKO BP',
  },
  {
    id: 'tx-120',
    date: '2026-10-01',
    category: 'Заробітна плата',
    subcategory: 'Аванс',
    description: 'Аванс за жовтень на картку PKO BP',
    amount: 2600,
    type: 'income',
    paymentMethod: 'Картка PKO BP',
    linkedWorkMonth: '2026-10',
  },
  {
    id: 'tx-121',
    date: '2026-10-02',
    category: 'Житло та оренда',
    subcategory: 'Оренда квартири',
    description: 'Оренда квартири та чинш за жовтень',
    amount: 2200,
    type: 'expense',
    expensePriority: 'need',
    paymentMethod: 'Картка PKO BP',
  },
  {
    id: 'tx-122',
    date: '2026-10-04',
    category: 'Продукти та супермаркети',
    subcategory: 'Базові продукти',
    description: 'Закупівля продуктів Biedronka',
    amount: 285,
    type: 'expense',
    expensePriority: 'need',
    paymentMethod: 'Картка PKO BP',
  },
  {
    id: 'tx-123',
    date: '2026-10-05',
    category: 'Кафе та ресторани',
    subcategory: 'Обіди на роботі',
    description: 'Бізнес-ланчі та кава',
    amount: 95,
    type: 'expense',
    expensePriority: 'could',
    paymentMethod: 'Revolut',
  },
  {
    id: 'tx-124',
    date: '2026-10-06',
    category: 'Авто та транспорт',
    subcategory: 'Паливо',
    description: 'Заправка авто Orlen',
    amount: 180,
    type: 'expense',
    expensePriority: 'need',
    paymentMethod: 'Картка Millennium',
  },
  {
    id: 'tx-125',
    date: '2026-10-08',
    category: 'Продукти та супермаркети',
    subcategory: 'Мʼясо та риба',
    merchant: 'Lidl',
    description: 'Закупівля свіжих продуктів у Lidl',
    amount: 165,
    type: 'expense',
    expensePriority: 'need',
    paymentMethod: 'Картка PKO BP',
  },
  {
    id: 'tx-126',
    date: '2026-10-09',
    category: 'Продукти та супермаркети',
    merchant: 'Biedronka',
    description: 'Великий чек супермаркет (розбито по підкатегоріях)',
    amount: 100,
    type: 'expense',
    expensePriority: 'need',
    paymentMethod: 'Картка PKO BP',
    splits: [
      { subcategory: 'Базові продукти', amount: 50 },
      { subcategory: 'Алкоголь', amount: 10 },
      { subcategory: 'Овочі та Фрукти', amount: 20 },
      { subcategory: 'Солодощі', amount: 10 },
      { subcategory: 'Снеки', amount: 10 },
    ],
  },
];

export const INITIAL_WORK_HOURS: WorkHourEntry[] = [
  // October 2026 (01.10.2026 - 31.10.2026) entries for PKO BP and Millennium
  {
    id: 'wh-301',
    date: '2026-10-02',
    project: 'Основний проєкт',
    taskDescription: 'Денна робоча зміна (PKO BP)',
    startTime: '08:00',
    endTime: '16:30',
    breakMinutes: 30,
    hoursWorked: 8.0,
    hourlyRate: 29,
    totalEarned: 232,
    status: 'logged',
    walletName: 'Картка PKO BP',
  },
  {
    id: 'wh-302',
    date: '2026-10-05',
    project: 'Основний проєкт',
    taskDescription: 'Денна робоча зміна (PKO BP)',
    startTime: '08:00',
    endTime: '16:30',
    breakMinutes: 30,
    hoursWorked: 8.0,
    hourlyRate: 29,
    totalEarned: 232,
    status: 'logged',
    walletName: 'Картка PKO BP',
  },
  {
    id: 'wh-303',
    date: '2026-10-07',
    project: 'Проєкт Millennium',
    taskDescription: 'Робоча зміна з нарахуванням на Millennium',
    startTime: '08:00',
    endTime: '16:30',
    breakMinutes: 30,
    hoursWorked: 8.0,
    hourlyRate: 29,
    totalEarned: 232,
    status: 'logged',
    walletName: 'Картка Millennium',
  },
  {
    id: 'wh-304',
    date: '2026-10-09',
    project: 'Проєкт Millennium',
    taskDescription: 'Робоча зміна з нарахуванням на Millennium',
    startTime: '08:00',
    endTime: '16:30',
    breakMinutes: 30,
    hoursWorked: 8.0,
    hourlyRate: 29,
    totalEarned: 232,
    status: 'logged',
    walletName: 'Картка Millennium',
  },
  {
    id: 'wh-305',
    date: '2026-10-12',
    project: 'Основний проєкт',
    taskDescription: 'Подовжена зміна 10 год (PKO BP)',
    startTime: '08:00',
    endTime: '18:30',
    breakMinutes: 30,
    hoursWorked: 10.0,
    hourlyRate: 29,
    totalEarned: 290,
    status: 'logged',
    walletName: 'Картка PKO BP',
  },
  {
    id: 'wh-306',
    date: '2026-10-14',
    project: 'Проєкт Millennium',
    taskDescription: 'Робоча зміна Millennium',
    startTime: '08:00',
    endTime: '16:30',
    breakMinutes: 30,
    hoursWorked: 8.0,
    hourlyRate: 29,
    totalEarned: 232,
    status: 'logged',
    walletName: 'Картка Millennium',
  },

  // September 2026 entries
  {
    id: 'wh-201',
    date: '2026-09-21',
    project: 'Основний проєкт',
    taskDescription: 'Денна зміна — виконання основних виробничих задач',
    startTime: '08:00',
    endTime: '16:30',
    breakMinutes: 30,
    hoursWorked: 8.0,
    hourlyRate: 29,
    totalEarned: 232,
    status: 'paid',
    walletName: 'Картка PKO BP',
  },
  {
    id: 'wh-202',
    date: '2026-09-22',
    project: 'Основний проєкт',
    taskDescription: 'Повна зміна + додаткова година роботи',
    startTime: '08:00',
    endTime: '17:30',
    breakMinutes: 30,
    hoursWorked: 9.0,
    hourlyRate: 29,
    totalEarned: 261,
    status: 'paid',
    walletName: 'Картка PKO BP',
  },
  {
    id: 'wh-203',
    date: '2026-09-23',
    project: 'Основний проєкт',
    taskDescription: 'Робоча зміна згідно з графіком',
    startTime: '09:00',
    endTime: '17:30',
    breakMinutes: 30,
    hoursWorked: 8.0,
    hourlyRate: 29,
    totalEarned: 232,
    status: 'paid',
    walletName: 'Картка PKO BP',
  },
  {
    id: 'wh-204',
    date: '2026-09-25',
    project: 'Додаткове замовлення',
    taskDescription: 'Суботній вихід та підготовка звітності',
    startTime: '09:00',
    endTime: '15:30',
    breakMinutes: 30,
    hoursWorked: 6.0,
    hourlyRate: 32,
    totalEarned: 192,
    status: 'paid',
    walletName: 'Revolut',
  },
  {
    id: 'wh-205',
    date: '2026-09-28',
    project: 'Основний проєкт',
    taskDescription: 'Понеділкова зміна',
    startTime: '08:00',
    endTime: '16:30',
    breakMinutes: 30,
    hoursWorked: 8.0,
    hourlyRate: 29,
    totalEarned: 232,
    status: 'paid',
    walletName: 'Картка PKO BP',
  },
];
