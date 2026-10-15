import { TransactionItem, WalletItem } from '../types/finance';

/**
 * Standard exchange rates against PLN (1 unit of currency in PLN)
 * E.g.:
 * 1 UAH ≈ 0.0952 PLN (meaning 1 PLN ≈ 10.5 UAH)
 * 1 USD ≈ 4.00 PLN
 * 1 EUR ≈ 4.35 PLN
 * 1 GBP ≈ 5.10 PLN
 * 1 PLN = 1.0 PLN
 */
export const DEFAULT_RATES_TO_PLN: Record<string, number> = {
  PLN: 1.0,
  UAH: 0.0952, // 100 UAH ≈ 9.52 PLN
  USD: 4.0,
  EUR: 4.35,
  GBP: 5.1,
};

/**
 * Convert an amount from one currency to another using exchange rates.
 * customRates: optional map of currency code -> rate to PLN.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  customRates?: Record<string, number>
): number {
  if (!amount || isNaN(amount)) return 0;
  const from = (fromCurrency || 'PLN').toUpperCase().trim();
  const to = (toCurrency || 'PLN').toUpperCase().trim();

  if (from === to) return amount;

  const rates = { ...DEFAULT_RATES_TO_PLN, ...(customRates || {}) };

  const rateFrom = rates[from] ?? 1.0;
  const rateTo = rates[to] ?? 1.0;

  // Convert amount -> PLN -> target currency
  const amountInPln = amount * rateFrom;
  const result = rateTo > 0 ? amountInPln / rateTo : amountInPln;

  return Math.round(result * 100) / 100;
}

/**
 * Determine the currency code of a transaction:
 * 1) tx.currencyCode
 * 2) wallet currency matching tx.paymentMethod
 * 3) fallback fallbackCurrencyCode (e.g. settings.currency.code or 'PLN')
 */
export function getTransactionCurrencyCode(
  tx: TransactionItem,
  wallets: WalletItem[],
  fallbackCurrencyCode = 'PLN'
): string {
  if (tx.currencyCode) return tx.currencyCode.toUpperCase();
  if (tx.paymentMethod) {
    const w = wallets.find(
      (item) => item.name.toLowerCase() === tx.paymentMethod.toLowerCase()
    );
    if (w?.currencyCode) return w.currencyCode.toUpperCase();
  }
  return fallbackCurrencyCode.toUpperCase();
}

/**
 * Convert transaction amount to the target/base currency.
 */
export function getConvertedTransactionAmount(
  tx: TransactionItem,
  baseCurrencyCode: string,
  wallets: WalletItem[],
  customRates?: Record<string, number>
): number {
  const txCurrency = getTransactionCurrencyCode(tx, wallets, baseCurrencyCode);
  return convertCurrency(tx.amount, txCurrency, baseCurrencyCode, customRates);
}

/**
 * Convert a specific amount belonging to a transaction (e.g. split amount) to base currency.
 */
export function getConvertedAmount(
  amount: number,
  tx: TransactionItem,
  baseCurrencyCode: string,
  wallets: WalletItem[],
  customRates?: Record<string, number>
): number {
  const txCurrency = getTransactionCurrencyCode(tx, wallets, baseCurrencyCode);
  return convertCurrency(amount, txCurrency, baseCurrencyCode, customRates);
}
