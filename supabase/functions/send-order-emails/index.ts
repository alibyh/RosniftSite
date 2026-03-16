/// <reference path="./deno.d.ts" />
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.10.0';

type OrderItem = {
  id: string;
  balanceUnit: string;
  companyName: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  unit: string;
  costRub: number;
  warehouseAddress: string;
};

type Payload = {
  requester: {
    id: string;
    fullName: string;
    email: string;
    companyId: string;
    companyName: string;
  };
  destinationWarehouse: string;
  items: OrderItem[];
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Insert zero‑width spaces between characters to prevent auto‑linking in some mail clients,
// while still rendering as a normal-looking number.
function breakAutoLink(value: string): string {
  if (!value) return '';
  return value.split('').join('&#8203;');
}

function buildMessageForCompany(
  balanceUnit: string,
  companyName: string,
  items: OrderItem[],
  payload: Payload
): string {
  const itemBlocks = items
    .map((item) =>
      [
        item.materialCode || '-',
        item.materialName || '-',
        String(item.quantity),
        `${formatMoney(item.costRub)} руб.`,
        item.warehouseAddress || '-',
      ].join('\n')
    )
    .join('\n\n');

  return [
    'Вам направлен запрос на закупку следующих МПЗ:',
    '',
    itemBlocks,
    '',
    'Необходимо подтверждение наличия запрашиваемых МПЗ.',
    '',
    `Заказчик - БЕ ${payload.requester.companyId || '-'}, ${payload.requester.companyName || '-'}. Ответственный - ${payload.requester.fullName || '-'}, e-mail ${payload.requester.email || '-'}.`,
  ].join('\n');
}

function buildHtmlMessageForCompany(
  balanceUnit: string,
  companyName: string,
  items: OrderItem[],
  payload: Payload
): string {
  const rowsHtml = items
    .map((item) => {
      const qtyOnly = String(item.quantity);
      const price = `${formatMoney(item.costRub)} руб.`;
      return `
        <tr>
          <td style="border:1px solid #444;padding:10px 12px;">${
            item.materialCode ? breakAutoLink(item.materialCode) : '-'
          }</td>
          <td style="border:1px solid #444;padding:10px 12px;">${item.materialName || '-'}</td>
          <td style="border:1px solid #444;padding:10px 12px;">${qtyOnly}</td>
          <td style="border:1px solid #444;padding:10px 12px;">${price}</td>
          <td style="border:1px solid #444;padding:10px 12px;">${item.warehouseAddress || '-'}</td>
        </tr>
      `;
    })
    .join('');

  const destination = payload.destinationWarehouse || '-';
  const requesterCompanyId = payload.requester.companyId || '-';
  const requesterCompanyName = payload.requester.companyName || '-';
  const requesterName = payload.requester.fullName || '-';
  const requesterEmail = payload.requester.email || '-';

  return `
<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>Заявка на перераспределение МПЗ</title>
  </head>
  <body style="margin:0;padding:0;background-color:#111111;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#ffffff;">
    <div style="max-width:800px;margin:0 auto;padding:24px 16px;">
      <h2 style="margin:0 0 16px 0;color:#ffffff;font-weight:600;font-size:18px;">
        Заявка на перераспределение МПЗ
      </h2>
      <p style="margin:0 0 16px 0;color:#e0e0e0;font-size:14px;line-height:1.5;">
        Вам направлен запрос на закупку следующих МПЗ:
      </p>

      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #444444;background-color:#181818;font-size:13px;">
        <thead>
          <tr>
            <th style="border:1px solid #444444;padding:10px 12px;color:#ffffff;font-weight:500;text-align:left;">КОД КСМ</th>
            <th style="border:1px solid #444444;padding:10px 12px;color:#ffffff;font-weight:500;text-align:left;">Наименование материала</th>
            <th style="border:1px solid #444444;padding:10px 12px;color:#ffffff;font-weight:500;text-align:left;">Количество</th>
            <th style="border:1px solid #444444;padding:10px 12px;color:#ffffff;font-weight:500;text-align:left;">Стоимость с учетом рентабельности, руб.</th>
            <th style="border:1px solid #444444;padding:10px 12px;color:#ffffff;font-weight:500;text-align:left;">Адрес склада</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <p style="margin:18px 0 8px 0;color:#e0e0e0;font-size:14px;line-height:1.5;">
        Необходимо подтверждение наличия запрашиваемых МПЗ.
      </p>

      <p style="margin:0 0 4px 0;color:#e0e0e0;font-size:13px;line-height:1.5;">
        <strong>Адрес назначения (куда):</strong> ${destination}
      </p>

      <p style="margin:8px 0 4px 0;color:#e0e0e0;font-size:13px;line-height:1.5;">
        <strong>Заказчик – БЕ:</strong> ${requesterCompanyId}, ${requesterCompanyName}
      </p>
      <p style="margin:0 0 4px 0;color:#e0e0e0;font-size:13px;line-height:1.5;">
        <strong>Ответственный:</strong> ${requesterName}, e-mail ${requesterEmail}
      </p>

      <p style="margin:8px 0 0 0;color:#9e9e9e;font-size:12px;line-height:1.5;">
        БЕ поставщика – ${balanceUnit || '-'}, ${companyName || '-'}.
      </p>
    </div>
  </body>
</html>
  `.trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let payload: Payload;
    try {
      payload = (await req.json()) as Payload;
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload?.requester) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing requester' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!payload.requester.email?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing requester email. Log out and log in again so your profile includes email.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!Array.isArray(payload.items) || payload.items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No items in order' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const yandexUser = Deno.env.get('YANDEX_SMTP_USER') ?? '';
    const yandexPass = Deno.env.get('YANDEX_SMTP_PASS') ?? '';
    const fromEmail = Deno.env.get('YANDEX_FROM_EMAIL') ?? yandexUser;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase service role configuration');
    }
    if (!yandexUser || !yandexPass || !fromEmail) {
      throw new Error('Missing Yandex SMTP configuration (YANDEX_SMTP_USER, YANDEX_SMTP_PASS, YANDEX_FROM_EMAIL)');
    }

    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient(supabaseUrl, serviceRoleKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Supabase client: ${msg}`);
    }

    const smtpHost = Deno.env.get('YANDEX_SMTP_HOST') ?? 'smtp.yandex.ru';
    const smtpPort = Number(Deno.env.get('YANDEX_SMTP_PORT') ?? '465');
    const smtpSecure = (Deno.env.get('YANDEX_SMTP_SECURE') ?? 'true') === 'true';

    let transporter: ReturnType<typeof nodemailer.createTransport>;
    try {
      transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: yandexUser,
          pass: yandexPass,
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`SMTP createTransport: ${msg}`);
    }

    const groups = new Map<string, OrderItem[]>();
    for (const item of payload.items) {
      const key = item.balanceUnit?.trim();
      if (!key) continue;
      const existing = groups.get(key) ?? [];
      existing.push(item);
      groups.set(key, existing);
    }

    const skipped: Array<{ balanceUnit: string; reason: string }> = [];
    let sentCount = 0;

    for (const [balanceUnit, items] of groups.entries()) {
      const { data: managers, error } = await supabase
        .from('app_users')
        .select('email, full_name, company_name, company_id')
        .eq('role', 'manager')
        .eq('company_id', balanceUnit);

      if (error) {
        skipped.push({ balanceUnit, reason: error.message });
        continue;
      }

      if (!managers?.length) {
        skipped.push({ balanceUnit, reason: 'Managers not found' });
        continue;
      }

      const companyName = items[0]?.companyName || managers[0]?.company_name || '';
      const subject = 'Заявка на перераспределение МПЗ';
      const text = buildMessageForCompany(balanceUnit, companyName, items, payload);
      const html = buildHtmlMessageForCompany(balanceUnit, companyName, items, payload);

      for (const manager of managers) {
        if (!manager.email) continue;

        try {
          await new Promise<void>((resolve, reject) => {
            transporter.sendMail(
              {
                from: fromEmail,
                to: manager.email,
                subject,
                text,
                html,
              },
              (err) => {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          sentCount += 1;
        } catch (mailErr) {
          const msg = mailErr instanceof Error ? mailErr.message : String(mailErr);
          const code = mailErr && typeof (mailErr as { code?: string }).code === 'string' ? (mailErr as { code: string }).code : '';
          skipped.push({ balanceUnit, reason: `SMTP error: ${msg}${code ? ` (${code})` : ''}` });
          console.error('SendMail error:', mailErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sentCount, skipped }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error && typeof (error as { code?: string }).code === 'string' ? (error as { code: string }).code : '';
    const cause = error instanceof Error ? (error as Error & { cause?: unknown }).cause : undefined;
    const detail = cause !== undefined ? ` | cause: ${cause}` : '';
    const body = JSON.stringify({
      success: false,
      error: message,
      ...(code ? { code } : {}),
      hint: message.includes('SMTP') || message.includes('ECONNREFUSED') || message.includes('ETIMEDOUT')
        ? 'Supabase Edge may block outbound SMTP ports (465/587). Consider using an HTTP email API (e.g. Resend) or a different host.'
        : undefined,
    });
    console.error('send-order-emails error:', message, code, detail);
    return new Response(body, {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
