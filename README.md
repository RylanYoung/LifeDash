# LifeDash

Your tasks, Google Calendar and Gmail in one place, plus a Claude connector so Claude (on your Pro plan) can manage your to-dos and write a morning brief and evening recap.

- **Today**: the brief, tasks due today, today's schedule, unread email
- **Tasks**: lists > categories (with descriptions) > tasks > checkpoints. Business lists feed Claude's context; personal lists don't.
- **Calendar**: week view, add, edit and delete events
- **Email**: read, search, reply, compose, archive, star
- **Settings**: Google connection, Claude connector, business context

Stack: Next.js 16, Tailwind 4, Supabase, Vercel.

## Setup (about 20 minutes, once)

### 1. Supabase
1. In your Supabase project, open **SQL Editor**, paste all of [supabase/schema.sql](supabase/schema.sql), and click **Run**.
2. **Authentication > Sign In / Providers > Email**: keep Email on. Turning off "Confirm email" makes the first sign-up instant.
3. **Project Settings > API**: copy the Project URL and the anon (publishable) key.

### 2. Google Cloud (Gmail + Calendar)
1. Go to console.cloud.google.com and create a project (name it "LifeDash").
2. **APIs & Services > Library**: enable **Gmail API** and **Google Calendar API**.
3. **APIs & Services > OAuth consent screen** (Google Auth Platform):
   - User type **External**, app name "LifeDash", your email as support and developer contact.
   - **Audience**: add your Gmail address as a **test user**.
4. **Clients > Create client > Web application**:
   - Authorized redirect URIs: `http://localhost:3000/google/callback` and `https://YOUR-VERCEL-DOMAIN/google/callback`
   - Copy the Client ID and Client secret.
5. Important: while the app is in **Testing**, Google expires the connection every 7 days. To stop that, go to **Audience** and click **Publish app**. You'll see an "unverified app" warning when you connect; click **Advanced > Go to LifeDash**. That's fine for a personal app only you use.

### 3. Environment variables
Copy `.env.example` to `.env.local` and fill it in. Use the same values in Vercel (**Project > Settings > Environment Variables**).

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase, step 1 |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud, step 2 |
| `MCP_SECRET` | Any long random string. Generate one: `node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"` |
| `OWNER_EMAIL`, `OWNER_PASSWORD` | The email and password you sign in to LifeDash with. The Claude connector signs in as you. |

### 4. Run and deploy
```bash
npm install
npm run dev        # http://localhost:3000
```
Push to GitHub, import the repo in Vercel, add the env vars, deploy. Then add the Vercel URL's `/google/callback` to the Google client's redirect URIs.

### 5. First run
1. Open the app, **Create account** with your `OWNER_EMAIL` and password.
2. **Settings > Connect Google**.
3. **Settings > Claude**: copy the connector link. In Claude, go to **Settings > Connectors > Add custom connector** and paste it.
4. Schedule the brief: in Claude Code type `/schedule`, set 7:00 on weekdays, and paste the **Morning brief** prompt from Settings. Do the same at 18:00 for the **Evening recap**.

## Using Claude with it
Once the connector is added, in any Claude chat:
- "Add 'call the Bright Starts nursery' to Solven Growth under Outreach, due Friday"
- "What's left on my Solven list?"
- "Tick off the invoice task"
- "What's on my calendar tomorrow?"

## Notes
- The connector link contains `MCP_SECRET`. Anyone with it can act as you, so treat it like a password. Rotate it by changing the env var and redeploying.
- The site is set to `noindex` and `robots.txt` blocks all crawlers.
- No service-role key is used anywhere. Every query runs as you under row-level security.
