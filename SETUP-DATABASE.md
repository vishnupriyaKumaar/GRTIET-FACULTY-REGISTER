# Make the Faculty Register work on every phone and computer (one-time setup, free)

Before this step the app only saved data in the browser it was opened in. Now every teacher, record, certificate
and the admin password is saved in an **online database (Supabase)**, and the web app on **Vercel** talks to it.
Open the same link on any device and you see the same data, updated live (about every 5 seconds).

You need two free accounts: **Supabase** (database) and **Vercel** (hosting – you already use it).
It takes about 10 minutes.

## 1. Create the database (Supabase)
1. Go to https://supabase.com → **Start your project** → sign in → **New project**.
   Name: `grt-faculty`, choose a database password (save it), pick the region nearest to you (e.g. *Mumbai*), **Create**.
2. When it is ready open **SQL Editor → New query**, paste everything from the file **`SETUP-DATABASE.sql`**, press **Run**.
   You should see "Success".
3. Open **Project Settings → API** (or *Data API / API Keys*). Copy two things:
   * **Project URL** – like `https://abcdxyz.supabase.co`
   * **service_role** secret key (the long one marked *secret*; in newer projects it is the **Secret key**, starting `sb_secret_…`).
   **Never put this key in the app code or share it.** It goes only into Vercel (next step).

## 2. Give the keys to Vercel
1. https://vercel.com → your project (the Faculty app) → **Settings → Environment Variables**. Add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | the Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role / secret key |

   (Optional: `AUTH_SECRET` = any long random text. If you skip it the app creates its own.)
2. Tick **Production, Preview, Development** → **Save**.

## 3. Deploy this new version
* Windows: double-click **`DEPLOY.bat`**. Mac/Linux: `bash deploy-vercel.sh`.
  (or `npm install` then `npm run deploy`).
* Open your app link. On the first screen there must be **no** red "database is not connected" message.
  If you see it, the two variables in step 2 are missing or wrong – fix them and deploy again.

## 4. Check it works on two devices
1. On the PC choose **Admin Login** (password `grtcse@1234`) and press **Change Password** to set your own.
2. On the phone open the same link → **Teacher Access** → add a teacher (try **📎 Upload File** with a Word/PDF profile) → **Save**.
3. Within ~5 seconds the teacher appears on the PC under **Search** (green **● Live** badge). Done.

Existing data from the old browser-only version: in the *old* app press ⚙ → **Download backup**, then in the *new* app (Admin) ⚙ → **Restore from a backup file**.

## Good to know
* **Free-tier pause:** Supabase pauses free projects after 7 days with no use. Opening the app and logging in as Admin once a week avoids it; if paused, press *Restore* in the Supabase dashboard (no data is lost).
* **Free limits:** 500 MB database. A teacher record is ≤ 50 KB and certificates ≤ 5 MB each, so a few hundred teachers fit comfortably; very many 5 MB certificates will use the space faster.
* **Teacher Access has no password** (as you asked). Anyone with the link can add a teacher, and typing an existing teacher's full name loads and lets them re-save that teacher's data for the semester. They can never open Search, Update, Relieved, Excel, backup or delete. Do not share the link publicly if that is a concern.
* **Forgot the admin password:** Supabase → Table editor → `settings` → delete the row `pwhash`. The password becomes `grtcse@1234` again.
* **Run on your own PC for testing:** `npm install`, `npm run dev` – this uses a local test database file (`.data/db.json`); nothing goes online.
* The app still installs like a normal app (PWA), but saving and loading need internet now, because the data is shared online.
