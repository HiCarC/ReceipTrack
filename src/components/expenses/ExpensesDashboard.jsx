import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import MapWidget from '@/components/map/MapWidget';

export default function ExpensesDashboard({ totalExpenses, categoryTotals, formatCurrency, formatDateSafely, settings, receipts = [], selectedCategory, setSelectedCategory, modalOpen, setModalOpen, getCategoryColor }) {
  const groupCategoryNames = React.useMemo(() => {
    const names = new Set();
    receipts.forEach((r) => {
      if (
        r?.isGroupExpense &&
        r.note &&
        r.note.includes('Group: ')
      ) {
        const groupName = r.note.split('Group: ')[1].split(' -')[0];
        if (groupName) names.add(groupName);
      }
    });
    return names;
  }, [receipts]);

  // --- Semi-Circle Doughnut Data ---
  const sortedCategories = Object.entries(categoryTotals)
    .map(([cat, data]) => {
      // Handle both new format (object with baseCurrency) and old format (number)
      const amount = typeof data === 'object' ? data.baseCurrency : data;
      return [cat, typeof data === 'object' ? data : { baseCurrency: data, localCurrency: data, currencies: {} }];
    })
    .sort(([, a], [, b]) => (a.baseCurrency || 0) - (b.baseCurrency || 0))
    .reverse(); // Sort descending
  const categoryLabels = sortedCategories.map(c => c[0]);
  const categoryData = sortedCategories.map(c => c[1].baseCurrency || c[1]);
  // Use unified category colors for consistency
  const chartColors = categoryLabels.map(cat => getCategoryColor(cat));

  // Get current month for context
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'short' });
  const currentYear = new Date().getFullYear();

  const doughnutData = {
    labels: categoryLabels,
    datasets: [
      {
        data: categoryData,
        backgroundColor: chartColors,
        borderWidth: 3,
        borderColor: '#181e2a',
        hoverBorderColor: '#6366F1',
      },
    ],
  };
  // --- UI ---
  return (
    <div className="w-full max-w-2xl mx-auto mt-4 mb-4 px-2">
      <div className="bg-slate-800/60 backdrop-blur-lg shadow-2xl rounded-3xl border border-blue-400/20 p-6 flex flex-col items-center glass-card" style={{overflow: 'hidden', background: 'rgba(30,41,59,0.65)', boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.18)', border: '1.5px solid rgba(99,102,241,0.12)', backdropFilter: 'blur(18px)'}}>
        {/* Modern Semi-Circle Doughnut Chart (restored) */}
        <div className="w-full flex flex-col items-center justify-center mb-6 relative group no-scrollbar overflow-hidden" style={{height: 140, maxHeight: 180, transition: 'transform 0.3s cubic-bezier(.4,2,.3,1)', willChange: 'transform'}}>
          <Doughnut
            data={doughnutData}
            options={{
              circumference: 180,
              rotation: -90,
              cutout: '80%',
              animation: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: ctx => {
                      const value = ctx.raw;
                      const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                      const percent = ((value / total) * 100).toFixed(1);
                      return `${ctx.label}: ${formatCurrency(value, settings?.baseCurrency || 'EUR')} (${percent}%)`;
                    },
                  },
                  backgroundColor: '#22223b',
                  titleColor: '#fff',
                  bodyColor: '#fff',
                  borderColor: '#6366F1',
                  borderWidth: 1,
                  displayColors: false,
                  padding: 12,
                },
              },
              elements: {
                arc: {
                  borderCapStyle: 'round',
                  borderJoinStyle: 'round',
                  borderRadius: 99,
                  shadowBlur: 10,
                  shadowColor: 'rgba(99,102,241,0.18)',
                },
              },
              responsive: true,
              maintainAspectRatio: false,
              parsing: false,
              normalized: true,
            }}
            height={140}
            style={{overflow: 'hidden'}}
          />
          {/* Centered stats overlay */}
          <div className="absolute left-0 right-0 top-0 flex flex-col items-center justify-center pointer-events-none group-hover:scale-105 group-hover:shadow-blue-400/30 transition-transform duration-200 px-2 md:px-0 no-scrollbar overflow-hidden" style={{height: 100, marginTop: 30}}>
            {/* Minimalistic month indicator */}
            <div className="text-[10px] font-medium text-blue-300/70 mb-1 tracking-wider uppercase overflow-hidden" style={{letterSpacing: 1.5}}>
              {currentMonth} {currentYear}
            </div>
            <div className="text-xs font-semibold text-gray-300 mb-1 tracking-wide overflow-hidden" style={{letterSpacing: 1}}>NET EXPENSES</div>
            <div className={`text-3xl xs:text-4xl md:text-5xl font-extrabold mb-1 text-center ${
              totalExpenses > 0 ? 'text-green-400' : 'text-white'
            }`} style={{overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '100%', padding: '0 0.5rem'}}>
              {totalExpenses > 0 ? '+' : ''}{formatCurrency(Math.abs(totalExpenses), settings?.baseCurrency || 'EUR')}
            </div>
            <div className="text-xs text-gray-400 overflow-hidden">{categoryLabels.length} categories</div>
            {/* Current month indicator */}
            <div className="text-[8px] text-blue-400/60 mt-1 tracking-wider uppercase overflow-hidden" style={{letterSpacing: 1}}>
              THIS MONTH ONLY
            </div>
          </div>
        </div>
        {/* Category Cards Grid (mobile-friendly) */}
        <div className="w-full grid grid-cols-1 gap-4 mb-4 md:grid-cols-2">
          {sortedCategories.map(([cat, categoryData], idx) => {
            const amt = categoryData.baseCurrency || categoryData; // Handle both new and old format
            const percent = Math.abs(totalExpenses) > 0 ? Math.min(100, Math.round((Math.abs(amt) / Math.abs(totalExpenses)) * 100)) : 0;
            const color = getCategoryColor(cat); // Use unified color system
            // Determine emoji based on category or group name
            let emoji = '💸'; // default
            if (cat === 'Groceries') emoji = '🛒';
            else if (cat === 'Dining') emoji = '🍽️';
            else if (cat === 'Transportation') emoji = '🚌';
            else if (cat === 'Bills') emoji = '💡';
            else if (cat === 'Entertainment') emoji = '🎬';
            else if (cat === 'Health') emoji = '💊';
            // Check if this category is actually a group name
            const isGroupCategory = groupCategoryNames.has(cat);
            
            if (isGroupCategory) {
              emoji = '👥';
            } else {
              emoji = '💸';
            }

            
            // Get the most common currency for this category
            let localCurrencyDisplay = '';
            if (categoryData.currencies && Object.keys(categoryData.currencies).length > 0) {
              const currencies = Object.entries(categoryData.currencies);
              if (currencies.length === 1) {
                // Single currency
                const [currency, amount] = currencies[0];
                localCurrencyDisplay = formatCurrency(amount, currency);
              } else {
                // Multiple currencies - show the largest amount
                const largestCurrency = currencies.reduce((a, b) => a[1] > b[1] ? a : b);
                localCurrencyDisplay = formatCurrency(largestCurrency[1], largestCurrency[0]);
              }
            }
            
            return (
              <button
                key={cat}
                className="rounded-2xl bg-slate-900/80 shadow-lg p-3 flex flex-col gap-2 items-start border border-blue-400/10 relative overflow-hidden cursor-pointer transition-transform duration-200 hover:scale-105 hover:shadow-blue-400/30 active:scale-95 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{boxShadow: '0 2px 12px 0 rgba(99,102,241,0.08)', border: `1.5px solid ${color}33`, minHeight: 128, touchAction: 'manipulation'}}
                onClick={() => { setSelectedCategory({ name: cat, amount: amt, percent, color, emoji, categoryData }); setModalOpen(true); }}
                tabIndex={0}
                aria-label={`Show details for ${cat}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{emoji}</span>
                  <span className="font-semibold text-base text-white/90">{cat}</span>

                </div>
                <div className="flex flex-col gap-1">
                <div className="flex items-end gap-2">
                  <span className={`text-xl md:text-2xl font-extrabold ${
                    isGroupCategory ? 'text-white' : 
                    amt > 0 ? 'text-green-400' : 'text-white'
                  }`}>
                    {isGroupCategory ? '' : amt > 0 ? '+' : ''}{formatCurrency(Math.abs(amt), settings?.baseCurrency || 'EUR')}
                  </span>
                  <span className={`text-xs font-bold ${
                    isGroupCategory ? 'text-blue-400' : 'text-green-400'
                  }`}>{percent}%</span>
                  </div>
                  {localCurrencyDisplay && (
                    <div className="text-xs text-blue-300/80">
                      {localCurrencyDisplay}
                    </div>
                  )}
                </div>
                {/* Progress Bar */}
                <div className="w-full h-2 rounded-full bg-slate-700/60 mt-1 mb-1 overflow-hidden">
                  <div
                    className="h-2 rounded-full transition-all duration-700"
                    style={{ width: `${percent}%`, background: color, boxShadow: `0 0 8px 0 ${color}80` }}
                  ></div>
                </div>
              </button>
            );
          })}
        </div>
        
        {/* Map Widget */}
        <div className="w-full mb-4">
          <MapWidget onViewMap={() => {
            // Use a global event to avoid referencing potentially undefined variables
            try {
              console.log('[MapWidget] requestTabChange -> map');
              document.dispatchEvent(new CustomEvent('requestTabChange', { detail: 'map' }));
            } catch (e) {
              console.warn('Failed to dispatch requestTabChange', e);
            }
          }} />
        </div>
      </div>
    </div>
  );
}

