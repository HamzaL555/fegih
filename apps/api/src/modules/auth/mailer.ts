import { env } from '../../config/env.js';

/**
 * Outbound email through Resend.
 *
 * With no `RESEND_API_KEY` the message is written to the server log and
 * `delivered: false` is returned, so local development and tests work without
 * an account. Nothing here ever throws: a failed email must not roll back the
 * order it was reporting on.
 */

export interface MailResult {
  delivered: boolean;
  /** Populated in development so a tester can follow the link directly. */
  preview?: string;
}

async function send(to: string, subject: string, html: string): Promise<MailResult> {
  if (!env.RESEND_API_KEY) {
    console.info(`[mail:development] -> ${to}\n[mail:development] ${subject}\n${html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`);
    return { delivered: false, preview: subject };
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.RESEND_FROM_EMAIL, to: [to], subject, html }),
    });
    if (!response.ok) {
      console.error(`[mail] Resend ${response.status} for ${to}: ${await response.text()}`);
      return { delivered: false };
    }
    return { delivered: true };
  } catch (error) {
    console.error(`[mail] failed for ${to}:`, error);
    return { delivered: false };
  }
}

export async function sendPasswordResetEmail(to: string, resetToken: string) {
  const resetUrl = `${env.APP_PUBLIC_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const result = await send(
    to,
    'Fegih hesabınız üçün parolunuzu yeniləyin',
    `<p>Salam,</p><p>Parolunuzu yeniləmək üçün aşağıdakı keçiddən istifadə edin:</p><p><a href="${resetUrl}">Parolu yenilə</a></p><p>Bu sorğu 30 dəqiqə ərzində etibarlıdır.</p>`,
  );
  return { ...result, resetUrl };
}

const money = (amount: number) => `${new Intl.NumberFormat('az-AZ').format(amount)} AZN`;

/** Where a cash-on-delivery / bank-transfer order is reported to the shop. */
export function orderNotificationAddress(): string {
  return env.ORDER_NOTIFICATION_EMAIL || env.ADMIN_EMAIL;
}

/** One line of the order, as it should be read over the phone. */
export type OfflineOrderItem = {
  title: string;
  author?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

/**
 * Splits a full name into a first and a last name.
 *
 * The shop calls the customer and asks "müştəri adı?" — one string is not
 * enough for that. The last word is treated as the surname, which is the right
 * guess for both "Əli Məmmədov" and "Əli Əhməd oğlu Məmmədov".
 */
export function splitFullName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1]! };
}

/**
 * Sent for every offline payment (cash on delivery, bank transfer). Without
 * Stripe there is no card charge, so this is how the shop learns an order
 * exists.
 *
 * The body answers the four questions the shop asks before picking up the
 * phone: who is calling (first and last name), which number to call, which
 * books and how many, and how much to collect.
 */
export async function notifyOrderOffline(input: {
  to: string;
  orderNumber: string;
  total: number;
  method: 'CASH_ON_DELIVERY' | 'BANK_TRANSFER';
  customerName?: string | null;
  customerPhone?: string | null;
  city?: string | null;
  address?: string | null;
  itemCount: number;
  items?: OfflineOrderItem[];
}) {
  const label = input.method === 'CASH_ON_DELIVERY' ? 'Nağd ödəniş (kuryer)' : 'Bank köçürməsi';
  const { firstName, lastName } = splitFullName(input.customerName);

  const rows = [
    ['Sifariş nömrəsi', input.orderNumber],
    ['Ödəniş üsulu', label],
    ['Məbləğ', money(input.total)],
    ['Məhsul sayı', String(input.itemCount)],
    ['Ad', firstName || '-'],
    ['Soyad', lastName || '-'],
    ['Telefon', input.customerPhone || '-'],
    ['Şəhər', input.city || '-'],
    ['Ünvan', input.address || '-'],
  ]
    .map(([key, value]) => `<tr><td style="padding:6px 14px 6px 0;color:#6b7280">${key}</td><td style="padding:6px 0;font-weight:600">${value}</td></tr>`)
    .join('');

  // The order lines: which book, how many, at what price.
  const items = (input.items ?? [])
    .map(
      (item) => `<tr>
        <td style="padding:6px 14px 6px 0">${item.title}${item.author ? ` <span style="color:#6b7280">— ${item.author}</span>` : ''}</td>
        <td style="padding:6px 14px 6px 0;text-align:center">${item.quantity} ədəd</td>
        <td style="padding:6px 0;text-align:right">${money(item.totalPrice)}</td>
      </tr>`,
    )
    .join('');

  const itemsBlock = items
    ? `<h3 style="margin:20px 0 8px;font-size:15px">Alınan kitablar</h3>
      <table style="border-collapse:collapse;width:100%">${items}</table>`
    : '';

  // `tel:` so a phone client turns the number into a one-tap call.
  const callBlock = input.customerPhone
    ? `<p style="margin:0 0 16px"><a href="tel:${input.customerPhone}" style="display:inline-block;background:#0F766E;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:700">📞 ${input.customerPhone} — zəng et</a></p>`
    : '';

  return send(
    input.to,
    `Yeni sifariş: ${input.orderNumber} — ${money(input.total)}${input.customerPhone ? ` (${input.customerPhone})` : ''}`,
    `<div style="font-family:system-ui,sans-serif;max-width:560px">
  <h2 style="margin:0 0 4px">Yeni sifariş qeydə alındı</h2>
  <p style="margin:0 0 16px;color:#6b7280">${label} ilə ödəniş gözləyir. Müştəri ilə əlaqə saxlayın.</p>
  ${callBlock}
  <table style="border-collapse:collapse;width:100%">${rows}</table>
  ${itemsBlock}
</div>`,
  );
}

/** Sent when an offline order is marked paid by an admin. */
export async function notifyOfflineOrderPaid(input: {
  to: string;
  orderNumber: string;
  total: number;
  customerName?: string | null;
}) {
  return send(
    input.to,
    `Sifarişiniz təsdiqləndi: ${input.orderNumber}`,
    `<div style="font-family:system-ui,sans-serif;max-width:560px">
  <h2 style="margin:0 0 8px">Təşəkkür edirik!</h2>
  <p style="margin:0 0 12px">${input.customerName || 'Müştəri'}, <b>${input.orderNumber}</b> nömrəli sifarişiniz ödəniş alındı və təsdiqləndi.</p>
  <p style="margin:0;color:#6b7280">Məbləğ: <b>${money(input.total)}</b></p>
</div>`,
  );
}