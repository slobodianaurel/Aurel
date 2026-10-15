import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  BudgetCategory,
  RecurringPayment,
  SpreadsheetFileInfo,
  SpreadsheetMetadataInfo,
  TransactionItem,
  WorkHourEntry,
} from '../types/finance';

// Workspace OAuth scopes configured for the application
export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.events',
];

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'consent',
});

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory ONLY (never in localStorage or sessionStorage).
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Не вдалося отримати токен доступу Google OAuth.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    const code = error?.code || '';
    const message = error?.message || '';
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      message.includes('popup-closed-by-user') ||
      message.includes('cancelled-popup-request')
    ) {
      // User closed the popup window without completing authentication
      return null;
    }
    if (code === 'auth/popup-blocked') {
      throw new Error(
        'Спливаюче вікно авторизації заблоковано браузером. Будь ласка, дозвольте спливаючі вікна для цього сайту.'
      );
    }
    if (code === 'auth/unauthorized-domain') {
      throw new Error(
        'Поточний домен додатку не додано до списку дозволених у Google OAuth/Firebase. Будь ласка, підтвердіть підключення в системному вікні OAuth.'
      );
    }
    if (code === 'auth/operation-not-allowed') {
      throw new Error(
        'Авторизацію Google не активовано в системі. Необхідно підтвердити підключення Google Workspace.'
      );
    }
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const logout = async (): Promise<void> => {
  await auth.signOut();
  cachedAccessToken = null;
};

// Default logical tab names for structured finance & work hour storage
export const DEFAULT_TABS = {
  EXPENSES: 'Expenses',
  BUDGETS: 'Budgets',
  WORK_HOURS: 'WorkHours',
} as const;

async function requireToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }
  return token;
}

/**
 * Encodes UTF-8 string to Base64URL for Gmail API RFC 2822 raw messages
 */
function encodeBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sends a budget threshold/limit alert email via Gmail API
 */
export async function sendBudgetAlertEmail(params: {
  recipientEmail: string;
  categoryName: string;
  spentAmount: number;
  limitAmount: number;
  thresholdPercent: number;
  currencySymbol: string;
  monthLabel: string;
}): Promise<void> {
  const token = await requireToken();
  const usedPct =
    params.limitAmount > 0
      ? ((params.spentAmount / params.limitAmount) * 100).toFixed(1)
      : '100.0';
  const isOver = params.spentAmount > params.limitAmount;

  const subjectText = isOver
    ? `[FinPulse] Перевищено ліміт бюджету: ${params.categoryName} (${usedPct}%)`
    : `[FinPulse] Досягнуто поріг уваги бюджету: ${params.categoryName} (${usedPct}%)`;

  const encodedSubject = `=?UTF-8?B?${btoa(
    String.fromCharCode(...new TextEncoder().encode(subjectText))
  )}?=`;

  const bodyLines = [
    `Вітаємо!`,
    ``,
    `Сповіщення системи контролю бюджетів FinPulse за період ${params.monthLabel}:`,
    ``,
    `• Категорія: ${params.categoryName}`,
    `• Встановлений ліміт: ${params.limitAmount.toLocaleString('uk-UA')} ${params.currencySymbol}`,
    `• Фактичні витрати: ${params.spentAmount.toLocaleString('uk-UA')} ${params.currencySymbol} (${usedPct}%)`,
    `• Поріг сповіщення: ${params.thresholdPercent}%`,
    `• Залишок бюджету: ${(params.limitAmount - params.spentAmount).toLocaleString('uk-UA')} ${params.currencySymbol}`,
    ``,
    isOver
      ? `УВАГА: Витрати за цією категорією перевищили встановлений місячний ліміт.`
      : `УВАГА: Витрати досягли або перевищили поріг попередження (${params.thresholdPercent}%).`,
  ];

  const mimeMessage = [
    `To: ${params.recipientEmail}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    bodyLines.join('\r\n'),
  ].join('\r\n');

  const raw = encodeBase64Url(mimeMessage);

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Помилка надсилання email через Gmail API (${res.status}): ${errText}`);
  }
}

export interface MonthlyReportEmailParams {
  recipientEmail: string;
  monthLabel: string;
  periodDates: string;
  totalIncome: number;
  totalExpenses: number;
  cashFlow: number;
  currencySymbol: string;
  walletWorkHours: { walletName: string; hours: number; earned: number }[];
  categories: {
    name: string;
    planned: number;
    spent: number;
    diff: number;
  }[];
  priorities: {
    needTotal: number;
    couldTotal: number;
    wantTotal: number;
  };
}

/**
 * Sends comprehensive monthly financial report email via Gmail API
 */
export async function sendMonthlySummaryReportEmail(
  params: MonthlyReportEmailParams
): Promise<void> {
  const token = await requireToken();
  const subjectText = `[FinPulse] Місячний рапорт за ${params.monthLabel} (${params.periodDates})`;

  const encodedSubject = `=?UTF-8?B?${btoa(
    String.fromCharCode(...new TextEncoder().encode(subjectText))
  )}?=`;

  const walletLines =
    params.walletWorkHours.length > 0
      ? params.walletWorkHours.map(
          (w) =>
            `   • ${w.walletName}: ${w.hours.toFixed(1)} год (${w.earned.toLocaleString('uk-UA')} ${params.currencySymbol})`
        )
      : ['   • Немає зафіксованих годин за період'];

  const categoryTableLines = params.categories.map((c) => {
    const plannedStr = `${c.planned.toLocaleString('uk-UA')} ${params.currencySymbol}`;
    const spentStr = `${c.spent.toLocaleString('uk-UA')} ${params.currencySymbol}`;
    const diffSign = c.diff >= 0 ? '+' : '';
    const diffStr = `${diffSign}${c.diff.toLocaleString('uk-UA')} ${params.currencySymbol}`;
    return `• ${c.name}: Заплановано: ${plannedStr} | Витрачено: ${spentStr} | Різниця: ${diffStr}`;
  });

  const bodyLines = [
    `Доброго дня!`,
    ``,
    `Автоматичний фінансовий рапорт системи FinPulse за період ${params.monthLabel} (${params.periodDates}):`,
    ``,
    `══════════════════════════════════════════════════════════════`,
    `1. ГРОШОВИЙ ПОТІК ЗА МІСЯЦЬ`,
    `══════════════════════════════════════════════════════════════`,
    `• Доходи:      +${params.totalIncome.toLocaleString('uk-UA')} ${params.currencySymbol}`,
    `• Витрати:     -${params.totalExpenses.toLocaleString('uk-UA')} ${params.currencySymbol}`,
    `• Чистий потік (Дохід − Витрати): ${params.cashFlow >= 0 ? '+' : ''}${params.cashFlow.toLocaleString('uk-UA')} ${params.currencySymbol}`,
    ``,
    `══════════════════════════════════════════════════════════════`,
    `2. ВІДПРАЦЬОВАНО ГОДИН ПО ГАМАНЦЯХ`,
    `══════════════════════════════════════════════════════════════`,
    ...walletLines,
    ``,
    `══════════════════════════════════════════════════════════════`,
    `3. ТАБЛИЧКА ВИТРАТ ПО КАТЕГОРІЯХ (Заплановано | Витрачено | Різниця)`,
    `══════════════════════════════════════════════════════════════`,
    ...categoryTableLines,
    ``,
    `══════════════════════════════════════════════════════════════`,
    `4. СУМА ВИТРАТ ПО ПРІОРИТЕТАХ`,
    `══════════════════════════════════════════════════════════════`,
    `• 🔴 Потрібно (Обовʼязкові витрати): ${params.priorities.needTotal.toLocaleString('uk-UA')} ${params.currencySymbol}`,
    `• 🟡 Можу (Комфорт та плани):         ${params.priorities.couldTotal.toLocaleString('uk-UA')} ${params.currencySymbol}`,
    `• 🟢 Хочу (Бажання та розваги):       ${params.priorities.wantTotal.toLocaleString('uk-UA')} ${params.currencySymbol}`,
    ``,
    `З повагою,`,
    `Система FinPulse`,
  ];

  const mimeMessage = [
    `To: ${params.recipientEmail}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    bodyLines.join('\r\n'),
  ].join('\r\n');

  const raw = encodeBase64Url(mimeMessage);

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Помилка надсилання місячного рапорту через Gmail API (${res.status}): ${errText}`);
  }
}

/**
 * Creates or updates a recurring payment event in the user's primary Google Calendar with reminders
 */
export async function syncRecurringPaymentToCalendar(
  payment: RecurringPayment,
  currencySymbol: string
): Promise<{ eventId: string; htmlLink?: string }> {
  const token = await requireToken();

  const freqMap: Record<RecurringPayment['frequency'], string> = {
    monthly: 'MONTHLY',
    weekly: 'WEEKLY',
    yearly: 'YEARLY',
  };

  // Compute end date (+1 day for all-day event in Google Calendar)
  const startDateObj = new Date(`${payment.nextDueDate}T09:00:00`);
  const endDateObj = new Date(startDateObj.getTime() + 60 * 60 * 1000); // 1 hour event at 09:00 local

  const timeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Warsaw';

  const eventPayload = {
    summary: `[FinPulse] Циклічний платіж: ${payment.title} (${payment.amount} ${currencySymbol})`,
    description: [
      `Циклічна транзакція в дашборді FinPulse:`,
      `• Назва: ${payment.title}`,
      `• Сума: ${payment.amount} ${currencySymbol}`,
      `• Категорія: ${payment.category}${payment.subcategory ? ` / ${payment.subcategory}` : ''}`,
      `• Гаманець: ${payment.walletName}${payment.toWalletName ? ` → ${payment.toWalletName}` : ''}`,
      `• Періодичність: ${payment.frequency}`,
      ``,
      `Підтвердіть проведення платежу в розділі «Транзакції → Циклічні платежі», щоб додати його до журналу витрат.`,
    ].join('\n'),
    start: {
      dateTime: `${payment.nextDueDate}T09:00:00`,
      timeZone,
    },
    end: {
      dateTime: `${payment.nextDueDate}T10:00:00`,
      timeZone,
    },
    recurrence: [`RRULE:FREQ=${freqMap[payment.frequency]}`],
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: payment.reminderMinutesBefore || 1440 },
        { method: 'email', minutes: payment.reminderMinutesBefore || 1440 },
      ],
    },
  };

  const existingId = payment.calendarEventId;
  const endpoint = existingId
    ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingId)}`
    : 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  const res = await fetch(endpoint, {
    method: existingId ? 'PUT' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(eventPayload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Помилка синхронізації з Google Calendar (${res.status}): ${errText}`
    );
  }

  const data = await res.json();
  return {
    eventId: data.id,
    htmlLink: data.htmlLink,
  };
}

/**
 * Lists Google Spreadsheets from the user's Google Drive
 */
export async function listUserSpreadsheets(): Promise<SpreadsheetFileInfo[]> {
  const token = await requireToken();
  const query = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
  );
  const fields = encodeURIComponent('files(id,name,modifiedTime,webViewLink)');
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=modifiedTime desc&pageSize=25`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Помилка отримання списку таблиць (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return (data.files || []) as SpreadsheetFileInfo[];
}

/**
 * Fetches spreadsheet metadata first to inspect actual sheet tab names
 */
export async function getSpreadsheetMetadata(
  spreadsheetId: string
): Promise<SpreadsheetMetadataInfo> {
  const token = await requireToken();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Не вдалося прочитати метадані таблиці (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const sheetTabs = (data.sheets || []).map((s: any) => ({
    sheetId: s.properties?.sheetId ?? 0,
    title: s.properties?.title ?? 'Untitled',
    rowCount: s.properties?.gridProperties?.rowCount ?? 1000,
    columnCount: s.properties?.gridProperties?.columnCount ?? 26,
  }));

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title || 'Google Таблиця',
    spreadsheetUrl:
      data.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
    sheetTabs,
  };
}

/**
 * Ensures the required tabs exist in the target spreadsheet.
 */
export async function ensureSheetTabsExist(
  spreadsheetId: string,
  requiredTabNames: string[] = [
    DEFAULT_TABS.EXPENSES,
    DEFAULT_TABS.BUDGETS,
    DEFAULT_TABS.WORK_HOURS,
  ]
): Promise<SpreadsheetMetadataInfo> {
  const token = await requireToken();
  const metadata = await getSpreadsheetMetadata(spreadsheetId);
  const existingTitles = new Set(metadata.sheetTabs.map((t) => t.title));

  const missingTabs = requiredTabNames.filter((name) => !existingTitles.has(name));
  if (missingTabs.length === 0) {
    return metadata;
  }

  const requests = missingTabs.map((title) => ({
    addSheet: {
      properties: {
        title,
        gridProperties: {
          rowCount: 500,
          columnCount: 12,
        },
      },
    },
  }));

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Не вдалося створити вкладки у таблиці (${res.status}): ${errText}`);
  }

  return getSpreadsheetMetadata(spreadsheetId);
}

/**
 * Creates a brand new Google Spreadsheet structured for FinPulse & WorkLog
 */
export async function createFinanceSpreadsheet(
  title: string = 'FinPulse — Особисті фінанси та Робочі години'
): Promise<SpreadsheetMetadataInfo> {
  const token = await requireToken();
  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        { properties: { title: DEFAULT_TABS.EXPENSES } },
        { properties: { title: DEFAULT_TABS.BUDGETS } },
        { properties: { title: DEFAULT_TABS.WORK_HOURS } },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Помилка створення Google Таблиці (${res.status}): ${errText}`);
  }

  const created = await res.json();
  return getSpreadsheetMetadata(created.spreadsheetId);
}

async function resolveSheetTabName(
  spreadsheetId: string,
  preferredTabName: string
): Promise<string> {
  const metadata = await getSpreadsheetMetadata(spreadsheetId);
  const matchingTab = metadata.sheetTabs.find(
    (t) => t.title.toLowerCase() === preferredTabName.toLowerCase()
  );
  if (matchingTab) {
    return matchingTab.title;
  }
  await ensureSheetTabsExist(spreadsheetId, [preferredTabName]);
  return preferredTabName;
}

/**
 * Reads expense/transaction rows from Google Sheets
 */
export async function readExpensesFromSheet(
  spreadsheetId: string,
  customTabName?: string
): Promise<TransactionItem[]> {
  const token = await requireToken();
  const tabName = await resolveSheetTabName(
    spreadsheetId,
    customTabName || DEFAULT_TABS.EXPENSES
  );
  const range = encodeURIComponent(`${tabName}!A2:I500`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Помилка читання витрат (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];

  return rows
    .filter((row) => row.length >= 4 && row[0])
    .map((row, index) => {
      const rawType = String(row[5] || 'expense').toLowerCase();
      const type: TransactionItem['type'] =
        rawType === 'income' || rawType === 'transfer' ? rawType : 'expense';
      return {
        id: row[0] || `tx-sheet-${index + 1}`,
        date: row[1] || new Date().toISOString().slice(0, 10),
        category: row[2] || 'Інше',
        description: row[3] || '',
        amount: parseFloat(String(row[4] || '0').replace(/[^\d.-]/g, '')) || 0,
        type,
        paymentMethod: row[6] || 'Картка PKO BP',
        subcategory: row[7] || undefined,
        toWalletName: row[8] || undefined,
      };
    });
}

/**
 * Writes full list of expense/transaction rows to Google Sheets
 */
export async function writeExpensesToSheet(
  spreadsheetId: string,
  expenses: TransactionItem[],
  customTabName?: string
): Promise<void> {
  const token = await requireToken();
  const tabName = await resolveSheetTabName(
    spreadsheetId,
    customTabName || DEFAULT_TABS.EXPENSES
  );

  const clearRange = encodeURIComponent(`${tabName}!A1:I500`);
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${clearRange}:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const values = [
    [
      'ID',
      'Дата',
      'Категорія',
      'Опис',
      'Сума',
      'Тип',
      'Гаманець',
      'Підкатегорія',
      'На гаманець (для переказу)',
    ],
    ...expenses.map((tx) => [
      tx.id,
      tx.date,
      tx.category,
      tx.description,
      tx.amount,
      tx.type,
      tx.paymentMethod,
      tx.subcategory || '',
      tx.toWalletName || '',
    ]),
  ];

  const updateRange = encodeURIComponent(`${tabName}!A1`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${updateRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Помилка запису витрат у таблицю (${res.status}): ${errText}`);
  }
}

/**
 * Appends a single expense row directly to Google Sheets
 */
export async function appendExpenseRowToSheet(
  spreadsheetId: string,
  expense: TransactionItem,
  customTabName?: string
): Promise<void> {
  const token = await requireToken();
  const tabName = await resolveSheetTabName(
    spreadsheetId,
    customTabName || DEFAULT_TABS.EXPENSES
  );

  const range = encodeURIComponent(`${tabName}!A:I`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [
          [
            expense.id,
            expense.date,
            expense.category,
            expense.description,
            expense.amount,
            expense.type,
            expense.paymentMethod,
            expense.subcategory || '',
            expense.toWalletName || '',
          ],
        ],
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Помилка додавання рядка витрат (${res.status}): ${errText}`);
  }
}

/**
 * Reads category budget rows from Google Sheets
 */
export async function readBudgetsFromSheet(
  spreadsheetId: string,
  customTabName?: string
): Promise<BudgetCategory[]> {
  const token = await requireToken();
  const tabName = await resolveSheetTabName(
    spreadsheetId,
    customTabName || DEFAULT_TABS.BUDGETS
  );
  const range = encodeURIComponent(`${tabName}!A2:F200`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Помилка читання бюджетів (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];

  return rows
    .filter((row) => row.length >= 3 && row[1])
    .map((row, index) => ({
      id: row[0] || `cat-sheet-${index + 1}`,
      name: row[1] || 'Категорія',
      monthlyLimit: parseFloat(String(row[2] || '0').replace(/[^\d.-]/g, '')) || 0,
      alertThresholdPercent:
        parseFloat(String(row[3] || '80').replace(/[^\d.-]/g, '')) || 80,
      notes: row[4] || '',
      subcategories: row[5]
        ? row[5]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    }));
}

/**
 * Writes category budget rows to Google Sheets
 */
export async function writeBudgetsToSheet(
  spreadsheetId: string,
  budgets: BudgetCategory[],
  customTabName?: string
): Promise<void> {
  const token = await requireToken();
  const tabName = await resolveSheetTabName(
    spreadsheetId,
    customTabName || DEFAULT_TABS.BUDGETS
  );

  const clearRange = encodeURIComponent(`${tabName}!A1:F200`);
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${clearRange}:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const values = [
    [
      'ID',
      'Категорія',
      'Місячний ліміт',
      'Поріг сповіщення (%)',
      'Примітки',
      'Підкатегорії',
    ],
    ...budgets.map((b) => [
      b.id,
      b.name,
      b.monthlyLimit,
      b.alertThresholdPercent,
      b.notes || '',
      (b.subcategories || []).join(', '),
    ]),
  ];

  const updateRange = encodeURIComponent(`${tabName}!A1`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${updateRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Помилка запису бюджетів у таблицю (${res.status}): ${errText}`);
  }
}

/**
 * Reads work hour entries from Google Sheets
 */
export async function readWorkHoursFromSheet(
  spreadsheetId: string,
  customTabName?: string
): Promise<WorkHourEntry[]> {
  const token = await requireToken();
  const tabName = await resolveSheetTabName(
    spreadsheetId,
    customTabName || DEFAULT_TABS.WORK_HOURS
  );
  const range = encodeURIComponent(`${tabName}!A2:L500`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Помилка читання робочих годин (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];

  return rows
    .filter((row) => row.length >= 5 && row[0])
    .map((row, index) => {
      const hoursWorked =
        parseFloat(String(row[7] || '0').replace(/[^\d.-]/g, '')) || 0;
      const hourlyRate =
        parseFloat(String(row[8] || '0').replace(/[^\d.-]/g, '')) || 0;
      const totalEarned =
        parseFloat(String(row[9] || '0').replace(/[^\d.-]/g, '')) ||
        Math.round(hoursWorked * hourlyRate * 100) / 100;
      const rawStatus = String(row[10] || 'logged').toLowerCase();
      const status: WorkHourEntry['status'] =
        rawStatus === 'paid' || rawStatus === 'invoiced' ? rawStatus : 'logged';

      return {
        id: row[0] || `wh-sheet-${index + 1}`,
        date: row[1] || new Date().toISOString().slice(0, 10),
        project: row[2] || 'Основний проєкт',
        taskDescription: row[3] || '',
        startTime: row[4] || '08:00',
        endTime: row[5] || '16:30',
        breakMinutes: parseInt(String(row[6] || '0'), 10) || 0,
        hoursWorked,
        hourlyRate,
        totalEarned,
        status,
        walletName: row[11] || 'Картка PKO BP',
      };
    });
}

/**
 * Writes work hour entries to Google Sheets
 */
export async function writeWorkHoursToSheet(
  spreadsheetId: string,
  workLogs: WorkHourEntry[],
  customTabName?: string
): Promise<void> {
  const token = await requireToken();
  const tabName = await resolveSheetTabName(
    spreadsheetId,
    customTabName || DEFAULT_TABS.WORK_HOURS
  );

  const clearRange = encodeURIComponent(`${tabName}!A1:L500`);
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${clearRange}:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const values = [
    [
      'ID',
      'Дата',
      'Проєкт',
      'Опис задачі',
      'Початок',
      'Завершення',
      'Перерва (хв)',
      'Відпрацьовано (год)',
      'Ставка',
      'Нараховано',
      'Статус',
      'Гаманець зарахування',
    ],
    ...workLogs.map((w) => [
      w.id,
      w.date,
      w.project,
      w.taskDescription,
      w.startTime,
      w.endTime,
      w.breakMinutes,
      w.hoursWorked,
      w.hourlyRate,
      w.totalEarned,
      w.status,
      w.walletName || '',
    ]),
  ];

  const updateRange = encodeURIComponent(`${tabName}!A1`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${updateRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Помилка запису робочих годин у таблицю (${res.status}): ${errText}`);
  }
}

/**
 * Appends a single work hour entry row directly to Google Sheets
 */
export async function appendWorkHourRowToSheet(
  spreadsheetId: string,
  entry: WorkHourEntry,
  customTabName?: string
): Promise<void> {
  const token = await requireToken();
  const tabName = await resolveSheetTabName(
    spreadsheetId,
    customTabName || DEFAULT_TABS.WORK_HOURS
  );

  const range = encodeURIComponent(`${tabName}!A:L`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [
          [
            entry.id,
            entry.date,
            entry.project,
            entry.taskDescription,
            entry.startTime,
            entry.endTime,
            entry.breakMinutes,
            entry.hoursWorked,
            entry.hourlyRate,
            entry.totalEarned,
            entry.status,
            entry.walletName || '',
          ],
        ],
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Помилка додавання запису робочих годин (${res.status}): ${errText}`);
  }
}

/**
 * Synchronizes all dashboard data (Expenses, Budgets, WorkHours) to the selected Google Spreadsheet
 */
export async function syncAllDashboardDataToSheet(
  spreadsheetId: string,
  payload: {
    expenses: TransactionItem[];
    budgets: BudgetCategory[];
    workLogs: WorkHourEntry[];
  },
  tabNames?: {
    expensesTab?: string;
    budgetsTab?: string;
    workHoursTab?: string;
  }
): Promise<SpreadsheetMetadataInfo> {
  const expTab = tabNames?.expensesTab || DEFAULT_TABS.EXPENSES;
  const budTab = tabNames?.budgetsTab || DEFAULT_TABS.BUDGETS;
  const whTab = tabNames?.workHoursTab || DEFAULT_TABS.WORK_HOURS;

  await ensureSheetTabsExist(spreadsheetId, [expTab, budTab, whTab]);
  await Promise.all([
    writeExpensesToSheet(spreadsheetId, payload.expenses, expTab),
    writeBudgetsToSheet(spreadsheetId, payload.budgets, budTab),
    writeWorkHoursToSheet(spreadsheetId, payload.workLogs, whTab),
  ]);

  return getSpreadsheetMetadata(spreadsheetId);
}

/**
 * Loads all dashboard data (Expenses, Budgets, WorkHours) from the selected Google Spreadsheet
 */
export async function loadAllDashboardDataFromSheet(
  spreadsheetId: string,
  tabNames?: {
    expensesTab?: string;
    budgetsTab?: string;
    workHoursTab?: string;
  }
): Promise<{
  metadata: SpreadsheetMetadataInfo;
  expenses: TransactionItem[];
  budgets: BudgetCategory[];
  workLogs: WorkHourEntry[];
}> {
  const expTab = tabNames?.expensesTab || DEFAULT_TABS.EXPENSES;
  const budTab = tabNames?.budgetsTab || DEFAULT_TABS.BUDGETS;
  const whTab = tabNames?.workHoursTab || DEFAULT_TABS.WORK_HOURS;

  const metadata = await ensureSheetTabsExist(spreadsheetId, [expTab, budTab, whTab]);
  const [expenses, budgets, workLogs] = await Promise.all([
    readExpensesFromSheet(spreadsheetId, expTab),
    readBudgetsFromSheet(spreadsheetId, budTab),
    readWorkHoursFromSheet(spreadsheetId, whTab),
  ]);

  return {
    metadata,
    expenses,
    budgets,
    workLogs,
  };
}
