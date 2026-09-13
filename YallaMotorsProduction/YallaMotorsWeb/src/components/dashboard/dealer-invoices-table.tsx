import * as React from 'react';
import { FileText, Receipt, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatMoneyFromCents } from '@/i18n/format';
import type { AppLocale } from '@/i18n/config';
import type { VendorInvoiceItemSummary, VendorBillingInvoiceStatus } from '@/types/billing';

interface DealerInvoicesTableProps {
  invoices: VendorInvoiceItemSummary[];
  locale: AppLocale;
}

function getStatusBadge(status: VendorBillingInvoiceStatus, ar: boolean) {
  switch (status) {
    case 'PAID':
      return (
        <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1">
          <CheckCircle className="h-3 w-3" />
          {ar ? 'مدفوعة' : 'Paid'}
        </Badge>
      );
    case 'OVERDUE':
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" />
          {ar ? 'متأخرة' : 'Overdue'}
        </Badge>
      );
    case 'OPEN':
      return (
        <Badge variant="secondary" className="gap-1 text-amber-600 bg-amber-50">
          <Clock className="h-3 w-3" />
          {ar ? 'مستحقة' : 'Due'}
        </Badge>
      );
    case 'VOID':
      return (
        <Badge variant="outline" className="text-muted-foreground">
          {ar ? 'ملغاة' : 'Void'}
        </Badge>
      );
  }
}

export function DealerInvoicesTable({ invoices, locale }: DealerInvoicesTableProps) {
  const ar = locale === 'ar';

  if (!invoices || invoices.length === 0) {
    return (
      <Card data-testid="dealer-invoices-empty">
        <CardHeader>
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            {ar ? 'سجل الفواتير والمعاملات' : 'Invoices & Billing History'}
          </CardTitle>
          <CardDescription>
            {ar ? 'عرض سجل الفواتير والمبالغ المستحقة' : 'View past invoices and outstanding balances'}
          </CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          {ar ? 'لا توجد فواتير مسجلة لهذا الحساب حالياً.' : 'No invoices recorded for this account.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="dealer-invoices-card">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          {ar ? 'سجل الفواتير والمعاملات' : 'Invoices & Billing History'}
        </CardTitle>
        <CardDescription>
          {ar ? 'عرض سجل الفواتير الشهرية، المبالغ والتواريخ' : 'Monthly invoices, due dates, and settlement status'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table data-testid="dealer-invoices-table">
          <TableHeader>
            <TableRow>
              <TableHead>{ar ? 'رقم الفاتورة' : 'Invoice #'}</TableHead>
              <TableHead>{ar ? 'تاريخ الإصدار' : 'Issue Date'}</TableHead>
              <TableHead>{ar ? 'تاريخ الاستحقاق' : 'Due Date'}</TableHead>
              <TableHead>{ar ? 'الحالة' : 'Status'}</TableHead>
              <TableHead className="text-end">{ar ? 'المبلغ الإجمالي' : 'Total Amount'}</TableHead>
              <TableHead className="text-end">{ar ? 'المتبقي للسداد' : 'Balance Due'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((inv) => (
              <TableRow key={inv.publicId} data-testid={`invoice-row-${inv.publicId}`}>
                <TableCell className="font-mono text-xs font-semibold flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  {inv.invoiceNumber}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(inv.issuedAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(inv.dueAt).toLocaleDateString(ar ? 'ar-EG' : 'en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </TableCell>
                <TableCell>{getStatusBadge(inv.status, ar)}</TableCell>
                <TableCell className="text-end font-medium">
                  {formatMoneyFromCents(inv.totalAmountCents, inv.currency, locale)}
                </TableCell>
                <TableCell className="text-end font-semibold">
                  <span className={inv.balanceDueCents > 0 ? 'text-amber-600' : 'text-muted-foreground'}>
                    {formatMoneyFromCents(inv.balanceDueCents, inv.currency, locale)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
