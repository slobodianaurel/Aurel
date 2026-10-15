import React from 'react';

/**
 * Safely evaluates a simple arithmetic expression string (e.g. "20+25+30", "100-30/2", "50*1.5").
 * Rounds result to at most 2 decimal places.
 */
export function evaluateMathExpression(raw: string): string {
  if (!raw) return '';
  // Clean whitespace and '='
  let expr = raw.replace(/=/g, '').trim();
  if (!expr) return '';
  // Replace comma with dot for decimals
  expr = expr.replace(/,/g, '.');

  // If already a single clean number, return it
  if (/^-?\d+(\.\d+)?$/.test(expr)) {
    return expr;
  }

  // Only allow valid math characters: numbers, +, -, *, /, (, ), ., whitespace
  if (!/^[\d+\-*/().\s]+$/.test(expr)) {
    return raw.replace(/=/g, '');
  }

  // Disallow trailing operators before evaluation
  if (/[+\-*/.]$/.test(expr.trim())) {
    return expr.trim();
  }

  try {
    const sanitized = expr.replace(/[^0-9+\-*/().]/g, '');
    // Evaluate arithmetic expression safely
    const fn = new Function(`'use strict'; return (${sanitized});`);
    const result = fn();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      const rounded = Math.round(result * 100) / 100;
      return String(rounded);
    }
  } catch {
    // invalid or incomplete expression
  }
  return raw.replace(/=/g, '');
}

interface MathAmountInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string | number;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export const MathAmountInput: React.FC<MathAmountInputProps> = ({
  value,
  onChange,
  className = '',
  placeholder = '0.00',
  onBlur,
  onKeyDown,
  ...rest
}) => {
  const strVal = value === undefined || value === null ? '' : String(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // If user typed '=', calculate immediately
    if (raw.includes('=')) {
      const computed = evaluateMathExpression(raw);
      onChange(computed);
    } else {
      onChange(raw);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === '=') {
      if (/[+\-*/]/.test(strVal)) {
        e.preventDefault();
        const computed = evaluateMathExpression(strVal);
        onChange(computed);
      }
    }
    onKeyDown?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (strVal && /[+\-*/]/.test(strVal)) {
      const computed = evaluateMathExpression(strVal);
      onChange(computed);
    }
    onBlur?.(e);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={strVal}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={`[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
      {...rest}
    />
  );
};
