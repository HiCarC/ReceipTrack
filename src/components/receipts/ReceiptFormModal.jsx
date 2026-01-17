import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Calendar, Image, Loader2, Plus, Store, Trash2, X } from 'lucide-react';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

const ReceiptFormHeader = ({ editingReceipt, isBusy, onClose }) => (
  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/70 bg-slate-950/80">
    <button
      type="button"
      onClick={onClose}
      className="text-sm text-slate-300 hover:text-white transition-colors"
      aria-label={editingReceipt ? 'Close' : 'Cancel'}
    >
      {editingReceipt ? <X className="h-5 w-5" /> : 'Cancel'}
    </button>
    <div className="text-base font-semibold text-white">
      {editingReceipt ? 'Edit Receipt' : 'Add Receipt'}
    </div>
    <Button
      type="submit"
      disabled={isBusy}
      className="h-8 px-4 rounded-full bg-emerald-400 hover:bg-emerald-300 text-slate-900 text-sm font-semibold"
    >
      {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
    </Button>
  </div>
);

const ReceiptFormFooter = ({ editingReceipt, isBusy, onRequestDelete }) => (
  <>
    {!editingReceipt && (
      <div className="px-5 pb-5">
        <Button
          type="submit"
          disabled={isBusy}
          className="w-full h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-base font-semibold"
        >
          {isBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save Receipt'}
        </Button>
      </div>
    )}
    {editingReceipt && (
      <div className="px-5 pb-5">
        <Button
          type="button"
          onClick={onRequestDelete}
          className="w-full h-12 rounded-full border border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20"
        >
          <Trash2 className="h-4 w-4 mr-2" /> Delete Receipt
        </Button>
      </div>
    )}
  </>
);

const ReceiptFormEditFields = ({
  activeFormData,
  editingReceipt,
  formErrors,
  settings,
  categories,
  getCurrencySymbol,
  merchantInputRef,
  handleFormInputChange,
  handleItemInputChange,
  handleAddItemField,
  handleRemoveItemField,
  supportedCurrencies,
}) => (
  <>
    {(activeFormData.imageUrl || editingReceipt?.imageUrl) && (
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <img
            src={activeFormData.imageUrl || editingReceipt?.imageUrl}
            alt="Receipt"
            className="h-28 w-28 rounded-2xl object-cover border border-slate-800/70"
          />
          <button
            type="button"
            className="absolute -right-2 -bottom-2 h-9 w-9 rounded-full bg-blue-600 text-white shadow-md flex items-center justify-center"
            aria-label="Zoom receipt"
          >
            <Image className="h-4 w-4" />
          </button>
        </div>
      </div>
    )}
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-5 text-center">
      <p className="text-xs tracking-[0.2em] uppercase text-slate-400">Total Amount</p>
      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="text-3xl text-slate-400">{getCurrencySymbol(activeFormData.currency)}</span>
        <Input
          id="total"
          name="total"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={activeFormData.total}
          onChange={e => {
            const value = e.target.value;
            if (/^[\d.,]*$/.test(value) || value === '') {
              handleFormInputChange(e);
            }
          }}
          onBlur={e => {
            const value = e.target.value.replace(',', '.');
            const parsed = parseFloat(value);
            if (!isNaN(parsed)) {
              handleFormInputChange({ target: { name: 'total', value: parsed.toFixed(2) } });
            }
          }}
          className="w-40 sm:w-56 text-4xl font-semibold text-white text-center bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
        />
      </div>
      {formErrors.total && (
        <p className="text-red-400 text-xs mt-2">{formErrors.total}</p>
      )}
    </div>
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-4">
      <Label htmlFor="merchant" className="text-xs text-slate-400">Merchant Name</Label>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-blue-500/15 text-blue-300 flex items-center justify-center">
          <Store className="h-5 w-5" />
        </div>
        <Input
          id="merchant"
          name="merchant"
          ref={merchantInputRef}
          value={activeFormData.merchant}
          onChange={handleFormInputChange}
          className="flex-1 bg-transparent border-none text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder="e.g. Starbucks Coffee"
          autoCapitalize="words"
          inputMode="text"
        />
      </div>
      {formErrors.merchant && (
        <p className="text-red-400 text-xs mt-2">{formErrors.merchant}</p>
      )}
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-4">
        <Label htmlFor="date" className="text-xs text-slate-400">Date</Label>
        <div className="mt-2 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <Input
            id="date"
            name="date"
            type="date"
            value={activeFormData.date}
            onChange={handleFormInputChange}
            className="flex-1 bg-transparent border-none text-white focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        {formErrors.date && (
          <p className="text-red-400 text-xs mt-2">{formErrors.date}</p>
        )}
      </div>
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-4">
        <Label htmlFor="currency" className="text-xs text-slate-400">Currency</Label>
        <div className="mt-2">
          <Select
            value={activeFormData.currency || (settings?.baseCurrency || 'EUR')}
            onValueChange={value => handleFormInputChange({ target: { name: 'currency', value } })}
            onOpenChange={open => {
              if (open && document.activeElement && document.activeElement.tagName === 'INPUT') {
                document.activeElement.blur();
              }
            }}
          >
            <SelectTrigger className="w-full bg-transparent border-none text-white focus:ring-0">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 text-white border-slate-700 shadow-xl rounded-xl max-h-60 overflow-y-auto">
              {supportedCurrencies.map(currency => (
                <SelectItem
                  key={currency.code}
                  value={currency.code}
                  className="text-white bg-slate-900 hover:bg-slate-800 focus:bg-slate-800 data-[state=checked]:bg-slate-800/80 data-[state=checked]:text-blue-200 transition-colors duration-150 rounded-lg px-4 py-2 cursor-pointer text-sm"
                >
                  {currency.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-4">
      <Label htmlFor="category" className="text-xs text-slate-400">Category</Label>
      <div className="mt-2">
        <Select
          value={activeFormData.category || ''}
          onValueChange={value => handleFormInputChange({ target: { name: 'category', value } })}
          onOpenChange={open => {
            if (open && document.activeElement && document.activeElement.tagName === 'INPUT') {
              document.activeElement.blur();
            }
          }}
        >
          <SelectTrigger className="w-full bg-transparent border-none text-white focus:ring-0">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 text-white border-slate-700 shadow-xl rounded-xl max-h-60 overflow-y-auto">
            {categories.map(cat => (
              <SelectItem
                key={cat}
                value={cat}
                className="text-white bg-slate-900 hover:bg-slate-800 focus:bg-slate-800 data-[state=checked]:bg-slate-800/80 data-[state=checked]:text-blue-200 transition-colors duration-150 rounded-lg px-4 py-2 cursor-pointer text-sm"
              >
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-4">
      <Label htmlFor="paymentMethod" className="text-xs text-slate-400">Payment Method</Label>
      <div className="mt-2">
        <Select
          value={activeFormData.paymentMethod || activeFormData.payment_method || ''}
          onValueChange={value => handleFormInputChange({ target: { name: 'paymentMethod', value } })}
          onOpenChange={open => {
            if (open && document.activeElement && document.activeElement.tagName === 'INPUT') {
              document.activeElement.blur();
            }
          }}
        >
          <SelectTrigger className="w-full bg-transparent border-none text-white focus:ring-0">
            <SelectValue placeholder="Select payment method" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 text-white border-slate-700 shadow-xl rounded-xl max-h-60 overflow-y-auto">
            {['Cash', 'Credit Card', 'Debit Card', 'Mobile Pay', 'Bank Transfer', 'Other'].map(method => (
              <SelectItem
                key={method}
                value={method}
                className="text-white bg-slate-900 hover:bg-slate-800 focus:bg-slate-800 data-[state=checked]:bg-slate-800/80 data-[state=checked]:text-blue-200 transition-colors duration-150 rounded-lg px-4 py-2 cursor-pointer text-sm"
              >
                {method}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-4 flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-white">Split with Group</div>
        <div className="text-xs text-slate-400">Share this expense</div>
      </div>
      <Switch checked={!!editingReceipt?.isGroupExpense} disabled />
    </div>
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Line Items</h3>
        <Button
          type="button"
          variant="ghost"
          onClick={() => handleAddItemField((activeFormData.items || []).length)}
          className="text-blue-400 hover:text-blue-300"
        >
          <Plus className="h-4 w-4 mr-1" /> Add Item
        </Button>
      </div>
      {(activeFormData.items || []).length === 0 && (
        <div className="text-sm text-slate-400">No items yet. Add at least one item.</div>
      )}
      {(activeFormData.items || []).map((item, index) => (
        <div key={index} className="flex items-center gap-2 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2">
          <Input
            placeholder="Item name"
            value={item.name || ''}
            onChange={e => handleItemInputChange(e, index, 'name')}
            className="flex-1 bg-transparent border-none text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
            autoCapitalize="words"
            inputMode="text"
          />
          <div className="relative w-24">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={item.price || ''}
              onChange={e => {
                const value = e.target.value;
                if (/^[\d.,]*$/.test(value) || value === '') {
                  handleItemInputChange(e, index, 'price');
                }
              }}
              onBlur={e => {
                const value = e.target.value.replace(',', '.');
                const parsed = parseFloat(value);
                if (!isNaN(parsed)) {
                  handleItemInputChange({ target: { value: parsed.toFixed(2) } }, index, 'price');
                }
              }}
              className="w-full bg-transparent border-none text-right text-white placeholder:text-slate-500 pr-6 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              {getCurrencySymbol(activeFormData.currency)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleRemoveItemField(index)}
            className="h-8 w-8 rounded-full bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
            aria-label="Remove item"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      {formErrors.items && (
        <p className="text-red-400 text-xs">{formErrors.items}</p>
      )}
    </div>
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-4">
      <Label htmlFor="note" className="text-xs text-slate-400">Notes</Label>
      <textarea
        id="note"
        name="note"
        value={activeFormData.note || ''}
        onChange={handleFormInputChange}
        placeholder="Add any details about this expense"
        rows={3}
        className="mt-2 w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      />
    </div>
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-4 flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-white">Attachments</div>
        <div className="text-xs text-slate-400">Add a photo</div>
      </div>
      <Button
        type="button"
        disabled
        className="rounded-full bg-slate-800/80 text-slate-400 px-4 py-2 text-sm"
      >
        Add Photo
      </Button>
    </div>
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="subtotal" className="text-xs text-slate-400">Subtotal</Label>
          <div className="mt-2 relative">
            <Input
              id="subtotal"
              name="subtotal"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={activeFormData.subtotal}
              onChange={e => {
                const value = e.target.value;
                if (/^[\d.,]*$/.test(value) || value === '') {
                  handleFormInputChange(e);
                }
              }}
              onBlur={e => {
                const value = e.target.value.replace(',', '.');
                const parsed = parseFloat(value);
                if (!isNaN(parsed)) {
                  handleFormInputChange({ target: { name: 'subtotal', value: parsed.toFixed(2) } });
                }
              }}
              className="w-full bg-slate-950/60 border border-slate-800 text-white text-right pr-10 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              {getCurrencySymbol(activeFormData.currency)}
            </span>
          </div>
        </div>
        <div>
          <Label htmlFor="tax" className="text-xs text-slate-400">Tax</Label>
          <div className="mt-2 relative">
            <Input
              id="tax"
              name="tax"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={activeFormData.tax || ''}
              onChange={e => {
                const value = e.target.value;
                if (/^[\d.,]*$/.test(value) || value === '') {
                  handleFormInputChange(e);
                }
              }}
              onBlur={e => {
                const value = e.target.value.replace(',', '.');
                const parsed = parseFloat(value);
                if (!isNaN(parsed)) {
                  handleFormInputChange({ target: { name: 'tax', value: parsed.toFixed(2) } });
                }
              }}
              className="w-full bg-slate-950/60 border border-slate-800 text-white text-right pr-10 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              {getCurrencySymbol(activeFormData.currency)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-slate-950/50 border border-slate-800 px-3 py-3">
        <div>
          <div className="text-sm font-medium text-white">Business</div>
          <div className="text-xs text-slate-400">Used for exports</div>
        </div>
        <Switch
          checked={!!activeFormData.isBusiness}
          onCheckedChange={(val) => handleFormInputChange({ target: { name: 'isBusiness', value: val } })}
        />
      </div>
    </div>
  </>
);

const ReceiptFormCreateFields = ({
  activeFormData,
  editingReceipt,
  formErrors,
  settings,
  categories,
  supportedCurrencies,
  getCurrencySymbol,
  merchantInputRef,
  handleFormInputChange,
  handleItemInputChange,
  handleAddItemField,
  handleRemoveItemField,
}) => (
  <div className="space-y-5">
    {editingReceipt && (activeFormData.imageUrl || editingReceipt?.imageUrl) && (
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <img
            src={activeFormData.imageUrl || editingReceipt?.imageUrl}
            alt="Receipt"
            className="h-28 w-28 rounded-2xl object-cover border border-slate-800/70"
          />
          <button
            type="button"
            className="absolute -right-2 -bottom-2 h-9 w-9 rounded-full bg-blue-600 text-white shadow-md flex items-center justify-center"
          >
            <Image className="h-4 w-4" />
          </button>
        </div>
      </div>
    )}
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-5 text-center">
      <p className="text-xs tracking-[0.2em] uppercase text-slate-400">Total Amount</p>
      <div className="mt-3 flex items-center justify-center gap-2">
        <span className="text-3xl text-slate-400">{getCurrencySymbol(activeFormData.currency)}</span>
        <Input
          id="total"
          name="total"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={activeFormData.total}
          onChange={e => {
            const value = e.target.value;
            if (/^[\d.,]*$/.test(value) || value === '') {
              handleFormInputChange(e);
            }
          }}
          onBlur={e => {
            const value = e.target.value.replace(',', '.');
            const parsed = parseFloat(value);
            if (!isNaN(parsed)) {
              handleFormInputChange({ target: { name: 'total', value: parsed.toFixed(2) } });
            }
          }}
          className="w-40 sm:w-56 text-4xl font-semibold text-white text-center bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
        />
      </div>
      <div className="mt-3 flex justify-center">
        <Select
          value={activeFormData.currency || (settings?.baseCurrency || 'EUR')}
          onValueChange={value => handleFormInputChange({ target: { name: 'currency', value } })}
          onOpenChange={open => {
            if (open && document.activeElement && document.activeElement.tagName === 'INPUT') {
              document.activeElement.blur();
            }
          }}
        >
          <SelectTrigger className="h-9 w-28 rounded-full bg-slate-800/80 border border-slate-700 text-slate-200 justify-center">
            <SelectValue placeholder="Currency" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 text-white border-slate-700 shadow-xl rounded-xl max-h-60 overflow-y-auto">
            {supportedCurrencies.map(currency => (
              <SelectItem
                key={currency.code}
                value={currency.code}
                className="text-white bg-slate-900 hover:bg-slate-800 focus:bg-slate-800 data-[state=checked]:bg-slate-800/80 data-[state=checked]:text-blue-200 transition-colors duration-150 rounded-lg px-4 py-2 cursor-pointer text-sm"
              >
                {currency.code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {formErrors.total && (
        <p className="text-red-400 text-xs mt-2">{formErrors.total}</p>
      )}
    </div>
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-4">
      <Label htmlFor="merchant" className="text-xs text-slate-400">Merchant</Label>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-blue-500/15 text-blue-300 flex items-center justify-center">
          <Store className="h-5 w-5" />
        </div>
        <Input
          id="merchant"
          name="merchant"
          ref={merchantInputRef}
          value={activeFormData.merchant}
          onChange={handleFormInputChange}
          className="flex-1 bg-transparent border-none text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder="e.g. Starbucks"
          autoCapitalize="words"
          inputMode="text"
        />
      </div>
      {formErrors.merchant && (
        <p className="text-red-400 text-xs mt-2">{formErrors.merchant}</p>
      )}
    </div>
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-4">
        <Label htmlFor="date" className="text-xs text-slate-400">Date</Label>
        <div className="mt-2 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-slate-400" />
          <Input
            id="date"
            name="date"
            type="date"
            value={activeFormData.date}
            onChange={handleFormInputChange}
            className="flex-1 bg-transparent border-none text-white focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        {formErrors.date && (
          <p className="text-red-400 text-xs mt-2">{formErrors.date}</p>
        )}
      </div>
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-4">
        <Label htmlFor="paymentMethod" className="text-xs text-slate-400">Payment</Label>
        <div className="mt-2">
          <Select
            value={activeFormData.paymentMethod || activeFormData.payment_method || ''}
            onValueChange={value => handleFormInputChange({ target: { name: 'paymentMethod', value } })}
            onOpenChange={open => {
              if (open && document.activeElement && document.activeElement.tagName === 'INPUT') {
                document.activeElement.blur();
              }
            }}
          >
            <SelectTrigger className="w-full bg-transparent border-none text-white focus:ring-0">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 text-white border-slate-700 shadow-xl rounded-xl max-h-60 overflow-y-auto">
              {['Cash', 'Credit Card', 'Debit Card', 'Mobile Pay', 'Bank Transfer', 'Other'].map(method => (
                <SelectItem
                  key={method}
                  value={method}
                  className="text-white bg-slate-900 hover:bg-slate-800 focus:bg-slate-800 data-[state=checked]:bg-slate-800/80 data-[state=checked]:text-blue-200 transition-colors duration-150 rounded-lg px-4 py-2 cursor-pointer text-sm"
                >
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Category</h3>
        <span className="text-xs text-slate-500">Pick one</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {categories.map(cat => {
          const isActive = activeFormData.category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => handleFormInputChange({ target: { name: 'category', value: cat } })}
              className="flex flex-col items-center gap-2 min-w-[72px]"
            >
              <span className={isActive ? 'h-12 w-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-semibold' : 'h-12 w-12 rounded-full bg-slate-800/80 text-slate-400 flex items-center justify-center text-sm font-semibold'}>
                {cat.slice(0, 1)}
              </span>
              <span className={isActive ? 'text-xs text-blue-300' : 'text-xs text-slate-400'}>
                {cat}
              </span>
            </button>
          );
        })}
      </div>
    </div>
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Line Items</h3>
        <Button
          type="button"
          variant="ghost"
          onClick={() => handleAddItemField((activeFormData.items || []).length)}
          className="text-blue-400 hover:text-blue-300"
        >
          <Plus className="h-4 w-4 mr-1" /> Add Item
        </Button>
      </div>
      {(activeFormData.items || []).length === 0 && (
        <div className="text-sm text-slate-400">No items yet. Add at least one item.</div>
      )}
      {(activeFormData.items || []).map((item, index) => (
        <div key={index} className="flex items-center gap-2 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2">
          <Input
            placeholder="Item name"
            value={item.name || ''}
            onChange={e => handleItemInputChange(e, index, 'name')}
            className="flex-1 bg-transparent border-none text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
            autoCapitalize="words"
            inputMode="text"
          />
          <div className="relative w-24">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={item.price || ''}
              onChange={e => {
                const value = e.target.value;
                if (/^[\d.,]*$/.test(value) || value === '') {
                  handleItemInputChange(e, index, 'price');
                }
              }}
              onBlur={e => {
                const value = e.target.value.replace(',', '.');
                const parsed = parseFloat(value);
                if (!isNaN(parsed)) {
                  handleItemInputChange({ target: { value: parsed.toFixed(2) } }, index, 'price');
                }
              }}
              className="w-full bg-transparent border-none text-right text-white placeholder:text-slate-500 pr-6 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <span className="absolute right-1 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              {getCurrencySymbol(activeFormData.currency)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleRemoveItemField(index)}
            className="h-8 w-8 rounded-full bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
            aria-label="Remove item"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      {formErrors.items && (
        <p className="text-red-400 text-xs">{formErrors.items}</p>
      )}
    </div>
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-4">
      <Label htmlFor="note" className="text-xs text-slate-400">Notes</Label>
      <textarea
        id="note"
        name="note"
        value={activeFormData.note || ''}
        onChange={handleFormInputChange}
        placeholder="Add any details about this expense"
        rows={3}
        className="mt-2 w-full rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      />
    </div>
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-4 flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-white">Attachments</div>
        <div className="text-xs text-slate-400">Add a photo</div>
      </div>
      <Button
        type="button"
        disabled
        className="rounded-full bg-slate-800/80 text-slate-400 px-4 py-2 text-sm"
      >
        Add Photo
      </Button>
    </div>
    <div className="rounded-2xl bg-slate-900/70 border border-slate-800/70 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="subtotal" className="text-xs text-slate-400">Subtotal</Label>
          <div className="mt-2 relative">
            <Input
              id="subtotal"
              name="subtotal"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={activeFormData.subtotal}
              onChange={e => {
                const value = e.target.value;
                if (/^[\d.,]*$/.test(value) || value === '') {
                  handleFormInputChange(e);
                }
              }}
              onBlur={e => {
                const value = e.target.value.replace(',', '.');
                const parsed = parseFloat(value);
                if (!isNaN(parsed)) {
                  handleFormInputChange({ target: { name: 'subtotal', value: parsed.toFixed(2) } });
                }
              }}
              className="w-full bg-slate-950/60 border border-slate-800 text-white text-right pr-10 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              {getCurrencySymbol(activeFormData.currency)}
            </span>
          </div>
        </div>
        <div>
          <Label htmlFor="tax" className="text-xs text-slate-400">Tax</Label>
          <div className="mt-2 relative">
            <Input
              id="tax"
              name="tax"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={activeFormData.tax || ''}
              onChange={e => {
                const value = e.target.value;
                if (/^[\d.,]*$/.test(value) || value === '') {
                  handleFormInputChange(e);
                }
              }}
              onBlur={e => {
                const value = e.target.value.replace(',', '.');
                const parsed = parseFloat(value);
                if (!isNaN(parsed)) {
                  handleFormInputChange({ target: { name: 'tax', value: parsed.toFixed(2) } });
                }
              }}
              className="w-full bg-slate-950/60 border border-slate-800 text-white text-right pr-10 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              {getCurrencySymbol(activeFormData.currency)}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl bg-slate-950/50 border border-slate-800 px-3 py-3">
        <div>
          <div className="text-sm font-medium text-white">Business</div>
          <div className="text-xs text-slate-400">Used for exports</div>
        </div>
        <Switch
          checked={!!activeFormData.isBusiness}
          onCheckedChange={(val) => handleFormInputChange({ target: { name: 'isBusiness', value: val } })}
        />
      </div>
    </div>
  </div>
);


export default function ReceiptFormModal({
  open,
  onOpenChange,
  handleSaveReceiptSubmit,
  handleCloseReceiptForm,
  editingReceipt,
  isBusy,
  isEditMode,
  activeFormData,
  formErrors,
  settings,
  categories,
  supportedCurrencies,
  getCurrencySymbol,
  merchantInputRef,
  handleFormInputChange,
  handleItemInputChange,
  handleAddItemField,
  handleRemoveItemField,
  onRequestDelete,
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          handleCloseReceiptForm();
        }
        onOpenChange(value);
      }}
    >
      <DialogContent
        className="w-[94vw] max-w-lg bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-white border border-slate-800/60 p-0 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] z-50"
        style={{ touchAction: 'manipulation', backdropFilter: 'blur(10px)' }}
        onPointerDownOutside={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
      >
        <VisuallyHidden>
          <DialogTitle>{editingReceipt ? 'Edit receipt' : 'Add receipt'}</DialogTitle>
          <DialogDescription>
            {editingReceipt
              ? 'Update receipt details, items, and notes.'
              : 'Enter receipt details, items, and notes.'}
          </DialogDescription>
        </VisuallyHidden>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSaveReceiptSubmit();
          }}
          autoComplete="off"
          className="flex flex-col max-h-[92vh]"
        >
          <ReceiptFormHeader
            editingReceipt={editingReceipt}
            isBusy={isBusy}
            onClose={handleCloseReceiptForm}
          />
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {isEditMode && (
              <ReceiptFormEditFields
                activeFormData={activeFormData}
                editingReceipt={editingReceipt}
                formErrors={formErrors}
                settings={settings}
                categories={categories}
                getCurrencySymbol={getCurrencySymbol}
                merchantInputRef={merchantInputRef}
                handleFormInputChange={handleFormInputChange}
                handleItemInputChange={handleItemInputChange}
                handleAddItemField={handleAddItemField}
                handleRemoveItemField={handleRemoveItemField}
                supportedCurrencies={supportedCurrencies}
              />
            )}
            {!isEditMode && (
              <ReceiptFormCreateFields
                activeFormData={activeFormData}
                editingReceipt={editingReceipt}
                formErrors={formErrors}
                settings={settings}
                categories={categories}
                supportedCurrencies={supportedCurrencies}
                getCurrencySymbol={getCurrencySymbol}
                merchantInputRef={merchantInputRef}
                handleFormInputChange={handleFormInputChange}
                handleItemInputChange={handleItemInputChange}
                handleAddItemField={handleAddItemField}
                handleRemoveItemField={handleRemoveItemField}
              />
            )}
          </div>
          <ReceiptFormFooter
            editingReceipt={editingReceipt}
            isBusy={isBusy}
            onRequestDelete={onRequestDelete}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
