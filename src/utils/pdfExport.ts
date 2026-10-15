import { jsPDF } from 'jspdf';
import {
  BudgetCategory,
  TransactionItem,
  WalletItem,
  WorkHourEntry,
} from '../types/finance';
import { getCategoryLimitForMonth, formatMonthName } from '../components/BudgetControlSection';

export interface PdfReportData {
  month: string; // e.g. "2026-10"
  currencySymbol: string;
  currencyCode: string;
  transactions: TransactionItem[];
  budgets: BudgetCategory[];
  wallets: WalletItem[];
  workLogs: WorkHourEntry[];
  monthlyBudgets: Record<string, Record<string, number>>;
}

/**
 * Generates and downloads a multi-section financial PDF report for the given month.
 * Uses a high-resolution Canvas renderer to ensure full Cyrillic (Ukrainian) typography support,
 * crisp table layouts, status badges, and professional financial formatting.
 */
export async function exportFinancialReportToPdf(data: PdfReportData): Promise<void> {
  const {
    month,
    currencySymbol,
    currencyCode,
    transactions,
    budgets,
    wallets,
    workLogs,
    monthlyBudgets,
  } = data;

  const monthTx = transactions.filter((t) => t.date.startsWith(month));
  const totalExpenses = monthTx
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = monthTx
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const cashFlow = totalIncome - totalExpenses;

  const monthLogs = workLogs.filter((w) => w.date.startsWith(month));
  const totalHours = monthLogs.reduce((sum, w) => sum + w.hoursWorked, 0);
  const totalEarned = monthLogs.reduce((sum, w) => sum + w.totalEarned, 0);

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

  // Category breakdown
  const categorySummary = budgets.map((b) => {
    const limit = getCategoryLimitForMonth(b, month, monthlyBudgets);
    const spent = monthTx
      .filter((t) => t.type === 'expense' && t.category === b.name)
      .reduce((sum, t) => sum + t.amount, 0);
    const remaining = limit - spent;
    const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
    return { name: b.name, limit, spent, remaining, percent };
  });

  // A4 dimensions at 2x scale (standard 72 DPI A4 is 595 x 842 pt; 2x canvas = 1190 x 1684 px)
  const canvas = document.createElement('canvas');
  const width = 1190;
  const height = 1684;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Не вдалося ініціалізувати графічний контекст PDF.');
  }

  // 1. Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Header Decorative Accent Bar
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, 14);

  // 2. Header Title and Subtitle
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 36px "Plus Jakarta Sans", -apple-system, sans-serif';
  ctx.fillText('FinPulse — Фінансовий Звіт', 60, 70);

  ctx.fillStyle = '#64748b';
  ctx.font = '500 18px "Plus Jakarta Sans", -apple-system, sans-serif';
  const monthName = formatMonthName(month);
  const formattedDate = new Date().toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  ctx.fillText(`Період: ${monthName} (${month})  •  Згенеровано: ${formattedDate}`, 60, 102);

  // Top separator
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(60, 124);
  ctx.lineTo(width - 60, 124);
  ctx.stroke();

  // 3. KPI Cards Grid (4 boxes)
  const kpiY = 145;
  const kpiWidth = (width - 120 - 36) / 4;
  const kpiHeight = 100;

  const kpiData = [
    {
      title: 'Доходи',
      value: `+${totalIncome.toLocaleString('uk-UA')} ${currencySymbol}`,
      color: '#059669',
      bgColor: '#ecfdf5',
      borderColor: '#a7f3d0',
    },
    {
      title: 'Витрати',
      value: `-${totalExpenses.toLocaleString('uk-UA')} ${currencySymbol}`,
      color: '#dc2626',
      bgColor: '#fef2f2',
      borderColor: '#fecaca',
    },
    {
      title: 'Чистий потік',
      value: `${cashFlow >= 0 ? '+' : ''}${cashFlow.toLocaleString('uk-UA')} ${currencySymbol}`,
      color: cashFlow >= 0 ? '#0284c7' : '#dc2626',
      bgColor: cashFlow >= 0 ? '#f0f9ff' : '#fef2f2',
      borderColor: cashFlow >= 0 ? '#bae6fd' : '#fecaca',
    },
    {
      title: 'Години роботи',
      value: `${totalHours.toFixed(1)} год (${totalEarned.toLocaleString('uk-UA')} ${currencySymbol})`,
      color: '#4f46e5',
      bgColor: '#eef2ff',
      borderColor: '#c7d2fe',
    },
  ];

  kpiData.forEach((kpi, idx) => {
    const x = 60 + idx * (kpiWidth + 12);
    // Card background
    ctx.fillStyle = kpi.bgColor;
    ctx.strokeStyle = kpi.borderColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, kpiY, kpiWidth, kpiHeight, 10);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#64748b';
    ctx.font = '600 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(kpi.title, x + 16, kpiY + 34);

    // Value
    ctx.fillStyle = kpi.color;
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.fillText(kpi.value, x + 16, kpiY + 72);
  });

  // 4. Section: Priorities Breakdown (Потрібно / Можу / Хочу)
  let currentY = 280;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('1. Розподіл витрат за пріоритетами', 60, currentY);

  currentY += 20;
  const prioBoxWidth = (width - 120 - 24) / 3;
  const prioHeight = 65;

  const prioritiesList = [
    {
      label: '🔴 Потрібно (Базові потреби)',
      amount: needTotal,
      percent: totalExpenses > 0 ? Math.round((needTotal / totalExpenses) * 100) : 0,
      color: '#b91c1c',
      bgColor: '#fef2f2',
    },
    {
      label: '🟡 Можу (Комфорт & Плани)',
      amount: couldTotal,
      percent: totalExpenses > 0 ? Math.round((couldTotal / totalExpenses) * 100) : 0,
      color: '#b45309',
      bgColor: '#fffbeb',
    },
    {
      label: '🟢 Хочу (Бажання & Розваги)',
      amount: wantTotal,
      percent: totalExpenses > 0 ? Math.round((wantTotal / totalExpenses) * 100) : 0,
      color: '#15803d',
      bgColor: '#f0fdf4',
    },
  ];

  prioritiesList.forEach((p, i) => {
    const x = 60 + i * (prioBoxWidth + 12);
    ctx.fillStyle = p.bgColor;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, currentY, prioBoxWidth, prioHeight, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#334155';
    ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(p.label, x + 14, currentY + 26);

    ctx.fillStyle = p.color;
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.fillText(
      `${p.amount.toLocaleString('uk-UA')} ${currencySymbol} (${p.percent}%)`,
      x + 14,
      currentY + 50
    );
  });

  // 5. Section: Category Budgets Table
  currentY += 105;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('2. Виконання бюджету за категоріями', 60, currentY);

  currentY += 18;

  // Table Header
  const tableX = 60;
  const tableWidth = width - 120;
  const rowHeight = 34;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(tableX, currentY, tableWidth, rowHeight);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(tableX, currentY, tableWidth, rowHeight);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Категорія', tableX + 16, currentY + 22);
  ctx.fillText('Ліміт', tableX + 380, currentY + 22);
  ctx.fillText('Витрачено', tableX + 560, currentY + 22);
  ctx.fillText('Залишок', tableX + 740, currentY + 22);
  ctx.fillText('Використання', tableX + 920, currentY + 22);

  currentY += rowHeight;

  // Table Rows (top categories up to 10)
  const rowsToDisplay = categorySummary.slice(0, 10);
  rowsToDisplay.forEach((cat, index) => {
    // Alternating zebra fill
    if (index % 2 === 1) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(tableX, currentY, tableWidth, rowHeight);
    }

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.8;
    ctx.strokeRect(tableX, currentY, tableWidth, rowHeight);

    // Name
    ctx.fillStyle = '#0f172a';
    ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(cat.name, tableX + 16, currentY + 22);

    // Limit
    ctx.fillStyle = '#334155';
    ctx.font = '500 13px "JetBrains Mono", monospace';
    ctx.fillText(`${cat.limit.toLocaleString('uk-UA')} ${currencySymbol}`, tableX + 380, currentY + 22);

    // Spent
    ctx.fillStyle = cat.spent > cat.limit && cat.limit > 0 ? '#dc2626' : '#0f172a';
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillText(`${cat.spent.toLocaleString('uk-UA')} ${currencySymbol}`, tableX + 560, currentY + 22);

    // Remaining
    ctx.fillStyle = cat.remaining < 0 ? '#dc2626' : '#16a34a';
    ctx.font = '600 13px "JetBrains Mono", monospace';
    const sign = cat.remaining >= 0 ? '+' : '';
    ctx.fillText(`${sign}${cat.remaining.toLocaleString('uk-UA')} ${currencySymbol}`, tableX + 740, currentY + 22);

    // Percent pill
    const isOver = cat.percent > 100;
    ctx.fillStyle = isOver ? '#fee2e2' : cat.percent > 85 ? '#fef3c7' : '#dcfce7';
    ctx.strokeStyle = isOver ? '#fca5a5' : cat.percent > 85 ? '#fde68a' : '#86efac';
    ctx.beginPath();
    ctx.roundRect(tableX + 920, currentY + 7, 70, 20, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isOver ? '#991b1b' : cat.percent > 85 ? '#92400e' : '#166534';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.fillText(`${cat.percent}%`, tableX + 935, currentY + 21);

    currentY += rowHeight;
  });

  // 6. Section: Wallets Balances Strip
  currentY += 35;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('3. Поточні залишки на гаманцях та рахунках', 60, currentY);

  currentY += 18;
  const walBoxWidth = (width - 120 - 36) / 4;
  const walBoxHeight = 72;

  wallets.slice(0, 4).forEach((w, idx) => {
    const x = 60 + idx * (walBoxWidth + 12);
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, currentY, walBoxWidth, walBoxHeight, 8);
    ctx.fill();
    ctx.stroke();

    // Wallet Icon / Color marker
    ctx.fillStyle = w.color || '#3b82f6';
    ctx.beginPath();
    ctx.arc(x + 24, currentY + 36, 12, 0, 2 * Math.PI);
    ctx.fill();

    // Name
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(w.name.slice(0, 16), x + 46, currentY + 30);

    // Currency & Balance
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 14px "JetBrains Mono", monospace';
    ctx.fillText(`${w.initialBalance.toLocaleString('uk-UA')} ${w.currencySymbol}`, x + 46, currentY + 54);
  });

  // 7. Recent transactions sample (up to 6)
  currentY += walBoxHeight + 35;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('4. Останні операції за місяць', 60, currentY);

  currentY += 18;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(tableX, currentY, tableWidth, 30);
  ctx.strokeStyle = '#cbd5e1';
  ctx.strokeRect(tableX, currentY, tableWidth, 30);

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Дата', tableX + 16, currentY + 20);
  ctx.fillText('Опис', tableX + 160, currentY + 20);
  ctx.fillText('Категорія', tableX + 480, currentY + 20);
  ctx.fillText('Гаманець', tableX + 740, currentY + 20);
  ctx.fillText('Сума', tableX + 920, currentY + 20);

  currentY += 30;

  const sampleTx = monthTx.slice(0, 7);
  sampleTx.forEach((tx, idx) => {
    if (idx % 2 === 1) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(tableX, currentY, tableWidth, 28);
    }
    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(tableX, currentY, tableWidth, 28);

    ctx.fillStyle = '#64748b';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText(tx.date, tableX + 16, currentY + 19);

    ctx.fillStyle = '#0f172a';
    ctx.font = '500 12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(tx.description.slice(0, 36), tableX + 160, currentY + 19);

    ctx.fillStyle = '#475569';
    ctx.font = '12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(tx.category + (tx.subcategory ? ` / ${tx.subcategory}` : ''), tableX + 480, currentY + 19);

    ctx.fillStyle = '#64748b';
    ctx.font = '12px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(tx.paymentMethod, tableX + 740, currentY + 19);

    const isExpense = tx.type === 'expense';
    ctx.fillStyle = isExpense ? '#dc2626' : '#16a34a';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    ctx.fillText(`${isExpense ? '-' : '+'}${tx.amount.toLocaleString('uk-UA')} ${currencySymbol}`, tableX + 920, currentY + 19);

    currentY += 28;
  });

  // Footer bar
  ctx.fillStyle = '#64748b';
  ctx.font = '11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('Звіт сформовано автономною системою FinPulse. Дані збережено на локальному пристрої.', 60, height - 30);
  ctx.fillText(`Сторінка 1 з 1  •  ${currencyCode}`, width - 180, height - 30);

  // Convert canvas to image and add to jsPDF
  const imgData = canvas.toDataURL('image/png', 1.0);
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

  // Save PDF file
  pdf.save(`finpulse-report-${month}.pdf`);
}
