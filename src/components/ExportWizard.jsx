import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function ExportWizard({ onBack, preselectedReceipts = null, onClearSelection, onGoFix }) {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0,7));
  const [receipts, setReceipts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState({ total: 0, valid: 0, needsFix: 0 });
  const [format, setFormat] = useState('moneyS4_csv');

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      setIsLoading(true);
      setError(null);
      try {
        const snap = await getDocs(collection(db, 'users', user.uid, 'receipts'));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setReceipts(list);
      } catch (e) {
        setError(e.message || 'Failed to load receipts');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [user]);

  const monthReceipts = useMemo(() => {
    const [y,m] = month.split('-').map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    const inMonth = (r) => {
      const d = r.transactionDate?.toDate ? r.transactionDate.toDate() : (r.transactionDate ? new Date(r.transactionDate) : (r.date?.toDate ? r.date.toDate() : (r.date ? new Date(r.date) : null)));
      if (!d || isNaN(d)) return false;
      return d >= start && d <= end;
    };
    const base = preselectedReceipts ? receipts.filter(r => preselectedReceipts.includes(r.id)) : receipts.filter(inMonth);
    // Needs-fix if missing merchant/date/total
    const isValid = (r) => !!r.merchant && !!r.total && (r.transactionDate || r.date);
    const valid = base.filter(isValid);
    const needsFix = base.filter(r => !isValid(r));
    setSummary({ total: base.length, valid: valid.length, needsFix: needsFix.length });
    return { base, valid, needsFix };
  }, [receipts, month, preselectedReceipts]);

  const quickMonths = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return { key: d.toISOString().slice(0,7), label: d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) };
    });
  }, []);

  const handleGenerate = async () => {
    if (format.startsWith('moneyS4')) {
      const { generateMoneyS4CSV } = await import('@/data/exporters/moneyS4');
      const csv = generateMoneyS4CSV(monthReceipts.valid);
      const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ReceipTrack_MoneyS4_Receipts_${month}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="w-full flex justify-center">
      <Card className="w-full max-w-2xl bg-slate-800/90 text-white border border-blue-900/40">
        <CardHeader>
          <CardTitle className="text-blue-100">Exports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {quickMonths.map(m => (
              <Button key={m.key} variant={m.key === month ? 'default' : 'outline'} onClick={() => setMonth(m.key)} className={m.key === month ? '' : 'bg-transparent border-blue-700 text-blue-200 hover:bg-blue-900/40'}>
                {m.label}
              </Button>
            ))}
            <div className="ml-auto">
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="w-56 bg-slate-900 border-blue-700 text-blue-100">
                  <SelectValue placeholder="Select preset" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-white border-blue-700">
                  <SelectItem value="moneyS4_csv">Money S4 (CSV)</SelectItem>
                  <SelectItem value="moneyS4_xlsx" disabled>Money S4 (XLSX) — soon</SelectItem>
                  <SelectItem value="accountant_pdf" disabled>Accountant PDF pack — soon</SelectItem>
                  <SelectItem value="raw_csv" disabled>Raw CSV — soon</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="text-blue-200">
            {summary.total} receipts → {summary.valid} valid, {summary.needsFix} need fix. {summary.needsFix > 0 && (
              <Button variant="link" className="text-blue-300 underline px-1" onClick={onGoFix}>Fix remaining</Button>
            )}
          </div>

          {preselectedReceipts && (
            <div className="text-xs text-blue-300/80">Using selected receipts. <Button variant="link" className="px-1" onClick={onClearSelection}>Clear</Button></div>
          )}

          <div className="flex gap-3 pt-2">
            <Button onClick={onBack} variant="outline" className="bg-transparent border-blue-700 text-blue-200 hover:bg-blue-900/40">Back</Button>
            <Button onClick={handleGenerate} className="bg-blue-600 hover:bg-blue-500">Generate</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


