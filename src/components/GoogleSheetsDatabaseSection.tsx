import React, { useState } from 'react';
import {
  BudgetCategory,
  SpreadsheetFileInfo,
  SpreadsheetMetadataInfo,
  TransactionItem,
  WorkHourEntry,
} from '../types/finance';
import { GoogleSignInButton } from './GoogleSignInButton';
import {
  Database,
  RefreshCw,
  UploadCloud,
  DownloadCloud,
  PlusCircle,
  ExternalLink,
  LogOut,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { User } from 'firebase/auth';

interface GoogleSheetsDatabaseSectionProps {
  user: User | null;
  needsAuth: boolean;
  isLoggingIn: boolean;
  spreadsheets: SpreadsheetFileInfo[];
  selectedSpreadsheetId: string;
  spreadsheetMetadata: SpreadsheetMetadataInfo | null;
  expensesTabName: string;
  budgetsTabName: string;
  workHoursTabName: string;
  isSyncing: boolean;
  syncStatusMessage: string | null;
  syncError: string | null;
  transactions: TransactionItem[];
  budgets: BudgetCategory[];
  workLogs: WorkHourEntry[];
  onLogin: () => void;
  onLogout: () => void;
  onRefreshSpreadsheets: () => void;
  onSelectSpreadsheet: (id: string) => void;
  onCreateNewSpreadsheet: (title: string) => void;
  onChangeTabNames: (tabs: {
    expensesTabName: string;
    budgetsTabName: string;
    workHoursTabName: string;
  }) => void;
  onRequestPushToSheets: () => void;
  onRequestPullFromSheets: () => void;
}

export const GoogleSheetsDatabaseSection: React.FC<
  GoogleSheetsDatabaseSectionProps
> = ({
  user,
  needsAuth,
  isLoggingIn,
  spreadsheets,
  selectedSpreadsheetId,
  spreadsheetMetadata,
  expensesTabName,
  budgetsTabName,
  workHoursTabName,
  isSyncing,
  syncStatusMessage,
  syncError,
  transactions,
  budgets,
  workLogs,
  onLogin,
  onLogout,
  onRefreshSpreadsheets,
  onSelectSpreadsheet,
  onCreateNewSpreadsheet,
  onChangeTabNames,
  onRequestPushToSheets,
  onRequestPullFromSheets,
}) => {
  const [newSheetTitle, setNewSheetTitle] = useState(
    'FinPulse — Особисті фінанси та Робочі години'
  );
  const [manualSpreadsheetId, setManualSpreadsheetId] = useState('');

  const handleManualConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSpreadsheetId.trim()) return;
    // Extract ID if full Google Sheets URL was pasted
    const match = manualSpreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    const cleanId = match ? match[1] : manualSpreadsheetId.trim();
    onSelectSpreadsheet(cleanId);
    setManualSpreadsheetId('');
  };

  return (
    <div className="space-y-6">
      {/* Connection Header Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                База даних Google Sheets
              </h2>
              <p className="mt-0.5 text-sm text-slate-600">
                Підключіть власну Google Таблицю для двосторонньої синхронізації витрат, категорій бюджету та робочих годин
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start">
            {needsAuth || !user ? (
              <GoogleSignInButton
                onClick={onLogin}
                disabled={isLoggingIn}
                label={isLoggingIn ? 'Підключення...' : 'Sign in with Google'}
              />
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs font-medium text-slate-900">
                    {user.displayName || user.email}
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    Сесія Google Sheets активна
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Вийти</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Status / Error Alerts */}
        {syncStatusMessage && (
          <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{syncStatusMessage}</span>
          </div>
        )}

        {syncError && (
          <div className="mt-4 flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50/70 px-4 py-3 text-xs text-red-900">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{syncError}</span>
          </div>
        )}

        {/* Unauthenticated State */}
        {needsAuth || !user ? (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="text-sm font-semibold text-slate-900">
              Авторизуйтесь через Google для роботи з хмарними таблицями
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 max-w-2xl">
              Після входу ви зможете обрати існуючу таблицю з вашого Google Drive або створити нову структуровану базу даних з вкладками{' '}
              <span className="font-mono">Expenses</span>,{' '}
              <span className="font-mono">Budgets</span> та{' '}
              <span className="font-mono">WorkHours</span>.
            </p>
            <div className="mt-4">
              <GoogleSignInButton
                onClick={onLogin}
                disabled={isLoggingIn}
                label="Sign in with Google"
              />
            </div>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Select or Create Spreadsheet */}
            <div className="lg:col-span-6 space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-slate-900">
                    1. Оберіть таблицю з вашого Google Drive
                  </label>
                  <button
                    type="button"
                    onClick={onRefreshSpreadsheets}
                    disabled={isSyncing}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Оновити список</span>
                  </button>
                </div>
                <select
                  value={selectedSpreadsheetId}
                  onChange={(e) => onSelectSpreadsheet(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                >
                  <option value="">— Оберіть файл Google Sheets —</option>
                  {spreadsheets.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Paste Spreadsheet URL or ID */}
              <form onSubmit={handleManualConnect} className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Або вставте посилання / ID існуючої Google Таблиці
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualSpreadsheetId}
                    onChange={(e) => setManualSpreadsheetId(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap"
                  >
                    Підключити
                  </button>
                </div>
              </form>

              {/* Create New Structured Spreadsheet */}
              <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-900 mb-2">
                  2. Або створіть нову таблицю-базу в один клік
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newSheetTitle}
                    onChange={(e) => setNewSheetTitle(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={isSyncing || !newSheetTitle.trim()}
                    onClick={() => onCreateNewSpreadsheet(newSheetTitle.trim())}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>Створити таблицю</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Active Spreadsheet Metadata & Sync Controls */}
            <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-slate-50/70 p-5 flex flex-col justify-between">
              {spreadsheetMetadata ? (
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-slate-500">Підключена таблиця</div>
                      <h3 className="mt-0.5 text-sm font-semibold text-slate-900">
                        {spreadsheetMetadata.title}
                      </h3>
                      <div className="mt-1 font-mono text-[11px] text-slate-500 break-all">
                        ID: {spreadsheetMetadata.spreadsheetId}
                      </div>
                    </div>
                    <a
                      href={spreadsheetMetadata.spreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
                    >
                      <span>Відкрити в Sheets</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  {/* Sheet Tabs Mapping (Dynamically discovered from metadata) */}
                  <div className="mt-4 pt-4 border-t border-slate-200/80">
                    <div className="text-xs font-medium text-slate-700 mb-2">
                      Вкладки таблиці (знайдено в метаданих:{' '}
                      {spreadsheetMetadata.sheetTabs.map((t) => t.title).join(' · ')})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          Вкладка витрат
                        </label>
                        <input
                          type="text"
                          value={expensesTabName}
                          onChange={(e) =>
                            onChangeTabNames({
                              expensesTabName: e.target.value,
                              budgetsTabName,
                              workHoursTabName,
                            })
                          }
                          className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          Вкладка бюджетів
                        </label>
                        <input
                          type="text"
                          value={budgetsTabName}
                          onChange={(e) =>
                            onChangeTabNames({
                              expensesTabName,
                              budgetsTabName: e.target.value,
                              workHoursTabName,
                            })
                          }
                          className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          Вкладка годин
                        </label>
                        <input
                          type="text"
                          value={workHoursTabName}
                          onChange={(e) =>
                            onChangeTabNames({
                              expensesTabName,
                              budgetsTabName,
                              workHoursTabName: e.target.value,
                            })
                          }
                          className="w-full rounded border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-900"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sync Actions */}
                  <div className="mt-5 pt-4 border-t border-slate-200/80 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={onRequestPushToSheets}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      <UploadCloud className="h-4 w-4" />
                      <span>
                        Записати дані дашборду в Google Sheets ({transactions.length}{' '}
                        витрат · {budgets.length} бюдж. · {workLogs.length} змін)
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={onRequestPullFromSheets}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      <DownloadCloud className="h-4 w-4" />
                      <span>Завантажити дані з таблиці</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                  <Database className="h-8 w-8 text-slate-400 mb-2" />
                  <div className="text-sm font-medium text-slate-800">
                    Таблицю ще не обрано
                  </div>
                  <p className="mt-1 text-xs text-slate-500 max-w-xs">
                    Оберіть існуючу таблицю зі списку ліворуч або натисніть «Створити таблицю», щоб автоматично розгорнути структуру в Google Sheets.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
