# Supabase + Yandex Setup For Order Submission

This document explains, in detail, how to configure the current order-submission flow so that when a user clicks `Оформить заказ` in the cart:

1. the frontend sends the cart payload to a Supabase Edge Function
2. the Edge Function groups products by source `БЕ`
3. for each `БЕ`, it finds that company's managers in `app_users`
4. it sends one email per company manager group through Yandex SMTP

This guide is written for the code that already exists in this project.

---

## 1. What Has Already Been Implemented In The Code

The project already contains:

- Frontend submit flow in `src/components/Cart.tsx`
- Payload builder in `src/services/orderService.ts`
- Supabase client in `src/services/supabaseClient.ts`
- Edge Function in `supabase/functions/send-order-emails/index.ts`
- User table migration in `supabase/migrations/20250309_app_users.sql`

Current behavior:

- The cart sends the order to Supabase function `send-order-emails`
- The function groups items by `item.balanceUnit`
- Then it queries `app_users`
- It sends emails to users where:
  - `role = 'manager'`
  - `company_id = <source БЕ>`

Important: in the current implementation, the selected `БЕ` in the admin user form is being stored in `app_users.company_id`.  
That means:

- if a manager should receive emails for `БЕ = 1B54`
- then that manager's `company_id` must be exactly `1B54`

---

## 2. End-To-End Flow

When the user submits the order:

1. `Cart.tsx` collects all cart rows.
2. Each row is converted into:
   - `balanceUnit`
   - `companyName`
   - `materialCode`
   - `materialName`
   - `quantity`
   - `unit`
   - `costRub`
   - `warehouseAddress`
3. The requester info is attached:
   - requester full name
   - requester email
   - requester company id
   - requester company name
   - destination warehouse
4. The frontend calls:

```ts
supabase.functions.invoke('send-order-emails', { body: payload })
```

5. The Edge Function:
   - groups items by source `БЕ`
   - queries `app_users`
   - finds matching managers for each `БЕ`
   - builds one email body for each company
   - sends emails through Yandex SMTP

---

## 3. What You Need To Configure

You need to do work in 3 places:

1. Supabase database
2. Supabase Edge Functions / secrets
3. Yandex mailbox / SMTP

---

## 4. Supabase Database Requirements

### 4.1 `app_users` table must exist

The project expects this table:

- `username`
- `full_name`
- `email`
- `password_hash`
- `company_name`
- `company_id`
- `role`
- `warehouses`

The migration file is:

- `supabase/migrations/20250309_app_users.sql`

If you have not run it yet:

1. Open your Supabase project
2. Go to `SQL Editor`
3. Create a new query
4. Paste the contents of:
   - `supabase/migrations/20250309_app_users.sql`
5. Run it

### 4.2 Make sure manager rows are correct

For order emails to work, every manager who should receive emails must satisfy:

- `role = 'manager'`
- `company_id = <their source БЕ>`
- `email` is filled in

Example:

If products from company `1B54` should notify one manager, that manager record must look like:

```sql
role = 'manager'
company_id = '1B54'
email = 'manager@example.com'
```

If there are multiple managers for the same company, all of them will receive the email.

### 4.3 Quick SQL check

Run this in Supabase SQL Editor to verify managers:

```sql
select id, username, full_name, email, company_id, role
from app_users
where role = 'manager'
order by company_id, full_name;
```

What to verify:

- `email` is not empty
- `company_id` matches the exact `БЕ` values found in inventory/cart items

### 4.4 Check actual `БЕ` values in inventory

If you are unsure what values need to exist in `company_id`, run:

```sql
select distinct "БЕ"
from inventory
where "БЕ" is not null
order by "БЕ";
```

Now compare those values with:

```sql
select distinct company_id
from app_users
where role = 'manager'
order by company_id;
```

If the values do not match exactly, emails will be skipped for that company.

---

## 5. Yandex Mail Setup

The Edge Function uses SMTP, so you need a Yandex mailbox that is allowed to send mail through SMTP.

### 5.1 Create or choose a sender mailbox

Use a mailbox that will send all order emails, for example:

- `orders@your-domain.ru`
- or `yourname@yandex.ru`

You will use this mailbox as:

- SMTP username
- SMTP sender

### 5.2 Enable 2FA in Yandex

Yandex SMTP usually requires an app password, not the main account password.

Recommended setup:

1. Sign in to the Yandex account
2. Open account security settings
3. Enable 2-factor authentication if it is not enabled yet

### 5.3 Create an app password

Create a separate app password for SMTP/mail client access.

You will use:

- username: full Yandex email address
- password: generated app password

Do not use the normal mailbox password in Supabase secrets unless you are absolutely sure Yandex allows it for your account.  
App password is the safer and more standard option.

### 5.4 SMTP values

Use these values for Yandex SMTP:

- Host: `smtp.yandex.ru`
- Port: `465`
- Secure: `true`

Alternative configuration sometimes used:

- Host: `smtp.yandex.com`
- Port: `465`
- Secure: `true`

For this project, the code defaults to:

- `smtp.yandex.ru`
- `465`
- secure SSL/TLS

So unless you have a custom requirement, use those exact defaults.

---

## 6. Supabase Edge Function Setup

### 6.1 Install Supabase CLI locally

If you do not have it:

```bash
brew install supabase/tap/supabase
```

Or follow the official install instructions for your OS.

### 6.2 Log in to Supabase CLI

```bash
supabase login
```

This opens a browser and authorizes the CLI.

### 6.3 Link the local project to your Supabase project

Inside the project folder:

```bash
cd "/Users/alibyh/Desktop/Projects/Rosnefti site"
supabase link --project-ref iskrbtfvldfjsjsyejnp
```

Your project ref appears in your Supabase URL:

- `https://iskrbtfvldfjsjsyejnp.supabase.co`
- project ref = `iskrbtfvldfjsjsyejnp`

### 6.4 Set function secrets

The Edge Function reads these secrets:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `YANDEX_SMTP_USER`
- `YANDEX_SMTP_PASS`
- `YANDEX_FROM_EMAIL`
- optional:
  - `YANDEX_SMTP_HOST`
  - `YANDEX_SMTP_PORT`
  - `YANDEX_SMTP_SECURE`

Set them with CLI:

```bash
supabase secrets set \
  SUPABASE_URL=https://iskrbtfvldfjsjsyejnp.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlza3JidGZ2bGRmanNqc3llam5wIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjUzNDE3NywiZXhwIjoyMDc4MTEwMTc3fQ.tOwiOjXClmuPYZDcDlXRAH6FcBL1OtikZt_wbjmPk8k \
  YANDEX_SMTP_USER=notificatione@yandex.com \
  YANDEX_SMTP_PASS=wdylcbycflrxttsy \
  YANDEX_FROM_EMAIL=notificatione@yandex.com \
  YANDEX_SMTP_HOST=smtp.yandex.ru \
  YANDEX_SMTP_PORT=465 \
  YANDEX_SMTP_SECURE=true
```

Important:

- `SUPABASE_SERVICE_ROLE_KEY` must be the service role key, not the anon key
- never put the service role key in frontend `.env`
- never expose the Yandex SMTP password in frontend code

### 6.5 Where to get the service role key

In Supabase Dashboard:

1. Open the project
2. Go to `Project Settings`
3. Go to `API`
4. Copy:
   - Project URL
   - `service_role` key

Do not use:

- `anon` key

The function must use `service_role` so it can safely query `app_users` server-side.

---

## 7. Deploy The Edge Function

The function source already exists here:

- `supabase/functions/send-order-emails/index.ts`

Deploy it:

```bash
cd "/Users/alibyh/Desktop/Projects/Rosnefti site"
supabase functions deploy send-order-emails
```

If your project is not linked, deploy with explicit ref:

```bash
supabase functions deploy send-order-emails --project-ref iskrbtfvldfjsjsyejnp
```

### 7.1 Verify deployment

In Supabase Dashboard:

1. Open `Edge Functions`
2. Find `send-order-emails`
3. Confirm status is healthy / deployed

---

## 8. Recommended Local Testing Before Production

### 8.1 Create a local env file for function testing

Create:

- `supabase/.env.local`

Example:

```env
SUPABASE_URL=https://iskrbtfvldfjsjsyejnp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
YANDEX_SMTP_USER=your-yandex-mailbox@yandex.ru
YANDEX_SMTP_PASS=YOUR_YANDEX_APP_PASSWORD
YANDEX_FROM_EMAIL=your-yandex-mailbox@yandex.ru
YANDEX_SMTP_HOST=smtp.yandex.ru
YANDEX_SMTP_PORT=465
YANDEX_SMTP_SECURE=true
```

Do not commit this file.

### 8.2 Serve the function locally

```bash
cd "/Users/alibyh/Desktop/Projects/Rosnefti site"
supabase functions serve send-order-emails --env-file supabase/.env.local
```

### 8.3 Test with a direct HTTP request

You can test locally using `curl`.

Example payload:

```bash
curl -i --request POST 'http://127.0.0.1:54321/functions/v1/send-order-emails' \
  --header 'Content-Type: application/json' \
  --data '{
    "requester": {
      "id": "user-1",
      "fullName": "Али Б",
      "email": "alibyh@icloud.com",
      "companyId": "1B54",
      "companyName": "ООО Example"
    },
    "destinationWarehouse": "Москва, склад 1",
    "items": [
      {
        "id": "item-1",
        "balanceUnit": "1B54",
        "companyName": "ООО Поставщик",
        "materialCode": "123456",
        "materialName": "Труба",
        "quantity": 2,
        "unit": "шт",
        "costRub": 5000,
        "warehouseAddress": "Самара, склад A"
      }
    ]
  }'
```

Expected successful response:

```json
{
  "success": true,
  "sentCount": 1,
  "skipped": []
}
```

---

## 9. Frontend Requirements To Make Submission Work

### 9.1 User must be logged in with fresh session

The requester email is now stored in auth state, but if you were already logged in before this change, the stored session may still be missing `email`.

Do this once:

1. Log out
2. Log back in

This refreshes the stored user session and ensures:

- `user.email`
- `user.fullName`
- `user.companyId`
- `user.company`

are available to the cart submit flow.

### 9.2 Destination warehouse must be selected

The submit button is disabled when destination warehouse is missing.

If the dropdown shows no warehouses:

- either `user.warehouses` is empty
- or no rows were found in `inventory` where `"БЕ" = user.companyId`

Check:

```sql
select distinct "Адрес склада"
from inventory
where "БЕ" = '1B54';
```

Replace `1B54` with the manager/requester company id you are testing.

---

## 10. How Recipient Matching Works

This is very important.

The function groups cart items by:

- `item.balanceUnit`

This comes from the source product row in inventory.

Then for each group it looks up managers:

```sql
select email, full_name, company_name, company_id
from app_users
where role = 'manager'
  and company_id = <item.balanceUnit>
```

That means:

- source product `БЕ` must match manager `company_id`
- if they do not match exactly, no email is sent for that company

### 10.1 Example

Cart contains:

- Product A from `БЕ = 1B54`
- Product B from `БЕ = 1B54`
- Product C from `БЕ = 2K10`

Function behavior:

- one email for all `1B54` products
- one email for all `2K10` products

Managers:

- managers with `company_id = 1B54` receive only products from `1B54`
- managers with `company_id = 2K10` receive only products from `2K10`

This matches your requirement:

- if there are more than one `БЕ`, each employee receives only information about their products

---

## 11. Email Template Mapping

The file `email_pattern.txt` contains this structure:

- subject
- repeated product block
- warehouse address
- confirmation request
- requester line

Current mapping in the function:

- `(КОД КСМ)` -> `item.materialCode`
- `(Наименование материала)` -> `item.materialName`
- `(Количество)+(ЕИ)` -> `item.quantity + item.unit`
- `(Стоимость с учетом рентабельности)` -> `item.costRub`
- `(Адрес склада)` -> `item.warehouseAddress`
- `Заказчик – БЕ (БЕ), (наименование общества)` -> requester `companyId` and `companyName`
- `Ответственный - (полное имя сотрудника), e-mail (e-mail)` -> requester `fullName` and `email`

The function also includes:

- `Адрес назначения: ...`
- `БЕ поставщика - ...`

If you want, this text can be adjusted later to match the template even more literally.

---

## 12. Troubleshooting

### 12.1 Error: `Missing Supabase service role configuration`

Cause:

- `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` secret is missing in Edge Functions

Fix:

- set secrets again with `supabase secrets set ...`

### 12.2 Error: `Missing Yandex SMTP configuration`

Cause:

- one of these is missing:
  - `YANDEX_SMTP_USER`
  - `YANDEX_SMTP_PASS`
  - `YANDEX_FROM_EMAIL`

Fix:

- set all SMTP secrets again

### 12.3 Error: `Invalid payload`

Cause:

- requester email is missing
- or items array is empty

Fix:

- log out and log back in
- make sure cart has items

### 12.4 `sentCount = 0`, `skipped` contains `Managers not found`

Cause:

- there is no manager in `app_users` for that `БЕ`

Fix:

Run:

```sql
select full_name, email, company_id, role
from app_users
where role = 'manager'
order by company_id;
```

Check that `company_id` matches the source product `БЕ`.

### 12.5 Emails are not delivered even though function returns success

Possible causes:

- Yandex mailbox blocked SMTP auth
- app password is wrong
- sender mailbox is not allowed to send
- recipient mailbox rejected
- Yandex security settings need adjustment

Fix:

1. regenerate the app password
2. update `YANDEX_SMTP_PASS`
3. redeploy or re-run the function
4. test SMTP with a single manual message

### 12.6 Function deploy succeeds but frontend still fails

Check:

- project frontend `VITE_SUPABASE_URL`
- project frontend `VITE_SUPABASE_ANON_KEY`
- user is logged in again with fresh session
- Edge Function exists in the same Supabase project as the frontend

---

## 13. Recommended Verification Checklist

Before testing from the cart:

- `app_users` table exists
- managers exist with correct `company_id`
- managers have valid `email`
- requester has valid `email`
- function secrets are set
- function is deployed
- you logged out and in again

Then do a real test:

1. log in as a requester
2. add products from one `БЕ`
3. pick destination warehouse
4. submit order
5. confirm email arrives

Then multi-company test:

1. add products from 2 different `БЕ`
2. submit order
3. confirm each company's managers receive only their own products

---

## 14. Exact Commands Summary

### Link project

```bash
cd "/Users/alibyh/Desktop/Projects/Rosnefti site"
supabase link --project-ref iskrbtfvldfjsjsyejnp
```

### Set secrets

```bash
supabase secrets set \
  SUPABASE_URL=https://iskrbtfvldfjsjsyejnp.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY \
  YANDEX_SMTP_USER=your-yandex-mailbox@yandex.ru \
  YANDEX_SMTP_PASS=YOUR_YANDEX_APP_PASSWORD \
  YANDEX_FROM_EMAIL=your-yandex-mailbox@yandex.ru \
  YANDEX_SMTP_HOST=smtp.yandex.ru \
  YANDEX_SMTP_PORT=465 \
  YANDEX_SMTP_SECURE=true
```

### Deploy function

```bash
supabase functions deploy send-order-emails
```

### Serve locally

```bash
supabase functions serve send-order-emails --env-file supabase/.env.local
```

---

## 15. Recommended Next Improvements

These are not required for the current setup, but they are worth considering:

- Save every submitted order into a Supabase `orders` table
- Save every sent email into an `order_email_logs` table
- Add retry logic for SMTP failures
- Add HTML email formatting in addition to plain text
- Add admin screen showing sent / skipped recipients
- Add validation that warns if a source `БЕ` has no managers before submit

---

## 16. Final Notes

The most important configuration detail in the current implementation is:

- source product `БЕ` from inventory
- must match manager `company_id` in `app_users`

If that mapping is correct, and the Yandex SMTP secrets are valid, the order submission flow should work.

If you want, the next step can be:

1. I add a small `orders` / `email_logs` table migration
2. I update the Edge Function to save every email send attempt into Supabase
3. I add a test button or admin diagnostics for recipient preview
