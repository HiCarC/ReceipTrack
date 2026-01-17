import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, LineChart } from 'lucide-react';
import { Bar, Doughnut, Line } from 'react-chartjs-2';

export default function InsightsSection({
  receipts = [],
  categoryTotals = {},
  calculatedTotals = {},
  formatCurrency,
  settings,
  categoryColors = {},
  periodOverride,
  onPeriodChange,
  variant = 'light',
  hidePeriodSelect = false,
  showTitle = true,
  getBaseAmount,
}) {
  const [period, setPeriod] = useState(periodOverride || 'week');
  const [currentOffset, setCurrentOffset] = useState(0);
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonType, setComparisonType] = useState('category');
  const [comparisonCategoryA, setComparisonCategoryA] = useState('');
  const [comparisonCategoryB, setComparisonCategoryB] = useState('');
  const [comparisonPeriodA, setComparisonPeriodA] = useState('');
  const [comparisonPeriodB, setComparisonPeriodB] = useState('');
  const [comparisonPeriodOffset, setComparisonPeriodOffset] = useState(0);
  const isDark = variant === 'dark';
  const activePeriod = periodOverride || period;

  useEffect(() => {
    if (periodOverride && periodOverride !== period) {
      setPeriod(periodOverride);
      setCurrentOffset(0);
    }
  }, [periodOverride, period]);

  const setActivePeriod = (value) => {
    if (onPeriodChange) {
      onPeriodChange(value);
    }
    if (!periodOverride) {
      setPeriod(value);
    }
    setCurrentOffset(0);
  };

  // Helper to robustly normalize a date string/object to local midnight
  const normalizeToLocalMidnight = (d) => {
    if (!d) return null;
    if (typeof d.toDate === 'function') { d = d.toDate(); }
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [year, month, day] = d.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    const date = new Date(d);
    if (isNaN(date)) return null;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  };

  // Navigation functions
  const navigatePrevious = () => setCurrentOffset(prev => prev - 1);
  const navigateNext = () => setCurrentOffset(prev => prev + 1);
  const navigateToCurrent = () => setCurrentOffset(0);

  // --- Date helpers ---
  const today = new Date();
  let periodStart, periodEnd, periodLabel;
  const weekStartsOn = (settings?.weekStartsOn || 'monday').toLowerCase();
  
  if (activePeriod === 'week') {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + (currentOffset * 7));
    
    periodStart = new Date(targetDate);
    periodStart.setHours(0, 0, 0, 0);
    let dayOfWeek = targetDate.getDay();
    let offset = weekStartsOn === 'monday' ? (dayOfWeek === 0 ? -6 : 1 - dayOfWeek) : -dayOfWeek;
    periodStart.setDate(targetDate.getDate() + offset);
    periodEnd = new Date(periodStart);
    periodEnd.setDate(periodStart.getDate() + 6);
    periodEnd.setHours(23, 59, 59, 999);
    const formatShort = d => d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
    periodLabel = `${formatShort(periodStart)} - ${formatShort(periodEnd)}`.replace(/\b[a-z]/g, letter => letter.toUpperCase());
  } else if (activePeriod === 'month') {
    const targetDate = new Date(today.getFullYear(), today.getMonth() + currentOffset, 1);
    periodStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1, 0, 0, 0, 0);
    periodEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);
    const formatShort = d => d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
    periodLabel = `${formatShort(periodStart)} - ${formatShort(periodEnd)}`.replace(/\b[a-z]/g, letter => letter.toUpperCase());
  } else {
    const targetYear = today.getFullYear() + currentOffset;
    periodStart = new Date(targetYear, 0, 1, 0, 0, 0, 0);
    periodEnd = new Date(targetYear, 11, 31, 23, 59, 59, 999);
    periodLabel = targetYear.toString();
  }

  // Calculate period receipts with location data
  const periodReceipts = useMemo(() => {
    const filteredReceipts = receipts.filter(r => {
      const d = normalizeToLocalMidnight(r.transactionDate || r.date);
      return d && d >= periodStart && d <= periodEnd;
    });

    return filteredReceipts.map(r => {
      const date = normalizeToLocalMidnight(r.transactionDate || r.date);
      let totalBaseCurrency = parseFloat(r.total) || 0;
      
      if (date && r.currency !== (settings?.baseCurrency || 'EUR') && calculatedTotals.monthlyTotals) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthlyTotal = calculatedTotals.monthlyTotals[monthKey];
        if (monthlyTotal && monthlyTotal.total > 0) {
          const originalTotal = filteredReceipts
            .filter(r2 => {
              const d2 = normalizeToLocalMidnight(r2.transactionDate || r2.date);
              return d2 && d2.getMonth() === date.getMonth() && d2.getFullYear() === date.getFullYear();
            })
            .reduce((sum, r2) => sum + (parseFloat(r2.total) || 0), 0);
          
          if (originalTotal > 0) {
            totalBaseCurrency = (parseFloat(r.total) / originalTotal) * monthlyTotal.total;
          }
        }
      }
      
      return {
        ...r,
        totalBaseCurrency,
        subtotalBaseCurrency: r.subtotal ? parseFloat(r.subtotal) : 0,
        taxBaseCurrency: r.tax ? parseFloat(r.tax) : 0
      };
    });
  }, [receipts, periodStart, periodEnd, activePeriod, currentOffset, calculatedTotals, settings?.baseCurrency]);



  const allCategories = useMemo(() => {
    return Array.from(new Set(periodReceipts.map(r => r.category || 'Uncategorized')));
  }, [periodReceipts]);

  // Use the unified category colors
  const allCategoryColors = categoryColors;

  // --- Smart Data Structuring for Location-Based Analysis ---
  let dailyData, labelsWithDates;

  if (activePeriod === 'week') {
    let weekDays = [];
    if (weekStartsOn === 'monday') {
      weekDays = [1,2,3,4,5,6,0];
    } else {
      weekDays = [0,1,2,3,4,5,6];
    }
    const weekDates = weekDays.map((weekday, i) => {
      const d = new Date(periodStart);
      d.setDate(periodStart.getDate() + i);
      return d;
    });
    labelsWithDates = weekDates.map(d => ({
      short: d.toLocaleDateString(undefined, { weekday: 'short' })[0],
      full: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
    }));
    dailyData = weekDays.map(() => ({ categories: {}, locations: {}, total: 0 }));

    periodReceipts.forEach(r => {
      const date = normalizeToLocalMidnight(r.transactionDate || r.date);
      if (date) {
        const dayIndex = weekDates.findIndex(d => d.getTime() === date.getTime());
        if (dayIndex !== -1) {
          const category = r.category || 'Uncategorized';
          const amount = getBaseAmount ? getBaseAmount(r) : (r.totalBaseCurrency || parseFloat(r.total) || 0);
          const location = r.place?.display_name || r.addressParsed?.city || 'Unknown';
          
          dailyData[dayIndex].categories[category] = (dailyData[dayIndex].categories[category] || 0) + amount;
          dailyData[dayIndex].locations[location] = (dailyData[dayIndex].locations[location] || 0) + amount;
          dailyData[dayIndex].total += amount;
        }
      }
    });
  } else if (activePeriod === 'month') {
    const daysInMonth = periodEnd.getDate();
    labelsWithDates = Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(periodStart.getFullYear(), periodStart.getMonth(), i + 1);
      return {
        short: (i + 1).toString(),
        full: d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
      };
    });
    dailyData = Array.from({ length: daysInMonth }, () => ({ categories: {}, locations: {}, total: 0 }));

    periodReceipts.forEach(r => {
      const date = normalizeToLocalMidnight(r.date || r.transactionDate || r.createdAt);
      if (date) {
        const dayIndex = date.getDate() - 1;
        if (dayIndex >= 0 && dayIndex < daysInMonth) {
          const amount = getBaseAmount ? getBaseAmount(r) : (parseFloat(r.total) || 0);
          const category = r.category || 'Uncategorized';
          const location = r.place?.display_name || r.addressParsed?.city || 'Unknown';
          
          dailyData[dayIndex].categories[category] = (dailyData[dayIndex].categories[category] || 0) + amount;
          dailyData[dayIndex].locations[location] = (dailyData[dayIndex].locations[location] || 0) + amount;
          dailyData[dayIndex].total += amount;
        }
      }
    });
  } else {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const targetYear = today.getFullYear() + currentOffset;
    labelsWithDates = months.map((month, i) => ({
      short: month,
      full: `${month} ${targetYear}`
    }));
    dailyData = Array.from({ length: 12 }, () => ({ categories: {}, locations: {}, total: 0 }));

    periodReceipts.forEach(r => {
      const date = normalizeToLocalMidnight(r.transactionDate || r.date);
      if (date) {
        const monthIndex = date.getMonth();
        if (monthIndex >= 0 && monthIndex < 12) {
          const amount = getBaseAmount ? getBaseAmount(r) : (parseFloat(r.total) || 0);
          const category = r.category || 'Uncategorized';
          const location = r.place?.display_name || r.addressParsed?.city || 'Unknown';
          
          dailyData[monthIndex].categories[category] = (dailyData[monthIndex].categories[category] || 0) + amount;
          dailyData[monthIndex].locations[location] = (dailyData[monthIndex].locations[location] || 0) + amount;
          dailyData[monthIndex].total += amount;
        }
      }
    });
  }
  
  const chartTotals = dailyData.map(d => d.total);
  const expenses = chartTotals.reduce((a, b) => a + b, 0);
  const spentPerDay = activePeriod === 'week' ? expenses / 7 : 
                     activePeriod === 'month' ? (chartTotals.length > 0 ? expenses / chartTotals.length : 0) :
                     activePeriod === 'year' ? expenses / 365 : 0;
  
  // Calculate category and location totals
  const periodCategoryTotals = {};
  const periodLocationTotals = {};
  
  periodReceipts.forEach(receipt => {
    const amount = getBaseAmount ? getBaseAmount(receipt) : (parseFloat(receipt.total) || 0);
    const category = receipt.category || 'Uncategorized';
    const location = receipt.place?.display_name || receipt.addressParsed?.city || 'Unknown';
    
    periodCategoryTotals[category] = (periodCategoryTotals[category] || 0) + amount;
    periodLocationTotals[location] = (periodLocationTotals[location] || 0) + amount;
  });
  
  const total = expenses;

  // Calculate dynamic y-axis max value
  const maxValue = Math.max(...chartTotals);
  const yAxisMax = maxValue > 0 ? Math.ceil(maxValue * 1.2) : 100;

  // --- Smart Comparison Datasets ---
  let comparisonBarDatasets = null;
  if (showComparison) {
    if (comparisonType === 'category' && comparisonCategoryA && comparisonCategoryB) {
      // Category comparison: two datasets, one for each category
      const catData = [comparisonCategoryA, comparisonCategoryB].map((cat, idx) => {
        let data = labelsWithDates.map((_, i) => 0);
        periodReceipts.forEach(r => {
          if ((r.category || 'Uncategorized') === cat) {
            const date = normalizeToLocalMidnight(r.transactionDate || r.date);
            let idxDate = -1;
            if (activePeriod === 'week') {
              const weekDays = [1,2,3,4,5,6,0];
              const weekDates = weekDays.map((weekday, i) => { 
                const d = new Date(periodStart); 
                d.setDate(periodStart.getDate() + i); 
                return d; 
              });
              idxDate = weekDates.findIndex(d => d.getTime() === date.getTime());
            } else if (activePeriod === 'month') {
              idxDate = date.getDate() - 1;
            } else {
              idxDate = date.getMonth();
            }
            if (idxDate >= 0 && idxDate < data.length) {
              data[idxDate] += getBaseAmount ? getBaseAmount(r) : (parseFloat(r.total) || 0);
            }
          }
        });
        return {
          label: cat,
          data,
          backgroundColor: idx === 0 ? '#6366F1' : '#F59E42',
          borderRadius: 12,
          barPercentage: 0.6,
          categoryPercentage: 0.7,
          borderSkipped: false,
          stack: undefined,
        };
      });
      comparisonBarDatasets = catData;
    } else if (comparisonType === 'period' && comparisonPeriodA && comparisonPeriodB) {
      const buildRangeData = (startDate) => {
        const start = normalizeToLocalMidnight(startDate);
        if (!start) return [];
        let dates = [];
        if (activePeriod === 'week') {
          dates = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            return d;
          });
        } else if (activePeriod === 'month') {
          const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
          const days = end.getDate();
          dates = Array.from({ length: days }, (_, i) => new Date(start.getFullYear(), start.getMonth(), i + 1));
        } else {
          dates = Array.from({ length: 12 }, (_, i) => new Date(start.getFullYear(), i, 1));
        }
        const data = dates.map(() => 0);
        receipts.forEach(r => {
          const date = normalizeToLocalMidnight(r.transactionDate || r.date);
          if (!date) return;
          let idx = -1;
          if (activePeriod === 'year') {
            if (date.getFullYear() !== start.getFullYear()) return;
            idx = date.getMonth();
          } else {
            idx = dates.findIndex(d => d.getTime() === date.getTime());
          }
          if (idx >= 0 && idx < data.length) {
            data[idx] += getBaseAmount ? getBaseAmount(r) : (parseFloat(r.total) || 0);
          }
        });
        return data;
      };

      comparisonBarDatasets = [
        {
          label: `Period A`,
          data: buildRangeData(comparisonPeriodA),
          backgroundColor: '#6366F1',
          borderRadius: 12,
          barPercentage: 0.6,
          categoryPercentage: 0.7,
          borderSkipped: false,
          stack: undefined,
        },
        {
          label: `Period B`,
          data: buildRangeData(comparisonPeriodB),
          backgroundColor: '#F59E42',
          borderRadius: 12,
          barPercentage: 0.6,
          categoryPercentage: 0.7,
          borderSkipped: false,
          stack: undefined,
        }
      ];
    }
  }

  // Get all unique categories from the period
  const allCategoriesFromPeriod = [...new Set(Object.keys(periodCategoryTotals))];
  
  const barDatasets = useMemo(() => (
    comparisonBarDatasets || allCategoriesFromPeriod.map(category => {
      const categoryData = dailyData.map(dayData => dayData.categories[category] || 0);
      return {
        label: category,
        data: categoryData,
        backgroundColor: allCategoryColors[category] || '#9ca3af',
        borderRadius: 12,
        barPercentage: 0.6,
        categoryPercentage: 0.7,
        borderSkipped: false,
        stack: 'stack0',
      };
    })
  ), [comparisonBarDatasets, allCategoriesFromPeriod, dailyData, allCategoryColors]);

  const barData = useMemo(() => ({
    labels: labelsWithDates.map(l => l.short),
    datasets: barDatasets,
  }), [labelsWithDates, barDatasets]);

  const barOptions = useMemo(() => ({
    plugins: {
      legend: { display: false },
      decimation: {
        enabled: true,
        algorithm: 'min-max',
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: '#1e293b',
        titleColor: '#f1f5f9',
        titleFont: { size: 14, weight: 'bold' },
        bodyColor: '#cbd5e1',
        bodyFont: { size: 12 },
        borderColor: 'rgba(99,102,241,0.5)',
        borderWidth: 1,
        displayColors: false,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          title: function(context) {
            if (!context[0]) return '';
            return labelsWithDates[context[0].dataIndex].full;
          },
          label: () => null,
          beforeBody: function(context) {
            const dataIndex = context[0].dataIndex;
            const dayData = dailyData[dataIndex];
            const sortedCategories = Object.entries(dayData.categories).sort((a, b) => b[1] - a[1]);
            if (sortedCategories.length === 0) return ['No expenses this day.'];
            return sortedCategories.map(([name, amount]) => `${name}: ${formatCurrency(amount, settings?.baseCurrency || 'EUR')}`);
          },
          footer: function(context) {
            const totalAmount = context[0].raw;
            if (totalAmount > 0) {
              return `\nTotal: ${formatCurrency(totalAmount, settings?.baseCurrency || 'EUR')}`;
            }
            return '';
          },
        },
      },
      annotation: {
        annotations: {
          averageLine: {
            type: 'line',
            yMin: spentPerDay,
            yMax: spentPerDay,
            borderColor: 'rgba(120,120,120,0.7)',
            borderWidth: 2,
            borderDash: [6, 6],
            label: {
              display: true,
              content: 'Average',
              color: '#888',
              backgroundColor: 'transparent',
              font: { weight: 'bold', size: 10 },
              position: 'right',
              padding: 0,
            },
            z: 10,
          },
        },
      },
    },
    scales: {
      x: {
        grid: { drawBorder: false, color: 'rgba(226, 232, 240, 0.1)' },
        ticks: { color: '#94a3b8', font: { weight: '600' } },
      },
      y: {
        grid: { drawBorder: false, color: 'rgba(226, 232, 240, 0.1)' },
        beginAtZero: true,
        max: yAxisMax,
        ticks: {
          color: '#94a3b8',
          callback: function(value) {
            return formatCurrency(Math.round(value), settings?.baseCurrency || 'EUR');
          },
          stepSize: maxValue > 1000 ? Math.ceil(maxValue / 5) :
                   maxValue > 100 ? Math.ceil(maxValue / 4) :
                   maxValue > 10 ? Math.ceil(maxValue / 3) : 1
        },
      },
    },
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    normalized: true,
  }), [dailyData, formatCurrency, labelsWithDates, maxValue, settings?.baseCurrency, spentPerDay, yAxisMax]);
  
  const currencyTotalsByCategory = useMemo(() => {
    const totals = {};
    periodReceipts.forEach(r => {
      const cat = r.category || 'Uncategorized';
      const currency = r.currency || settings?.baseCurrency || 'EUR';
      if (!totals[cat]) totals[cat] = {};
      totals[cat][currency] = (totals[cat][currency] || 0) + (parseFloat(r.total) || 0);
    });
    return totals;
  }, [periodReceipts, settings?.baseCurrency]);

  const legend = useMemo(() => (
    Object.keys(periodCategoryTotals).map((cat) => {
      const percent = total ? ((periodCategoryTotals[cat] / total) * 100).toFixed(1) : 0;
      return { name: cat, color: allCategoryColors[cat] || '#9ca3af', percent };
    })
  ), [periodCategoryTotals, total, allCategoryColors]);

  // Location insights
  const topLocations = Object.entries(periodLocationTotals)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([location, amount]) => ({ location, amount }));

  return (
    <div className="w-full max-w-4xl mx-auto mt-2 mb-4 px-2">
      <div
        className={`shadow-xl rounded-2xl border p-6 flex flex-col items-center ${
          isDark
            ? 'bg-app-surface text-white border-white/10'
            : 'bg-white/90 text-gray-900 border-gray-200'
        }`}
      >
        {/* Header */}
        <div className="w-full flex flex-row items-center justify-between mb-4">
          <div className="text-lg font-bold">{showTitle ? 'Insights' : ''}</div>
          <div className="flex items-center gap-2">
            {/* Previous Arrow */}
            <button
              onClick={navigatePrevious}
              className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-200 border focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                isDark
                  ? 'bg-white/10 text-white/80 border-white/10 hover:bg-white/20'
                  : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
              }`}
              title="Previous period"
            >
              <svg className={`w-4 h-4 ${isDark ? 'text-white/80' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            {/* Period Dropdown */}
            {!hidePeriodSelect && (
              <select
                className={`rounded-lg px-3 py-1 text-sm font-semibold border focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                  isDark ? 'bg-white/10 text-white border-white/10' : 'bg-gray-100 text-gray-900 border-gray-200'
                }`}
                style={{ colorScheme: isDark ? 'dark' : 'light' }}
                value={activePeriod}
                onChange={e => setActivePeriod(e.target.value)}
              >
                <option className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} value="week">Week</option>
                <option className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} value="month">Month</option>
                <option className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} value="year">Year</option>
              </select>
            )}
            
            {/* Next Arrow - only show when not on current period */}
            {currentOffset < 0 && (
              <button
                onClick={navigateNext}
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors duration-200 border focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                  isDark
                    ? 'bg-white/10 text-white/80 border-white/10 hover:bg-white/20'
                    : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                }`}
                title="Next period"
              >
                <svg className={`w-4 h-4 ${isDark ? 'text-white/80' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
            
            {/* Current Period Button (only show when not on current) */}
            {currentOffset !== 0 && (
              <button
                onClick={navigateToCurrent}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors duration-200 ${
                  isDark
                    ? 'text-app-primary hover:text-blue-200 hover:bg-white/10'
                    : 'text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                }`}
                title="Go to current period"
              >
                Today
              </button>
            )}

            {/* Comparison Toggle */}
            <button
              onClick={() => setShowComparison(!showComparison)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors duration-200 ${
                showComparison
                  ? 'bg-blue-600 text-white'
                  : isDark
                    ? 'bg-white/10 text-white/80 hover:bg-white/20'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              title="Toggle comparison mode"
            >
              Compare
            </button>
          </div>
        </div>

        {/* Comparison Mode Controls */}
        {showComparison && (
          <div
            className={`w-full flex flex-col gap-3 mb-4 p-4 rounded-xl border ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-blue-50 border-blue-200'
            }`}
          >
            <div className="flex flex-row gap-2 items-center justify-center">
              <span className={`text-xs font-semibold ${isDark ? 'text-blue-200' : 'text-blue-700'}`}>Compare:</span>
                             <select
                 className={`rounded-full px-3 py-1 text-xs font-semibold border focus:outline-none focus:ring-2 focus:ring-blue-400 ${
                   isDark ? 'bg-white/10 text-white border-white/10' : 'bg-white text-blue-700 border-blue-300'
                 }`}
                 style={{ colorScheme: isDark ? 'dark' : 'light' }}
                 value={comparisonType}
                 onChange={e => setComparisonType(e.target.value)}
               >
                 <option className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} value="category">Categories</option>
                 <option className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} value="period">Periods</option>
               </select>
            </div>
            
            

            {/* Category Comparison */}
            {comparisonType === 'category' && (
              <div className="flex flex-row gap-2 items-center justify-center">
                <select
                  className={`rounded-full px-3 py-1 text-xs font-semibold border focus:outline-none ${
                    isDark ? 'bg-white/10 text-white border-white/10' : 'bg-blue-100 text-blue-700 border-blue-300'
                  }`}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  value={comparisonCategoryA}
                  onChange={e => setComparisonCategoryA(e.target.value)}
                >
                  <option className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} value="">Select category</option>
                  {allCategories.map(cat => (
                    <option key={cat} className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} value={cat}>{cat}</option>
                  ))}
                </select>
                <span className={`font-bold ${isDark ? 'text-blue-200' : 'text-blue-600'}`}>vs</span>
                <select
                  className={`rounded-full px-3 py-1 text-xs font-semibold border focus:outline-none ${
                    isDark ? 'bg-white/10 text-white border-white/10' : 'bg-blue-100 text-blue-700 border-blue-300'
                  }`}
                  style={{ colorScheme: isDark ? 'dark' : 'light' }}
                  value={comparisonCategoryB}
                  onChange={e => setComparisonCategoryB(e.target.value)}
                >
                  <option className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} value="">Select category</option>
                  {allCategories.map(cat => (
                    <option key={cat} className={isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            )}

                         {/* Smart Period Comparison */}
            {comparisonType === 'period' && (
              <div className="flex flex-col gap-2 items-center justify-center">
                <div className={`text-xs font-medium ${isDark ? 'text-blue-200' : 'text-blue-600'}`}>Compare date ranges:</div>
                <div className="flex flex-row gap-2 items-center justify-center">
                  <input
                    type="date"
                    className={`rounded-full px-3 py-1 text-xs font-semibold border focus:outline-none ${
                      isDark ? 'bg-white/10 text-white border-white/10' : 'bg-blue-100 text-blue-700 border-blue-300'
                    }`}
                    style={{ colorScheme: isDark ? 'dark' : 'light' }}
                    value={comparisonPeriodA}
                    onChange={e => setComparisonPeriodA(e.target.value)}
                  />
                  <span className={`font-bold ${isDark ? 'text-blue-200' : 'text-blue-600'}`}>vs</span>
                  <input
                    type="date"
                    className={`rounded-full px-3 py-1 text-xs font-semibold border focus:outline-none ${
                      isDark ? 'bg-white/10 text-white border-white/10' : 'bg-blue-100 text-blue-700 border-blue-300'
                    }`}
                    style={{ colorScheme: isDark ? 'dark' : 'light' }}
                    value={comparisonPeriodB}
                    onChange={e => setComparisonPeriodB(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Date range and stats */}
        <div className={`w-full flex flex-row items-center justify-between mb-2 text-xs font-semibold ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <span>{periodLabel}</span>
          <span>SPENT/DAY</span>
        </div>
        <div className="w-full flex flex-row items-center justify-between mb-4">
          <span className="text-2xl font-bold text-red-500">{formatCurrency(expenses, settings?.baseCurrency || 'EUR')}</span>
          <span className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {formatCurrency(spentPerDay, settings?.baseCurrency || 'EUR')}
          </span>
        </div>

        {/* Bar Chart */}
        <div className="w-full h-40 md:h-48 mb-4">
          <Bar data={barData} options={barOptions} />
        </div>

        {/* Category Legend */}
        <div className="flex flex-row flex-wrap items-center justify-center gap-4 mt-2 w-full">
          {legend.map(l => (
            <div key={l.name} className="flex items-center gap-2">
              <span className="inline-block w-6 h-3 rounded-full" style={{background: l.color}}></span>
              <span className={`text-xs font-semibold ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>{l.name}</span>
              <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-400'}`}>{l.percent}%</span>
              <div className="flex flex-col">
                <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-gray-500'}`}>
                  {formatCurrency(periodCategoryTotals[l.name], settings?.baseCurrency || 'EUR')}
                </span>
                {/* Show original currency amounts if available */}
                {(() => {
                  const currencyTotals = currencyTotalsByCategory[l.name] || {};
                  const currencies = Object.entries(currencyTotals);
                  if (currencies.length > 1 || (currencies.length === 1 && currencies[0][0] !== (settings?.baseCurrency || 'EUR'))) {
                    return (
                      <span className={`text-xs ${isDark ? 'text-blue-200' : 'text-blue-600'}`}>
                        {currencies.map(([currency, amount], idx) => (
                          <span key={currency}>
                            {formatCurrency(amount, currency)}
                            {idx < currencies.length - 1 ? ' • ' : ''}
                          </span>
                        ))}
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

