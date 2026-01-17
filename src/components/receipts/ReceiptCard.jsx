import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Edit, Trash2 } from 'lucide-react';

export default function ReceiptCard({
  receipt,
  expandedReceiptId,
  setExpandedReceiptId,
  handleEditClick,
  handleBinIconClick,
  setPendingDeleteId,
  setShowDeleteModal,
  settings,
  getBaseAmount,
  getCategoryBorderClass,
  formatCurrency,
  AsyncCurrencyConversion,
}) {
  const [baseCurrencyEquivalent, setBaseCurrencyEquivalent] = useState(null);
  const [isLoadingConversion, setIsLoadingConversion] = useState(false);
  const isExpanded = expandedReceiptId === receipt.id;
  const amount = parseFloat(receipt.total);
  const baseAmount = getBaseAmount(receipt);
  const baseCurrency = settings?.baseCurrency || 'EUR';
  const baseDisplay = formatCurrency(Math.abs(baseAmount), baseCurrency);
  const hasAltCurrency = receipt.currency && receipt.currency !== (settings?.baseCurrency || 'EUR');
  const isNegative = isNaN(amount) || amount < 0;
  const catColor = getCategoryBorderClass(receipt.category);

  const [swipeOffset, setSwipeOffset] = useState(0);
  const [swipeDir, setSwipeDir] = useState(null);
  const animating = useRef(false);

  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [touchStartTime, setTouchStartTime] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeVelocity, setSwipeVelocity] = useState(0);

  const SWIPE_THRESHOLD = 120;
  const VELOCITY_THRESHOLD = 0.3;
  const MIN_SWIPE_DISTANCE = 50;
  const MAX_VERTICAL_DRIFT = 100;

  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
    setTouchStartTime(Date.now());
    setIsSwiping(false);
    setSwipeVelocity(0);
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStart.x;
    const deltaY = touch.clientY - touchStart.y;
    const deltaTime = Date.now() - touchStartTime;

    const velocity = deltaTime > 0 ? Math.abs(deltaX) / deltaTime : 0;
    setSwipeVelocity(velocity);

    if (
      Math.abs(deltaX) > Math.abs(deltaY) &&
      Math.abs(deltaX) > MIN_SWIPE_DISTANCE &&
      Math.abs(deltaY) < MAX_VERTICAL_DRIFT
    ) {
      if (!isSwiping) {
        setIsSwiping(true);
        try { navigator.vibrate && navigator.vibrate(10); } catch {}
      }

      const resistance = 0.8;
      const resistedDeltaX = deltaX * resistance;

      setSwipeOffset(resistedDeltaX);
      setSwipeDir(deltaX > 0 ? 'right' : 'left');
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    const deltaX = swipeOffset;
    const deltaTime = Date.now() - touchStartTime;
    const velocity = deltaTime > 0 ? Math.abs(deltaX) / deltaTime : 0;

    const shouldTrigger = isSwiping && (
      Math.abs(deltaX) > SWIPE_THRESHOLD ||
      velocity > VELOCITY_THRESHOLD
    );

    if (shouldTrigger) {
      animating.current = true;
      try { navigator.vibrate && navigator.vibrate([20, 20, 20]); } catch {}

      const animateOut = deltaX > 0 ? 300 : -300;
      setSwipeOffset(animateOut);

      setTimeout(() => {
        setSwipeOffset(0);
        setSwipeDir(null);
        setIsSwiping(false);
        animating.current = false;

        if (deltaX > 0) {
          handleEditClick(receipt);
        } else {
          setPendingDeleteId(receipt.id);
          setShowDeleteModal(true);
        }
      }, 250);
    } else {
      setSwipeOffset(0);
      setSwipeDir(null);
      setIsSwiping(false);
    }

    setTouchStart({ x: 0, y: 0 });
    setTouchStartTime(0);
    setSwipeVelocity(0);
  };

  const swipeProgress = Math.min(Math.abs(swipeOffset) / SWIPE_THRESHOLD, 1);
  const shouldShowAction = swipeProgress > 0.3;

  let bgColor = 'transparent';
  let icon = null;
  let actionText = '';

  if (swipeOffset < 0 && shouldShowAction) {
    bgColor = `rgba(220,38,38,${swipeProgress * 0.9})`;
    icon = <Trash2 className="h-8 w-8 text-white" style={{
      opacity: swipeProgress,
      transform: `scale(${0.7 + 0.3 * swipeProgress})`,
      transition: 'all 0.1s ease-out'
    }} />;
    actionText = 'Delete';
  } else if (swipeOffset > 0 && shouldShowAction) {
    bgColor = `rgba(37,99,235,${swipeProgress * 0.9})`;
    icon = <Edit className="h-8 w-8 text-white" style={{
      opacity: swipeProgress,
      transform: `scale(${0.7 + 0.3 * swipeProgress})`,
      transition: 'all 0.1s ease-out'
    }} />;
    actionText = 'Edit';
  }

  return (
    <div
      key={receipt.id}
      className="relative w-full overflow-x-hidden"
      style={{ touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="absolute inset-0 z-0 flex items-center justify-center transition-all duration-150 ease-out"
        style={{
          background: bgColor,
          borderRadius: '1rem',
          pointerEvents: 'none',
          opacity: shouldShowAction ? 1 : 0,
        }}
      >
        <div className="flex flex-col items-center gap-2">
          {icon}
          {actionText && (
            <span className="text-white font-semibold text-sm opacity-80">
              {actionText}
            </span>
          )}
        </div>
      </div>
      <Card
        id={`receipt-card-${receipt.id}`}
        style={{
          minHeight: 96,
          transform: `translateX(${swipeOffset}px)`,
          transition: animating.current ? 'transform 0.25s cubic-bezier(0.22,1,0.36,1)' : 'transform 0.1s ease-out',
          rotate: isSwiping ? `${swipeOffset * 0.02}deg` : '0deg',
        }}
        className={`relative bg-slate-800/90 p-5 pl-4 rounded-2xl shadow-xl text-white border border-blue-900/30 border-l-4 ${catColor} transition-all duration-300 ease-in-out animate-fade-in-up ${isExpanded ? 'ring-2 ring-blue-500/50 scale-[1.01] shadow-2xl' : 'hover:shadow-2xl hover:-translate-y-1 active:scale-90'} ${isSwiping ? 'shadow-2xl' : ''}`}
        onClick={() => setExpandedReceiptId(isExpanded ? null : receipt.id)}
        aria-label={`Receipt for ${receipt.merchant}`}
      >
        {!isSwiping && swipeOffset === 0 && (
          <div className="absolute top-2 right-2 opacity-20 hover:opacity-40 transition-opacity">
            <div className="flex gap-1">
              <div className="w-1 h-1 bg-blue-300 rounded-full animate-pulse"></div>
              <div className="w-1 h-1 bg-blue-300 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-1 h-1 bg-blue-300 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
          </div>
        )}

        {isSwiping && (
          <div className="absolute top-2 right-2">
            <div className="w-8 h-1 bg-slate-600 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-400 rounded-full transition-all duration-100"
                style={{ width: `${swipeProgress * 100}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg font-extrabold text-blue-200 truncate max-w-[120px] md:max-w-[200px] tracking-tight" title={receipt.merchant}>{receipt.merchant}</span>
            {receipt.isGroupExpense && (
              <div className="flex items-center gap-1">
                <span className="text-xs bg-blue-900/50 text-blue-200 px-2 py-1 rounded-full font-medium">
                  {receipt.isReimbursement ? 'Reimb' : 'Group'}
                </span>
                {receipt.note && receipt.note.includes('Group: ') && (
                  <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded-full font-medium">
                    {receipt.note.split('Group: ')[1].split(' -')[0]}
                  </span>
                )}
              </div>
            )}
          </div>
          <span className="text-xs text-blue-200/80 font-medium whitespace-nowrap">
            {receipt.transactionDate && receipt.transactionDate.toDate ? receipt.transactionDate.toDate().toLocaleDateString() : ''}
          </span>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className="flex flex-col gap-0.5 mt-1">
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-extrabold ${
                  receipt.isReimbursement ? 'text-green-400' : 'text-white'
                }`}>
                  {receipt.isReimbursement ? `+${baseDisplay}` :
                   isNegative ? `-${baseDisplay}` : baseDisplay}
                </span>
                <span className="text-sm text-blue-200/80 ml-1">{baseCurrency}</span>
              </div>
              {hasAltCurrency && (
                <span className="text-xs text-blue-300/80">
                  {formatCurrency(amount, receipt.currency)}
                </span>
              )}
          </div>
          <div className="flex flex-col gap-2 items-end ml-2">
            <Button
              onClick={e => { e.stopPropagation(); handleEditClick(receipt); }}
              variant="ghost"
              size="icon"
              className="text-blue-400 hover:bg-blue-900/40 hover:text-blue-300 transition-transform duration-150 ease-in-out active:scale-90"
              aria-label="Edit receipt"
            >
              <Edit className="h-5 w-5" />
            </Button>
            <Button
              onClick={e => handleBinIconClick(e, receipt.id)}
              variant="ghost"
              size="icon"
              className="text-red-400 hover:bg-blue-900/40 hover:text-red-300 transition-transform duration-150 ease-in-out active:scale-90"
              aria-label="Delete receipt"
            >
              <Trash2 className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <CardContent className="pt-4">
            <div className="mb-3 flex items-center justify-end gap-2">
              <Button
                onClick={e => { e.stopPropagation(); handleEditClick(receipt); }}
                variant="outline"
                size="sm"
                className="border-blue-400/50 text-blue-200 hover:bg-blue-900/40 hover:text-blue-100"
                aria-label="Edit receipt"
              >
                <Edit className="mr-1 h-4 w-4" />
                Edit
              </Button>
              <Button
                onClick={e => handleBinIconClick(e, receipt.id)}
                variant="outline"
                size="sm"
                className="border-red-400/50 text-red-200 hover:bg-red-900/40 hover:text-red-100"
                aria-label="Delete receipt"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-blue-200/70">Subtotal</p>
                <p className="text-base">
                  {receipt.subtotal && !isNaN(parseFloat(receipt.subtotal)) ? parseFloat(receipt.subtotal).toFixed(2) : '-'}
                  {receipt.subtotal && !isNaN(parseFloat(receipt.subtotal)) && receipt.currency !== (settings?.baseCurrency || 'EUR') && (
                    <AsyncCurrencyConversion
                      amount={receipt.subtotal}
                      currency={receipt.currency}
                      date={receipt.transactionDate || receipt.date}
                    />
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-blue-200/70">Tax</p>
                <p className="text-base">
                  {receipt.tax && parseFloat(receipt.tax) > 0 ? parseFloat(receipt.tax).toFixed(2) : '0.00'}
                  {receipt.tax && parseFloat(receipt.tax) > 0 && receipt.currency !== (settings?.baseCurrency || 'EUR') && (
                    <AsyncCurrencyConversion
                      amount={receipt.tax}
                      currency={receipt.currency}
                      date={receipt.transactionDate || receipt.date}
                    />
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-blue-200/70">Payment</p>
                <p className="text-base">{receipt.paymentMethod || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-xs text-blue-200/70">Category</p>
                <p className="text-base flex items-center gap-1">{receipt.category || 'Uncategorized'}
                  <span className={`inline-block w-2 h-2 rounded-full ml-1 ${catColor.replace('border-l-4', 'bg-')}`}></span>
                </p>
              </div>
              <div>
                <p className="text-xs text-blue-200/70">Date</p>
                <p className="text-base">{receipt.transactionDate && receipt.transactionDate.toDate ? receipt.transactionDate.toDate().toLocaleDateString() : ''}</p>
              </div>
              <div>
                <p className="text-xs text-blue-200/70">Currency</p>
                <p className="text-base">
                  {receipt.currency}
                  {receipt.currency !== (settings?.baseCurrency || 'EUR') && (
                    <span className="text-xs text-blue-300/80 ml-1">
                      (converted to {settings?.baseCurrency || 'EUR'})
                    </span>
                  )}
                </p>
              </div>
            </div>
            {receipt.isGroupExpense && (
              <div className="mt-2 p-3 bg-blue-900/20 rounded-xl border border-blue-800/30">
                <p className="text-xs text-blue-200/70 mb-1">Group Information</p>
                <div className="text-sm text-blue-200">
                  {receipt.isReimbursement ? (
                    <span>Reimbursement from group expense</span>
                  ) : (
                    <span>You paid for group expense</span>
                  )}
                  {receipt.note && (
                    <p className="text-xs text-blue-300/80 mt-1">{receipt.note}</p>
                  )}
                </div>
              </div>
            )}
            {(receipt.addressFromOCR || receipt.addressRaw || receipt.place?.display_name) && (
              <div className="mt-2 p-3 bg-green-900/20 rounded-xl border border-green-800/30">
                <p className="text-xs text-green-200/70 mb-1 flex items-center gap-1">
                  Location
                  {receipt.geocodeStatus === 'ok' && (
                    <span className="text-xs bg-green-500/20 text-green-300 px-1 rounded">Precise</span>
                  )}
                  {receipt.geocodeStatus === 'approx' && (
                    <span className="text-xs bg-yellow-500/20 text-yellow-300 px-1 rounded">Approximate</span>
                  )}
                </p>
                <div className="text-sm text-green-200">
                  {receipt.place?.display_name ? (
                    <span>{receipt.place.display_name}</span>
                  ) : receipt.addressFromOCR ? (
                    <span>{receipt.addressFromOCR}</span>
                  ) : receipt.addressRaw ? (
                    <span>{receipt.addressRaw}</span>
                  ) : null}
                  {receipt.addressConfidence && (
                    <p className="text-xs text-green-300/80 mt-1">
                      Confidence: {Math.round(receipt.addressConfidence * 100)}%
                    </p>
                  )}
                </div>
              </div>
            )}
            {receipt.items && receipt.items.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-blue-200/70 mb-1">Items</p>
                <ul className="space-y-1 list-disc list-inside">
                  {receipt.items.map((item, index) => (
                    <li key={index} className="flex justify-between text-sm">
                      <span className="truncate max-w-[100px]">{item.name}</span>
                      <span>
                        {!isNaN(parseFloat(item.price)) ? parseFloat(item.price).toFixed(2) : '0.00'} {receipt.currency}
                        {!isNaN(parseFloat(item.price)) && receipt.currency !== (settings?.baseCurrency || 'EUR') && (
                          <AsyncCurrencyConversion
                            amount={item.price}
                            currency={receipt.currency}
                            date={receipt.transactionDate || receipt.date}
                          />
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
