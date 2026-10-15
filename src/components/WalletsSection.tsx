import React, { useState, useRef } from 'react';
import {
  PRESET_CURRENCIES,
  TransactionItem,
  WALLET_COLORS,
  WALLET_ICONS,
  WalletItem,
  WorkHourEntry,
} from '../types/finance';
import {
  exportTransactionsToCsv,
  exportWalletsToCsv,
  parseImportedTransactionsCsv,
  parseImportedWalletsCsv,
} from '../utils/csvExport';
import {
  Download,
  Upload,
  Trash2,
  Edit3,
  Check,
  History,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowLeftRight,
  Clock,
  Settings,
  Plus,
  X,
  Wallet,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatDateUa } from './TransactionsAndRecurringSection';

interface WalletsSectionProps {
  wallets: WalletItem[];
  transactions: TransactionItem[];
  workLogs: WorkHourEntry[];
  onAddWallet?: (wallet: Omit<WalletItem, 'id'>) => void;
  onUpdateWallet: (wallet: WalletItem, oldName?: string) => void;
  onDeleteWallet: (id: string) => void;
  onImportWallets: (imported: WalletItem[]) => void;
  onImportTransactions: (imported: TransactionItem[]) => void;
  onOpenSettings?: (tab?: 'general' | 'wallets' | 'categories' | 'google' | 'widgets' | 'currency') => void;
}

export const WALLET_TYPE_LABELS: Record<WalletItem['type'], string> = {
  card: 'Банківська картка',
  cash: 'Готівка',
  bank: 'Рахунок IBAN / ФОП',
  crypto: 'Цифровий / Мультивалютний',
};

export function computeWalletBalance(
  wallet: WalletItem,
  transactions: TransactionItem[],
  workLogs: WorkHourEntry[]
): {
  initial: number;
  expensesOut: number;
  incomesIn: number;
  transfersOut: number;
  transfersIn: number;
  workEarnedIn: number;
  currentBalance: number;
} {
  let expensesOut = 0;
  let incomesIn = 0;
  let transfersOut = 0;
  let transfersIn = 0;

  transactions.forEach((tx) => {
    if (tx.type === 'expense' && tx.paymentMethod === wallet.name) {
      expensesOut += tx.amount;
    } else if (tx.type === 'income' && tx.paymentMethod === wallet.name) {
      incomesIn += tx.amount;
    } else if (tx.type === 'transfer') {
      if (tx.paymentMethod === wallet.name) {
        transfersOut += tx.amount;
      }
      if (tx.toWalletName === wallet.name) {
        transfersIn += tx.toAmount !== undefined ? tx.toAmount : tx.amount;
      }
    }
  });

  // Work hours are projected until confirmed through an income transaction into the wallet
  const workEarnedIn = workLogs
    .filter((w) => w.walletName === wallet.name)
    .reduce((sum, w) => sum + w.totalEarned, 0);

  const currentBalance =
    wallet.initialBalance +
    incomesIn +
    transfersIn -
    expensesOut -
    transfersOut;

  return {
    initial: wallet.initialBalance,
    expensesOut,
    incomesIn,
    transfersOut,
    transfersIn,
    workEarnedIn,
    currentBalance,
  };
}

export const WalletsSection: React.FC<WalletsSectionProps> = ({
  wallets,
  transactions,
  workLogs,
  onAddWallet,
  onUpdateWallet,
  onDeleteWallet,
  onImportWallets,
  onImportTransactions,
  onOpenSettings,
}) => {
  const [selectedWalletId, setSelectedWalletId] = useState<string>(
    wallets[0]?.id || ''
  );

  // Inline Edit Wallet State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editBalance, setEditBalance] = useState('');
  const [editCurrencyCode, setEditCurrencyCode] = useState('PLN');
  const [editIcon, setEditIcon] = useState('💳');
  const [editColor, setEditColor] = useState('#0f172a');

  // Modal state for adding a new wallet
  const [isAddWalletModalOpen, setIsAddWalletModalOpen] = useState(false);
  const [newWalletName, setNewWalletName] = useState('');
  const [newWalletType, setNewWalletType] = useState<WalletItem['type']>('card');
  const [newWalletBalance, setNewWalletBalance] = useState('0');
  const [newWalletCurrency, setNewWalletCurrency] = useState('PLN');
  const [newWalletIcon, setNewWalletIcon] = useState('💳');
  const [newWalletColor, setNewWalletColor] = useState('#2563eb');

  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const walletCsvInputRef = useRef<HTMLInputElement | null>(null);
  const txCsvInputRef = useRef<HTMLInputElement | null>(null);

  const handleCreateWalletSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWalletName.trim() || !onAddWallet) return;
    const currObj = PRESET_CURRENCIES.find((c) => c.code === newWalletCurrency) || {
      code: newWalletCurrency,
      symbol: newWalletCurrency === 'USD' ? '$' : newWalletCurrency === 'EUR' ? '€' : newWalletCurrency === 'UAH' ? '₴' : 'zł',
      name: newWalletCurrency,
    };

    onAddWallet({
      name: newWalletName.trim(),
      type: newWalletType,
      initialBalance: parseFloat(newWalletBalance) || 0,
      currencyCode: currObj.code,
      currencySymbol: currObj.symbol,
      icon: newWalletIcon,
      color: newWalletColor,
    });

    setNewWalletName('');
    setNewWalletBalance('0');
    setIsAddWalletModalOpen(false);
  };

  const startEdit = (wallet: WalletItem) => {
    setEditingId(wallet.id);
    setEditName(wallet.name);
    setEditBalance(String(wallet.initialBalance));
    setEditCurrencyCode(wallet.currencyCode);
    setEditIcon(wallet.icon);
    setEditColor(wallet.color);
  };

  const saveEdit = (wallet: WalletItem) => {
    const bal = parseFloat(editBalance);
    const curr =
      PRESET_CURRENCIES.find((c) => c.code === editCurrencyCode) || {
        code: editCurrencyCode,
        symbol: editCurrencyCode,
      };

    if (editName.trim() && !isNaN(bal)) {
      onUpdateWallet(
        {
          ...wallet,
          name: editName.trim(),
          initialBalance: bal,
          currencyCode: curr.code,
          currencySymbol: curr.symbol,
          icon: editIcon || '💳',
          color: editColor || '#0f172a',
        },
        wallet.name
      );
    }
    setEditingId(null);
  };

  const handleImportWalletsChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseImportedWalletsCsv(String(reader.result || ''));
      if (parsed.length > 0) {
        onImportWallets(parsed);
        setImportMessage(`Успішно імпортовано ${parsed.length} гаманців.`);
        setTimeout(() => setImportMessage(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportTransactionsChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const activeWal = wallets.find((w) => w.id === selectedWalletId);
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseImportedTransactionsCsv(
        String(reader.result || ''),
        activeWal?.name || wallets[0]?.name || 'Картка PKO BP'
      );
      if (parsed.length > 0) {
        onImportTransactions(parsed);
        setImportMessage(
          `Успішно імпортовано ${parsed.length} транзакцій для гаманця.`
        );
        setTimeout(() => setImportMessage(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const activeWallet =
    wallets.find((w) => w.id === selectedWalletId) || wallets[0];

  const walletHistory = transactions
    .filter(
      (t) =>
        t.paymentMethod === activeWallet?.name ||
        t.toWalletName === activeWallet?.name
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const displayedHistory = isHistoryExpanded
    ? walletHistory
    : walletHistory.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Top Banner and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Гаманці та баланси рахунків
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Огляд рахунків, окремі валюти та повна історія транзакцій по кожному гаманцю.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onAddWallet && (
            <button
              type="button"
              onClick={() => {
                setNewWalletName('');
                setNewWalletBalance('0');
                setNewWalletType('card');
                setNewWalletCurrency('PLN');
                setNewWalletIcon('💳');
                setNewWalletColor('#2563eb');
                setIsAddWalletModalOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Додати новий гаманець</span>
            </button>
          )}
        </div>
      </div>

      {/* POPUP MODAL: ADD NEW WALLET */}
      {isAddWalletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-xl lg:max-w-2xl rounded-2xl bg-white p-6 sm:p-7 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                  <Wallet className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Створити новий гаманець
                  </h3>
                  <p className="text-xs text-slate-500">
                    Банківська картка, рахунок IBAN або готівка
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddWalletModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateWalletSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Назва рахунку / гаманця <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Напр. Santander, Revolut, Готівка PLN"
                  value={newWalletName}
                  onChange={(e) => setNewWalletName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Тип рахунку
                  </label>
                  <select
                    value={newWalletType}
                    onChange={(e) => setNewWalletType(e.target.value as WalletItem['type'])}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  >
                    <option value="card">💳 Банківська картка</option>
                    <option value="cash">💵 Готівка</option>
                    <option value="bank">🏦 IBAN / ФОП</option>
                    <option value="crypto">🪙 Мультивалютний</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Валюта гаманця
                  </label>
                  <select
                    value={newWalletCurrency}
                    onChange={(e) => setNewWalletCurrency(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  >
                    {PRESET_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Початковий баланс ({PRESET_CURRENCIES.find((c) => c.code === newWalletCurrency)?.symbol || 'zł'})
                </label>
                <input
                  type="number"
                  step="any"
                  value={newWalletBalance}
                  onChange={(e) => setNewWalletBalance(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 focus:border-slate-900 focus:outline-none"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Іконка гаманця
                </label>
                <div className="flex flex-wrap gap-2">
                  {WALLET_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setNewWalletIcon(ic)}
                      className={`h-9 w-9 rounded-lg text-lg flex items-center justify-center transition-transform ${
                        newWalletIcon === ic
                          ? 'bg-slate-900 text-white scale-110 shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200'
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
                <div className="flex flex-wrap gap-2">
                  {WALLET_COLORS.map((col) => (
                    <button
                      key={col.value}
                      type="button"
                      onClick={() => setNewWalletColor(col.value)}
                      className={`h-7 w-7 rounded-full transition-transform ${
                        newWalletColor === col.value
                          ? 'ring-2 ring-slate-900 ring-offset-2 scale-110'
                          : 'hover:opacity-80'
                      }`}
                      style={{ backgroundColor: col.value }}
                      title={col.label}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddWalletModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Скасувати
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
                >
                  <Plus className="h-4 w-4" />
                  <span>Створити гаманець</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-900">
          {importMessage}
        </div>
      )}

      {/* Wallets Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>Оберіть гаманець для перегляду історії ({wallets.length})</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {wallets.map((w) => {
            const stats = computeWalletBalance(w, transactions, workLogs);
            const isSelected = selectedWalletId === w.id;
            const isEditing = editingId === w.id;

            return (
              <div
                key={w.id}
                onClick={() => setSelectedWalletId(w.id)}
                className={`group relative rounded-xl border p-5 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-slate-900 bg-white shadow-md ring-1 ring-slate-900'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                {/* Header: Icon, Name, Type, Edit button */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl text-white shadow-xs"
                      style={{ backgroundColor: w.color }}
                    >
                      {w.icon}
                    </span>

                    <div className="min-w-0">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full rounded border border-slate-300 px-2 py-0.5 text-xs font-semibold"
                        />
                      ) : (
                        <h4 className="text-sm font-bold text-slate-900 truncate">
                          {w.name}
                        </h4>
                      )}

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                        <span>{WALLET_TYPE_LABELS[w.type]}</span>
                        <span>·</span>
                        <span className="font-bold text-slate-700">
                          {w.currencyCode} ({w.currencySymbol})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => saveEdit(w)}
                        className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                        title="Зберегти"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(w)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        title="Редагувати"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {wallets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteWallet(w.id)}
                        className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        title="Видалити"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Inline Editing Controls */}
                {isEditing && (
                  <div
                    className="mt-3 pt-3 border-t border-slate-100 space-y-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 font-medium">
                          Поч. баланс
                        </label>
                        <input
                          type="number"
                          step="any"
                          value={editBalance}
                          onChange={(e) => setEditBalance(e.target.value)}
                          className="w-full rounded border px-2 py-0.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 font-medium">
                          Валюта
                        </label>
                        <select
                          value={editCurrencyCode}
                          onChange={(e) => setEditCurrencyCode(e.target.value)}
                          className="w-full rounded border px-2 py-0.5 text-xs"
                        >
                          {PRESET_CURRENCIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.code} ({c.symbol})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 pt-1">
                      {WALLET_ICONS.slice(0, 6).map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setEditIcon(ic)}
                          className={`rounded p-1 text-sm ${
                            editIcon === ic ? 'bg-slate-200' : 'hover:bg-slate-100'
                          }`}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      {WALLET_COLORS.map((col) => (
                        <button
                          key={col.value}
                          type="button"
                          onClick={() => setEditColor(col.value)}
                          className={`h-4 w-4 rounded-full border ${
                            editColor === col.value
                              ? 'border-slate-900 scale-125'
                              : 'border-transparent'
                          }`}
                          style={{ backgroundColor: col.value }}
                          title={col.label}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Current Balance */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-500">Поточний баланс</div>
                  <div className="mt-0.5 font-mono text-xl font-bold text-slate-900 tabular-nums">
                    {stats.currentBalance.toLocaleString('uk-UA')} {w.currencySymbol}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                    <span className="text-emerald-700 font-medium">
                      +{stats.incomesIn + stats.transfersIn} {w.currencySymbol}
                    </span>
                    <span className="text-red-600 font-medium">
                      −{stats.expensesOut + stats.transfersOut} {w.currencySymbol}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected Wallet Transaction History (Full Width) */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        {activeWallet ? (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-xl text-white shadow-xs"
                  style={{ backgroundColor: activeWallet.color }}
                >
                  {activeWallet.icon}
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Історія транзакцій: {activeWallet.name}</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Валюта: {activeWallet.currencyCode} ({activeWallet.currencySymbol}) · Всього операцій: {walletHistory.length}
                  </p>
                </div>
              </div>

            </div>

            {walletHistory.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Поки немає операцій по гаманцю «{activeWallet.name}».
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-slate-100">
                    <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
                      <tr>
                        <th className="px-6 py-3">Дата</th>
                        <th className="px-6 py-3">Тип</th>
                        <th className="px-6 py-3">Категорія</th>
                        <th className="px-6 py-3">Опис операції</th>
                        <th className="px-6 py-3 font-mono text-right">Сума</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {displayedHistory.map((tx, idx) => {
                        const isTransferOut =
                          tx.type === 'transfer' && tx.paymentMethod === activeWallet.name;
                        const isTransferIn =
                          tx.type === 'transfer' && tx.toWalletName === activeWallet.name;

                        const prevTx = idx > 0 ? displayedHistory[idx - 1] : null;
                        const isNewDay = !prevTx || prevTx.date !== tx.date;

                        // Day metrics for this wallet
                        const dayTxs = walletHistory.filter((t) => t.date === tx.date);
                        const dayCount = dayTxs.length;
                        let daySpent = 0;
                        let dayReceived = 0;
                        dayTxs.forEach((t) => {
                          const tOut =
                            t.type === 'transfer' && t.paymentMethod === activeWallet.name;
                          const tIn =
                            t.type === 'transfer' && t.toWalletName === activeWallet.name;
                          if (t.type === 'expense' || tOut) {
                            daySpent += t.amount;
                          } else if (t.type === 'income') {
                            dayReceived += t.amount;
                          } else if (tIn) {
                            dayReceived +=
                              t.toAmount !== undefined ? t.toAmount : t.amount;
                          }
                        });

                        const displayAmt =
                          isTransferIn && tx.toAmount !== undefined
                            ? tx.toAmount
                            : tx.amount;

                        return (
                          <React.Fragment key={tx.id}>
                            {isNewDay && (
                              <tr className="bg-slate-100/90 border-t-2 border-b border-slate-300">
                                <td colSpan={5} className="px-6 py-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-100 text-indigo-700">
                                        <Calendar className="h-3 w-3" />
                                      </span>
                                      <span className="font-bold text-slate-800 text-xs">
                                        {formatDateUa(tx.date)}
                                      </span>
                                      <span className="text-[10px] text-slate-500 font-mono">
                                        ({dayCount}{' '}
                                        {dayCount === 1
                                          ? 'операція'
                                          : dayCount < 5
                                          ? 'операції'
                                          : 'операцій'}
                                        )
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-3 text-[11px] font-mono font-semibold">
                                      {daySpent > 0 && (
                                        <span className="text-red-700">
                                          Витрати за день: -{daySpent.toLocaleString('uk-UA')}{' '}
                                          {activeWallet.currencySymbol}
                                        </span>
                                      )}
                                      {dayReceived > 0 && (
                                        <span className="text-emerald-700">
                                          Надходження: +{dayReceived.toLocaleString('uk-UA')}{' '}
                                          {activeWallet.currencySymbol}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}

                            <tr className="hover:bg-slate-50/60 transition-colors">
                              <td className="px-6 py-3 font-mono text-slate-600 whitespace-nowrap text-[11px]">
                                {tx.date}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap">
                                {tx.type === 'expense' ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                                    <ArrowDownLeft className="h-3 w-3" />
                                    Списання
                                  </span>
                                ) : tx.type === 'income' ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                                    <ArrowUpRight className="h-3 w-3" />
                                    Зарахування
                                  </span>
                                ) : isTransferOut ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                    <ArrowLeftRight className="h-3 w-3" />
                                    Переказ на {tx.toWalletName}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                    <ArrowLeftRight className="h-3 w-3" />
                                    Отримано з {tx.paymentMethod}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-3">
                                <span className="font-medium text-slate-900">{tx.category}</span>
                                {tx.splits && tx.splits.length > 0 ? (
                                  <div className="text-[11px] text-slate-500 font-normal mt-0.5 space-y-0.5">
                                    {tx.splits.map((s, sIdx) => (
                                      <div key={sIdx} className="flex items-center gap-1">
                                        <span className="text-slate-400">└─</span>
                                        <span>{s.subcategory}</span>
                                        <span className="font-mono text-slate-600">
                                          ({s.amount.toLocaleString('uk-UA')}{' '}
                                          {activeWallet.currencySymbol})
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : tx.subcategory ? (
                                  <span className="text-slate-500 font-normal">
                                    {' '}
                                    · {tx.subcategory}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-6 py-3 text-slate-600">
                                {tx.merchant && (
                                  <span className="font-semibold text-slate-800 mr-1.5">
                                    [{tx.merchant}]
                                  </span>
                                )}
                                {tx.description || '—'}
                              </td>
                              <td className="px-6 py-3 font-mono font-bold text-right tabular-nums whitespace-nowrap">
                                <span
                                  className={
                                    tx.type === 'expense' || isTransferOut
                                      ? 'text-red-600'
                                      : 'text-emerald-700'
                                  }
                                >
                                  {tx.type === 'expense' || isTransferOut ? '−' : '+'}
                                  {displayAmt.toLocaleString('uk-UA')}{' '}
                                  {activeWallet.currencySymbol}
                                </span>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {walletHistory.length > 10 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-3 bg-slate-50 border-t border-slate-200">
                    <div className="text-xs text-slate-500 font-medium">
                      {isHistoryExpanded
                        ? `Відображено всі ${walletHistory.length} операцій`
                        : `Відображено останні 10 з ${walletHistory.length} операцій`}
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-2xs"
                    >
                      {isHistoryExpanded ? (
                        <>
                          <ChevronUp className="h-4 w-4 text-indigo-600" />
                          <span>Згорнути до 10 операцій</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 text-indigo-600" />
                          <span>
                            Показати всі операції (ще {walletHistory.length - 10})
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="p-8 text-center text-xs text-slate-500">
            Оберіть гаманець зі списку вище для перегляду операцій.
          </div>
        )}
      </div>
    </div>
  );
};
