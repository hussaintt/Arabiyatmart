'use client';

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { useForm } from 'react-hook-form';

// Polyfills for JSDOM
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

// Import primitives
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
} from '@/components/ui/toast';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

describe('UI Primitives — TASK-003 Acceptance Suite', () => {
  describe('Static RSC-compatible Primitives', () => {
    it('renders Button with variants, sizes, and accessible name', () => {
      render(
        <Button variant="brand" size="lg" disabled={false}>
          حفظ التغييرات
        </Button>
      );
      const btn = screen.getByRole('button', { name: 'حفظ التغييرات' });
      expect(btn).toBeInTheDocument();
      expect(btn).not.toBeDisabled();
      expect(btn.className).toContain('min-w-0');
      expect(btn.className).toContain('shadow-brand');
    });

    it('renders Card with header, content, and min-w-0 constraint', () => {
      render(
        <Card data-testid="card-box">
          <CardHeader>
            <CardTitle>تويوتا كورولا 2024</CardTitle>
            <CardDescription>حالة ممتازة - فابريكا بالكامل</CardDescription>
          </CardHeader>
          <CardContent>
            <p>السعر: 1,200,000 ج.م</p>
          </CardContent>
        </Card>
      );
      const card = screen.getByTestId('card-box');
      expect(card.className).toContain('min-w-0');
      expect(screen.getByText('تويوتا كورولا 2024')).toBeInTheDocument();
      expect(screen.getByText('حالة ممتازة - فابريكا بالكامل')).toBeInTheDocument();
    });

    it('renders Badge with semantic variants', () => {
      render(<Badge variant="orange">مميز</Badge>);
      const badge = screen.getByText('مميز');
      expect(badge).toBeInTheDocument();
      expect(badge.className).toContain('bg-orange');
    });

    it('renders Progress with accessible progressbar attributes', () => {
      render(<Progress value={65} max={100} data-testid="progress-bar" />);
      const progress = screen.getByRole('progressbar');
      expect(progress).toHaveAttribute('aria-valuenow', '65');
      expect(progress).toHaveAttribute('aria-valuemin', '0');
      expect(progress).toHaveAttribute('aria-valuemax', '100');
    });

    it('renders Separator with proper orientation and role', () => {
      const { rerender } = render(<Separator decorative={false} orientation="vertical" />);
      const sep = screen.getByRole('separator');
      expect(sep).toHaveAttribute('aria-orientation', 'vertical');

      rerender(<Separator decorative={true} orientation="horizontal" />);
      expect(screen.queryByRole('separator')).toBeNull();
    });

    it('renders Alert with title, description, and text-start', () => {
      render(
        <Alert variant="destructive">
          <AlertTitle>خطأ في المعاملة</AlertTitle>
          <AlertDescription>يرجى التأكد من البيانات والمحاولة مرة أخرى.</AlertDescription>
        </Alert>
      );
      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('text-start');
      expect(alert.className).toContain('min-w-0');
      expect(screen.getByText('خطأ في المعاملة')).toBeInTheDocument();
    });

    it('renders Avatar and fallback', () => {
      render(
        <Avatar>
          <AvatarImage src="/test.jpg" alt="المستخدم" />
          <AvatarFallback>ع م</AvatarFallback>
        </Avatar>
      );
      expect(screen.getByAltText('المستخدم')).toBeInTheDocument();
      expect(screen.getByText('ع م')).toBeInTheDocument();
    });

    it('renders Skeleton with pulse animation and min-w-0', () => {
      render(<Skeleton data-testid="skel" className="h-6 w-24" />);
      const skel = screen.getByTestId('skel');
      expect(skel.className).toContain('animate-pulse');
      expect(skel.className).toContain('min-w-0');
    });

    it('renders Table with accessible headers and text-start alignment', () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الموديل</TableHead>
              <TableHead>السنة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>كامري</TableCell>
              <TableCell>2023</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );
      expect(screen.getByText('الموديل')).toHaveClass('text-start');
      expect(screen.getByText('كامري')).toHaveClass('text-start');
    });

    it('renders Textarea with placeholder, text-start, and min-w-0 constraint', () => {
      render(
        <Textarea placeholder="أدخل تفاصيل السيارة" data-testid="car-desc" />
      );
      const textarea = screen.getByPlaceholderText('أدخل تفاصيل السيارة');
      expect(textarea).toBeInTheDocument();
      expect(textarea.className).toContain('min-w-0');
      expect(textarea.className).toContain('text-start');
    });
  });

  describe('RTL & Layout Adaptations', () => {
    it('renders Pagination with chevron rotation in RTL mode', () => {
      render(
        <div dir="rtl">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious label="السابق" href="#prev" />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext label="التالي" href="#next" />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      );
      const prev = screen.getByLabelText('Go to previous page');
      const next = screen.getByLabelText('Go to next page');
      expect(prev).toBeInTheDocument();
      expect(next).toBeInTheDocument();

      const prevSvg = prev.querySelector('svg');
      const nextSvg = next.querySelector('svg');
      expect(prevSvg?.className.baseVal ?? prevSvg?.getAttribute('class')).toContain('rtl:rotate-180');
      expect(nextSvg?.className.baseVal ?? nextSvg?.getAttribute('class')).toContain('rtl:rotate-180');
    });

    it('renders Switch with RTL translation class', () => {
      render(
        <div dir="rtl">
          <Switch aria-label="تفعيل الإشعارات" />
        </div>
      );
      const sw = screen.getByRole('switch', { name: 'تفعيل الإشعارات' });
      expect(sw).toBeInTheDocument();
      const thumb = sw.querySelector('span');
      expect(thumb?.className).toContain('rtl:data-[state=checked]:-translate-x-5');
    });
  });

  describe('Interactive Controls & Form Linkage', () => {
    function FormWithValidationError() {
      const form = useForm<{ email: string }>({
        defaultValues: { email: '' },
        mode: 'onSubmit',
      });

      return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(() => {}, () => {})}>
            <FormField
              control={form.control}
              name="email"
              rules={{
                required: 'البريد الإلكتروني مطلوب للتحقق من الهوية',
              }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>البريد الإلكتروني</FormLabel>
                  <FormControl>
                    <Input placeholder="name@example.com" {...field} />
                  </FormControl>
                  <FormDescription>لن نشارك بريدك مع أي طرف ثالث.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">إرسال</Button>
          </form>
        </Form>
      );
    }

    it('links FormLabel, Input, FormDescription, and asserts aria-invalid and aria-describedby linkage to FormMessage on validation error', async () => {
      render(<FormWithValidationError />);

      const input = screen.getByPlaceholderText('name@example.com');
      const label = screen.getByText('البريد الإلكتروني');
      const desc = screen.getByText('لن نشارك بريدك مع أي طرف ثالث.');
      const descId = desc.getAttribute('id')!;

      // 1. Initial pristine state: no error, aria-invalid is false, aria-describedby links only description
      expect(input).toHaveAttribute('aria-invalid', 'false');
      expect(input.getAttribute('aria-describedby')).toBe(descId);
      expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
      expect(label).not.toHaveClass('text-destructive');
      expect(screen.queryByText('البريد الإلكتروني مطلوب للتحقق من الهوية')).toBeNull();

      // 2. Submit form with empty required field to trigger real react-hook-form validation error
      const submitBtn = screen.getByRole('button', { name: 'إرسال' });
      fireEvent.click(submitBtn);

      // 3. Wait for real validation error message to be rendered by FormMessage
      await waitFor(() => {
        expect(screen.getByText('البريد الإلكتروني مطلوب للتحقق من الهوية')).toBeInTheDocument();
      });

      const errorMsg = screen.getByText('البريد الإلكتروني مطلوب للتحقق من الهوية');
      const msgId = errorMsg.getAttribute('id')!;
      expect(msgId).toBeTruthy();

      // 4. Assert aria-invalid is now true
      expect(input).toHaveAttribute('aria-invalid', 'true');

      // 5. Assert aria-describedby links both the description and the rendered error message id
      const describedBy = input.getAttribute('aria-describedby')!;
      expect(describedBy).toContain(descId);
      expect(describedBy).toContain(msgId);

      // 6. Assert label reflects error state styling
      expect(label).toHaveClass('text-destructive');
    });

    it('renders Checkbox and toggles state with accessible focus', () => {
      const onCheckedChange = vi.fn();
      render(
        <Checkbox
          aria-label="الموافقة على الشروط والأحكام"
          onCheckedChange={onCheckedChange}
        />
      );
      const checkbox = screen.getByRole('checkbox', {
        name: 'الموافقة على الشروط والأحكام',
      });
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();

      fireEvent.click(checkbox);
      expect(onCheckedChange).toHaveBeenCalledWith(true);
    });

    it('renders RadioGroup and items with radiogroup semantics', () => {
      render(
        <RadioGroup defaultValue="new" aria-label="حالة السيارة">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="new" id="cond-new" />
            <Label htmlFor="cond-new">جديدة</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="used" id="cond-used" />
            <Label htmlFor="cond-used">مستعملة</Label>
          </div>
        </RadioGroup>
      );

      const radioGroup = screen.getByRole('radiogroup', { name: 'حالة السيارة' });
      expect(radioGroup).toBeInTheDocument();
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(2);
      expect(radios[0]).toBeChecked();
      expect(radios[1]).not.toBeChecked();
    });

    it('renders Tabs and activates corresponding tab content', () => {
      render(
        <Tabs defaultValue="specs">
          <TabsList>
            <TabsTrigger value="specs">المواصفات</TabsTrigger>
            <TabsTrigger value="pricing">الأسعار</TabsTrigger>
          </TabsList>
          <TabsContent value="specs">تفاصيل المحرك والأبعاد</TabsContent>
          <TabsContent value="pricing">جدول الأسعار والتقسيط</TabsContent>
        </Tabs>
      );

      const tab1 = screen.getByRole('tab', { name: 'المواصفات' });
      const tab2 = screen.getByRole('tab', { name: 'الأسعار' });
      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('تفاصيل المحرك والأبعاد')).toBeInTheDocument();

      fireEvent.mouseDown(tab2, { button: 0, ctrlKey: false });
      expect(tab2).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('جدول الأسعار والتقسيط')).toBeInTheDocument();
    });

    it('renders Slider with accessible role', () => {
      render(<Slider defaultValue={[50]} max={100} step={1} aria-label="أقصى مسافة" />);
      const slider = screen.getByRole('slider', { name: 'أقصى مسافة' });
      expect(slider).toBeInTheDocument();
      expect(slider).toHaveAttribute('aria-valuenow', '50');
    });

    it('renders Command palette with input and list', () => {
      render(
        <Command>
          <CommandInput placeholder="ابحث عن ماركة أو موديل..." />
          <CommandList>
            <CommandEmpty>لا توجد نتائج</CommandEmpty>
            <CommandGroup heading="الماركات">
              <CommandItem>مرسيدس</CommandItem>
              <CommandItem>بي إم دبليو</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      );
      expect(screen.getByPlaceholderText('ابحث عن ماركة أو موديل...')).toBeInTheDocument();
      expect(screen.getByText('مرسيدس')).toBeInTheDocument();
    });
  });

  describe('Overlay Focus Trapping, Dismissal & Return', () => {
    it('opens Dialog, verifies focus trapping, closes via Escape, and asserts focus return to invoking trigger', async () => {
      render(
        <div>
          <button id="outside-dialog-btn" type="button">
            زر خارج الحاوية
          </button>
          <Dialog>
            <DialogTrigger asChild>
              <Button>فتح النافذة</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle>تأكيد الحذف</DialogTitle>
              <DialogDescription>هل أنت متأكد من رغبتك في حذف الإعلان؟</DialogDescription>
              <button id="dialog-confirm">تأكيد نهائي</button>
            </DialogContent>
          </Dialog>
        </div>
      );

      const triggerBtn = screen.getByRole('button', { name: 'فتح النافذة' });
      const outsideBtn = document.getElementById('outside-dialog-btn') as HTMLButtonElement;
      triggerBtn.focus();
      expect(document.activeElement).toBe(triggerBtn);

      fireEvent.click(triggerBtn);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      expect(screen.getByText('تأكيد الحذف')).toBeInTheDocument();
      expect(screen.getByText('هل أنت متأكد من رغبتك في حذف الإعلان؟')).toBeInTheDocument();

      // 1. Assert initial focus is placed inside the dialog
      await waitFor(() => {
        expect(dialog.contains(document.activeElement)).toBe(true);
      });

      // 2. Real focus trap assertion: attempt to move focus to outside control while dialog is open
      outsideBtn.focus();
      fireEvent.focusIn(outsideBtn);

      // Assert Radix FocusScope intercepts and redirects/restores focus back inside the dialog
      expect(document.activeElement).not.toBe(outsideBtn);
      expect(dialog.contains(document.activeElement)).toBe(true);

      // Also exercise internal controls
      const confirmBtn = screen.getByRole('button', { name: 'تأكيد نهائي' });
      const closeBtn = screen.getByRole('button', { name: 'Close' });

      confirmBtn.focus();
      expect(document.activeElement).toBe(confirmBtn);
      expect(dialog.contains(document.activeElement)).toBe(true);

      // Attempt to move focus outside again
      outsideBtn.focus();
      fireEvent.focusIn(outsideBtn);
      expect(document.activeElement).not.toBe(outsideBtn);
      expect(dialog.contains(document.activeElement)).toBe(true);

      // 3. Press Escape to dismiss the dialog
      fireEvent.keyDown(closeBtn, { key: 'Escape', code: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });

      // 4. Assert focus returned to the invoking trigger button
      await waitFor(() => {
        expect(document.activeElement).toBe(triggerBtn);
      });
    });

    it('opens AlertDialog, exercises focus trap, closes via Cancel, and asserts focus return to invoking trigger', async () => {
      render(
        <div>
          <button id="outside-alert-btn" type="button">
            زر خارج التنبيه
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">حذف الحساب</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>تنبيه أمني هام</AlertDialogTitle>
              <AlertDialogDescription>لا يمكن التراجع عن هذه الخطوة.</AlertDialogDescription>
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction>متابعة الحذف</AlertDialogAction>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      );

      const trigger = screen.getByRole('button', { name: 'حذف الحساب' });
      const outsideBtn = document.getElementById('outside-alert-btn') as HTMLButtonElement;
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
      });

      const alertDialog = screen.getByRole('alertdialog');

      // 1. Assert initial focus is placed inside the alert dialog
      await waitFor(() => {
        expect(alertDialog.contains(document.activeElement)).toBe(true);
      });

      // 2. Real focus trap assertion: attempt to move focus to outside control while alert dialog is open
      outsideBtn.focus();
      fireEvent.focusIn(outsideBtn);

      // Assert Radix FocusScope intercepts and redirects/restores focus back inside the alert dialog
      expect(document.activeElement).not.toBe(outsideBtn);
      expect(alertDialog.contains(document.activeElement)).toBe(true);

      // 3. Exercise focus movement between interactive elements inside alert dialog
      const cancelBtn = screen.getByRole('button', { name: 'إلغاء' });
      const actionBtn = screen.getByRole('button', { name: 'متابعة الحذف' });

      actionBtn.focus();
      expect(document.activeElement).toBe(actionBtn);
      expect(alertDialog.contains(document.activeElement)).toBe(true);

      // Attempt to move focus outside again
      outsideBtn.focus();
      fireEvent.focusIn(outsideBtn);
      expect(document.activeElement).not.toBe(outsideBtn);
      expect(alertDialog.contains(document.activeElement)).toBe(true);

      // 4. Click Cancel to dismiss
      fireEvent.click(cancelBtn);

      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).toBeNull();
      });

      // 5. Assert focus returned to the invoking trigger button
      await waitFor(() => {
        expect(document.activeElement).toBe(trigger);
      });
    });

    it('renders Drawer with accessible structure', () => {
      render(
        <Drawer>
          <DrawerTrigger asChild>
            <Button>درج التفاصيل</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>تفاصيل المعاينة</DrawerTitle>
              <DrawerDescription>معلومات الفحص الفني</DrawerDescription>
            </DrawerHeader>
          </DrawerContent>
        </Drawer>
      );
      expect(screen.getByRole('button', { name: 'درج التفاصيل' })).toBeInTheDocument();
    });

    it('renders DropdownMenu and allows item selection', async () => {
      const onSelect = vi.fn();
      render(
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger asChild>
            <Button>خيارات</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onSelect}>تعديل السعر</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );

      await waitFor(() => {
        expect(screen.getByRole('menu')).toBeInTheDocument();
      });

      const item = screen.getByRole('menuitem', { name: 'تعديل السعر' });
      fireEvent.click(item);
      expect(onSelect).toHaveBeenCalled();
    });

    it('renders Select and shows trigger with placeholder', () => {
      render(
        <Select defaultValue="cairo">
          <SelectTrigger aria-label="اختر المدينة">
            <SelectValue placeholder="اختر المدينة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cairo">القاهرة</SelectItem>
            <SelectItem value="giza">الجيزة</SelectItem>
          </SelectContent>
        </Select>
      );

      const trigger = screen.getByRole('combobox', { name: 'اختر المدينة' });
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveTextContent('القاهرة');
    });

    it('renders Sheet with start/end side support', async () => {
      render(
        <Sheet>
          <SheetTrigger asChild>
            <Button>فتح الفلاتر</Button>
          </SheetTrigger>
          <SheetContent side="start">
            <SheetTitle>الفلاتر المتقدمة</SheetTitle>
            <SheetDescription>تصفية نتائج البحث حسب الفئة والسعر</SheetDescription>
          </SheetContent>
        </Sheet>
      );

      const trigger = screen.getByRole('button', { name: 'فتح الفلاتر' });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });
      expect(screen.getByText('الفلاتر المتقدمة')).toBeInTheDocument();
    });

    it('renders Tooltip with trigger and provider', () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" aria-label="مساعدة">؟</Button>
            </TooltipTrigger>
            <TooltipContent>معلومات إضافية عن الفحص الفني</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );

      const trigger = screen.getByRole('button', { name: 'مساعدة' });
      expect(trigger).toBeInTheDocument();
    });

    it('renders Toast within ToastProvider with accessible close control', () => {
      render(
        <ToastProvider>
          <Toast open={true}>
            <ToastTitle>تم الحفظ بنجاح</ToastTitle>
            <ToastDescription>تم تحديث بيانات السيارة في النظام</ToastDescription>
            <ToastClose />
          </Toast>
          <ToastViewport />
        </ToastProvider>
      );

      expect(screen.getByText('تم الحفظ بنجاح')).toBeInTheDocument();
      expect(screen.getByText('تم تحديث بيانات السيارة في النظام')).toBeInTheDocument();
      const closeBtn = screen.getByRole('button', { name: 'إغلاق' });
      expect(closeBtn).toBeInTheDocument();
    });
  });
});
