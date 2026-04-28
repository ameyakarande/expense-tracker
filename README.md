# Personal + Group Expense Tracker

Next.js + Tailwind + Supabase web app for personal and shared expense tracking.

## Run locally

```powershell
cd expense-tracker-app
copy .env.example .env
# add your Supabase URL + anon key
npm install
npm run dev
```

## Supabase setup

1. Create a Supabase project.
2. In the SQL editor, run [`supabase/schema.sql`](./supabase/schema.sql).
3. For an existing project that already used the earlier schema, also run [`supabase/hardening.sql`](./supabase/hardening.sql).
4. In Authentication, enable Email/Password.
5. Copy your project URL and anon key into `.env` with the `NEXT_PUBLIC_` variable names.

## What is included

- Email/password authentication with persistent session
- Personal and group ledger contexts
- Group creation and join-by-invite-code flow
- Month selector with backdated expense support
- Overview, budgets, insights, and profile screens
- CSV and PDF report export
- Supabase RLS policies for personal and group records
