import {
  BudgetCategory,
  TransactionItem,
  WalletItem,
  WorkHourEntry,
} from '../types/finance';

function escapeCsvCell(value: string | number | undefined | null): string {
  const str = String(value ?? '');
  if (
    str.includes(',') ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes(';')
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function triggerCsvDownload(
  filename: string,
  rows: (string | number)[][]
): void {
  const csvBody = rows
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');
  const blob = new Blob(['\uFEFF' + csvBody], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Simple RFC-4180 compatible CSV line parser supporting quoted fields
 */
export function parseCsvText(csvText: string): string[][] {
  const clean = csvText.replace(/^\uFEFF/, '').trim();
  if (!clean) return [];
  const lines = clean.split(/\r?\n/);
  return lines
    .map((line) => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if ((ch === ',' || ch === ';') && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      result.push(current.trim());
      return result;
    })
    .filter((row) => row.some((cell) => cell.length > 0));
}

export function exportWalletsToCsv(wallets: WalletItem[]): void {
  const headers = [
    'ID',
    'Назва гаманця',
    'Тип',
    'Початковий баланс',
    'Код валюти',
    'Символ валюти',
    'Піктограма',
    'Колір',
  ];
  const rows = wallets.map((w) => [
    w.id,
    w.name,
    w.type,
    w.initialBalance.toFixed(2),
    w.currencyCode,
    w.currencySymbol,
    w.icon,
    w.color,
  ]);
  const dateStamp = new Date().toISOString().slice(0, 10);
  triggerCsvDownload(`finpulse-wallets-${dateStamp}.csv`, [headers, ...rows]);
}

export function parseImportedWalletsCsv(csvText: string): WalletItem[] {
  const rows = parseCsvText(csvText);
  if (rows.length <= 1) return [];
  const dataRows = rows.slice(1);
  return dataRows
    .filter((r) => r.length >= 2 && r[1])
    .map((r, idx) => {
      const rawType = (r[2] || 'card').toLowerCase();
      const type: WalletItem['type'] =
        rawType === 'cash' || rawType === 'bank' || rawType === 'crypto'
          ? rawType
          : 'card';
      return {
        id: r[0] || `wal-imp-${Date.now()}-${idx}`,
        name: r[1],
        type,
        initialBalance:
          parseFloat(String(r[3] || '0').replace(/[^\d.-]/g, '')) || 0,
        currencyCode: r[4] || 'PLN',
        currencySymbol: r[5] || 'zł',
        icon: r[6] || '💳',
        color: r[7] || '#0f172a',
      };
    });
}

export function exportTransactionsToCsv(
  transactions: TransactionItem[],
  currencyCode: string = 'PLN'
): void {
  const headers = [
    'ID',
    'Дата',
    'Категорія',
    'Підкатегорія',
    'Опис операції',
    `Сума (${currencyCode})`,
    'Тип операції',
    'Гаманець',
    'Цільовий гаманець (для переказу)',
    'Привʼязка до місяця годин',
  ];
  const typeLabelMap: Record<TransactionItem['type'], string> = {
    expense: 'Витрата',
    income: 'Дохід',
    transfer: 'Переказ',
  };
  const rows = transactions.map((tx) => [
    tx.id,
    tx.date,
    tx.category,
    tx.subcategory || '',
    tx.description,
    tx.amount.toFixed(2),
    typeLabelMap[tx.type] || tx.type,
    tx.paymentMethod,
    tx.toWalletName || '',
    tx.linkedWorkMonth || '',
  ]);
  const dateStamp = new Date().toISOString().slice(0, 10);
  triggerCsvDownload(`finpulse-transactions-${dateStamp}.csv`, [
    headers,
    ...rows,
  ]);
}

export function parseImportedTransactionsCsv(
  csvText: string,
  defaultWalletName: string = 'Картка PKO BP'
): TransactionItem[] {
  const rows = parseCsvText(csvText);
  if (rows.length <= 1) return [];
  const dataRows = rows.slice(1);
  return dataRows
    .filter((r) => r.length >= 4)
    .map((r, idx) => {
      // Support both 7-column and 9/10-column formats
      const hasSubcategory = r.length >= 8;
      const date = r[1] || new Date().toISOString().slice(0, 10);
      const category = r[2] || 'Інше';
      const subcategory = hasSubcategory ? r[3] || undefined : undefined;
      const description = hasSubcategory ? r[4] || '' : r[3] || '';
      const rawAmount = hasSubcategory ? r[5] : r[4];
      const rawType = String(
        (hasSubcategory ? r[6] : r[5]) || 'expense'
      ).toLowerCase();
      const paymentMethod =
        (hasSubcategory ? r[7] : r[6]) || defaultWalletName;
      const toWalletName = hasSubcategory ? r[8] || undefined : undefined;
      const linkedWorkMonth = r.length >= 10 ? r[9] || undefined : undefined;

      let type: TransactionItem['type'] = 'expense';
      if (rawType.includes('дохід') || rawType === 'income') {
        type = 'income';
      } else if (rawType.includes('переказ') || rawType === 'transfer') {
        type = 'transfer';
      }

      return {
        id: r[0] || `tx-imp-${Date.now()}-${idx}`,
        date,
        category,
        subcategory,
        description: description || `${category} — імпортовано з CSV`,
        amount:
          parseFloat(String(rawAmount || '0').replace(/[^\d.-]/g, '')) || 0,
        type,
        paymentMethod,
        toWalletName,
        linkedWorkMonth,
      };
    })
    .filter((tx) => tx.amount > 0);
}

export function exportBudgetsReportToCsv(
  budgets: BudgetCategory[],
  transactions: TransactionItem[],
  currencyCode: string = 'PLN',
  monthKey?: string
): void {
  const headers = [
    'ID категорії',
    'Категорія',
    'Підкатегорії',
    `Місячний ліміт (${currencyCode})`,
    `Фактичні витрати (${currencyCode})`,
    `Залишок бюджету (${currencyCode})`,
    'Використано (%)',
    'Статус бюджету',
    'Примітки',
  ];

  const rows = budgets.map((b) => {
    const limit =
      (monthKey && b.monthlyLimitsByMonth?.[monthKey] !== undefined
        ? b.monthlyLimitsByMonth[monthKey]
        : b.monthlyLimit) || 0;
    const spent = transactions
      .filter(
        (t) =>
          t.type === 'expense' &&
          t.category === b.name &&
          (!monthKey || t.date.startsWith(monthKey))
      )
      .reduce((sum, t) => sum + t.amount, 0);
    const remaining = limit - spent;
    const pct = limit > 0 ? (spent / limit) * 100 : 0;
    const status =
      pct > 100
        ? 'Перевищено ліміт'
        : pct >= b.alertThresholdPercent
        ? 'Наближення до ліміту'
        : 'У межах норми';

    return [
      b.id,
      b.name,
      (b.subcategories || []).join('; '),
      limit.toFixed(2),
      spent.toFixed(2),
      remaining.toFixed(2),
      pct.toFixed(1),
      status,
      b.notes || '',
    ];
  });

  const dateStamp = monthKey || new Date().toISOString().slice(0, 10);
  triggerCsvDownload(`finpulse-budgets-${dateStamp}.csv`, [headers, ...rows]);
}

export function exportWorkHoursToCsv(
  workLogs: WorkHourEntry[],
  currencyCode: string = 'PLN'
): void {
  const headers = [
    'ID',
    'Дата',
    'Проєкт',
    'Опис задачі',
    'Початок',
    'Завершення',
    'Перерва (хв)',
    'Відпрацьовано (год)',
    `Погодинна ставка (${currencyCode}/год)`,
    `Нараховано (${currencyCode})`,
    'Статус оплати',
    'Гаманець зарахування',
  ];

  const statusMap: Record<WorkHourEntry['status'], string> = {
    paid: 'Оплачено',
    invoiced: 'Виставлено рахунок',
    logged: 'Зафіксовано',
  };

  const rows = workLogs.map((w) => [
    w.id,
    w.date,
    w.project,
    w.taskDescription,
    w.startTime,
    w.endTime,
    w.breakMinutes,
    w.hoursWorked.toFixed(2),
    w.hourlyRate.toFixed(2),
    w.totalEarned.toFixed(2),
    statusMap[w.status] || w.status,
    w.walletName || '',
  ]);

  const dateStamp = new Date().toISOString().slice(0, 10);
  triggerCsvDownload(`finpulse-work-hours-${dateStamp}.csv`, [headers, ...rows]);
}

export function exportFullCombinedCsvReport(
  transactions: TransactionItem[],
  budgets: BudgetCategory[],
  workLogs: WorkHourEntry[],
  currencyCode: string = 'PLN'
): void {
  const totalExpenses = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalBudget = budgets.reduce((sum, b) => sum + b.monthlyLimit, 0);
  const totalHours = workLogs.reduce((sum, w) => sum + w.hoursWorked, 0);
  const totalEarned = workLogs.reduce((sum, w) => sum + w.totalEarned, 0);

  const rows: (string | number)[][] = [
    ['ЗВЕДЕНИЙ ФІНАНСОВИЙ ТА РОБОЧИЙ ЗВІТ FINPULSE'],
    ['Дата формування', new Date().toISOString().slice(0, 10)],
    ['Основна валюта', currencyCode],
    [`Загальний бюджет за категоріями (${currencyCode})`, totalBudget.toFixed(2)],
    [`Загальні витрати (${currencyCode})`, totalExpenses.toFixed(2)],
    [`Загальні доходи за транзакціями (${currencyCode})`, totalIncome.toFixed(2)],
    [`Залишок бюджету (${currencyCode})`, (totalBudget - totalExpenses).toFixed(2)],
    ['Відпрацьовано годин усього', totalHours.toFixed(2)],
    [`Нарахований дохід за годинами (${currencyCode})`, totalEarned.toFixed(2)],
    [],
    ['1. КОНТРОЛЬ БЮДЖЕТУ ЗА КАТЕГОРІЯМИ'],
    [
      'Категорія',
      'Підкатегорії',
      `Ліміт (${currencyCode})`,
      `Витрачено (${currencyCode})`,
      `Залишок (${currencyCode})`,
      'Використано (%)',
      'Статус',
    ],
    ...budgets.map((b) => {
      const spent = transactions
        .filter((t) => t.type === 'expense' && t.category === b.name)
        .reduce((sum, t) => sum + t.amount, 0);
      const pct = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;
      const status =
        pct > 100
          ? 'Перевищено ліміт'
          : pct >= b.alertThresholdPercent
          ? 'Увага: близько до ліміту'
          : 'Норма';
      return [
        b.name,
        (b.subcategories || []).join('; '),
        b.monthlyLimit.toFixed(2),
        spent.toFixed(2),
        (b.monthlyLimit - spent).toFixed(2),
        pct.toFixed(1),
        status,
      ];
    }),
    [],
    ['2. ДЕТАЛІЗАЦІЯ ТРАНЗАКЦІЙ (ВИТРАТИ, ДОХОДИ, ПЕРЕКАЗИ)'],
    [
      'ID',
      'Дата',
      'Тип',
      'Категорія',
      'Підкатегорія',
      'Опис',
      `Сума (${currencyCode})`,
      'Гаманець',
      'На гаманець',
    ],
    ...transactions.map((t) => [
      t.id,
      t.date,
      t.type,
      t.category,
      t.subcategory || '',
      t.description,
      t.amount.toFixed(2),
      t.paymentMethod,
      t.toWalletName || '',
    ]),
    [],
    ['3. ОБЛІК РОБОЧИХ ГОДИН ТА НАРАХУВАНЬ'],
    [
      'ID',
      'Дата',
      'Проєкт',
      'Задача',
      'Час',
      'Перерва (хв)',
      'Години',
      `Ставка (${currencyCode}/год)`,
      `Сума (${currencyCode})`,
      'Статус',
      'Гаманець',
    ],
    ...workLogs.map((w) => [
      w.id,
      w.date,
      w.project,
      w.taskDescription,
      `${w.startTime}-${w.endTime}`,
      w.breakMinutes,
      w.hoursWorked.toFixed(2),
      w.hourlyRate.toFixed(2),
      w.totalEarned.toFixed(2),
      w.status,
      w.walletName || '',
    ]),
  ];

  const dateStamp = new Date().toISOString().slice(0, 10);
  triggerCsvDownload(`finpulse-full-report-${dateStamp}.csv`, rows);
}
