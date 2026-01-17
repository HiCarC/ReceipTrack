import React, { useEffect, useState } from 'react';

export default function AsyncCurrencyConversion({
  amount,
  currency,
  date,
  baseCurrency,
  convertToBaseCurrency,
  normalizeToLocalMidnight,
  formatCurrency,
}) {
  const [baseCurrencyEquivalent, setBaseCurrencyEquivalent] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadConversion = async () => {
      if (currency === baseCurrency) return;

      setIsLoading(true);
      try {
        const dateObj = normalizeToLocalMidnight(date);
        const equivalent = await convertToBaseCurrency(amount, currency, dateObj);
        setBaseCurrencyEquivalent(equivalent);
      } catch (error) {
        // Silently handle currency conversion errors
      } finally {
        setIsLoading(false);
      }
    };

    loadConversion();
  }, [amount, currency, date, baseCurrency, convertToBaseCurrency, normalizeToLocalMidnight]);

  if (isLoading) {
    return <span className="text-xs text-blue-300/80 ml-1">Converting...</span>;
  }

  if (baseCurrencyEquivalent) {
    return (
      <span className="text-xs text-blue-300/80 ml-1">
        ƒ%^ {formatCurrency(baseCurrencyEquivalent, baseCurrency)}
      </span>
    );
  }

  return null;
}
