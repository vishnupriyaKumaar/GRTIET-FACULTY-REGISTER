# GRT Faculty Records Register

Web app for **GRT Institute of Engineering and Technology - Dept. of CSE** (Team OTC).
Login choice: **Teacher Access** (Add Teacher only, no password) or **Admin Login** (password, default `grtcse@1234`, changeable) -> tabs **Add Teacher / Search / Update / Relieved**, academic year + semester bar,
automatic fetch of a teacher's data into a new semester, relieve (data stops), full Annexure - II sheet as PDF / Word / Excel with the logo header.
See **USER-GUIDE.md**; the same guide, a VS Code run guide, backup and the source ZIP are inside the app under the gear icon.

## Install on any device (PWA)
Open the deployed link and press **⬇ Install App** (login page, top bar, or ⚙ Settings → 6).
Android / Windows / Linux / Chromebook / Mac (Chrome, Edge, Brave) install in one tap; iPhone / iPad use **Share → Add to Home Screen**
(the button shows these steps automatically). After the first visit the app also opens **without internet**.

## Deploy ONCE on Vercel
`bash deploy-vercel.sh` (Windows: double-click `DEPLOY.bat`) - answer the login question the first time, nothing else.
No server, no database, no environment variables, no dashboard settings (everything is in `vercel.json`).
Each build stamps the service worker, so installed apps pick up any future version by themselves.

## Run in VS Code
1. Install Node.js 18+ and VS Code. Unzip, then File -> Open Folder `grt-faculty-data-sheet`.
2. Terminal -> `npm install`, then `npm run dev`, open http://localhost:5173 (Windows: `RUN.bat`; Mac/Linux: `bash RUN.sh`).
3. Online (Vercel): `npm run build` then `npm run deploy`.

## Where to change things
`src/index.css` colours (palette at the end of the file) - `api/_lib/auth.js` default password - `src/App.jsx` page and tabs - `src/components/` screens -
`src/export/` PDF / Word / Excel (`headerLogo.js` = logo) - `src/storage.js` + `src/pack.js` database, 50 KB compression - `src/imageUtils.js` photo / certificate limits (5 MB).

## Storage
Shared online database (Supabase Postgres) through the Vercel function `api/app.js`: `staff`, `records` (gzip, <= 50 KB per teacher per semester), `files` (NPTEL certificates, <= 5 MB each, in pieces), `settings` (password hash). The browser keeps a live copy (`src/storage.js`, refreshed every 5 s). Setup: `SETUP-DATABASE.md`. Locally `npm run dev` uses a test file database (`.data/db.json`). Tests: `npm run test:api`.

## Upload File (auto-fill)
`src/importer/` : `extract.js` reads Word / PDF (table borders -> cells) / Excel / CSV / text / HTML / RTF / ODT / pictures (OCR, needs internet); `parse.js` maps column headings to the sheet; `dates.js` reads dates.

## What is inside the sheet
Same order as the template, then the extra sections:

| Part | Contents |
|---|---|
| Excel register | Download Excel (top) = one row per teacher with a **Photo** column (profile picture), then every key detail |
| Top block | College (fixed), Department, Name, Designation, Address, Mobile, Email, Gender, Community, PAN, Aadhaar, Date of Birth + Age, Blood group, Date of joining, Scale of pay, Basic pay, Total salary, **passport photo** |
| I | Educational qualification – UG / PG / Ph.D. (degree, specialization, year, college, university, % / grade, class) |
| I.a, II, III | GATE score, NET / SLET, Ph.D. thesis title, Faculty of Ph.D. |
| IV, V | Academic and Industrial experience (Years / Months / Days and **Total** are calculated automatically) |
| **VII** | **Publication** – Title of the paper, Date of publication, Publisher name, Indexed, Author name, DOI / No, ISSN / ISBN No |
| **VIII** | **Conference** – Title of the paper, Author name, Date, Conference name |
| **IX** | **Workshop** – Title, Organized by, Venue, From, To, Role |
| **X** | **FDP** – Title, Organized by, Mode, From, To (days calculated) |
| **XI** | **NPTEL** – Course, Weeks, Session, Score, Grade, **certificate upload** (picture or PDF) |
| **XII** | **Patent** – Title, Application / Patent No, Date of filing, Status, Inventor(s) |
| End | (no certification line or signature block)  |

## Branding
College logo in the top bar · college building as the page background · OTC intro animation + sound at start ·
OTC logo inside the app · footer *© CopyRight — Department of Computer Science (Batch 2024-2028) · Made by Team OTC*.

## Run on your computer (VS Code)
1. Install **Node.js 18+**. Unzip, then **File → Open Folder** `grt-faculty-data-sheet`.
2. Terminal: `npm install` then `npm run dev` → open **http://localhost:5173**
   (Windows: double-click `RUN.bat`; Mac / Linux: `bash RUN.sh`).
3. Check the file exports without the browser: `npm run test:export` (writes sample files to `test-output/`).

## Put it online (Vercel, free)
First do the one-time database setup in `SETUP-DATABASE.md` (Supabase, 2 environment variables), then `npm run deploy` (or `DEPLOY.bat` / `bash deploy-vercel.sh`).

## How data is stored
Teachers, semester records, certificates and the admin password are saved in the shared online database, so every device shows the same data (live, about 5 s). PDF / Word / Excel files are still created on the device.

## Project layout
`src/App.jsx` page and sections · `src/components/` fields, layout, intro, downloads · `src/export/spec.js` the ONE description of the
sheet used by `exportPdf.js`, `exportDocx.js`, `exportXlsx.js` · `src/utils.js` dates and experience maths · `public/` logos, background, intro assets.

## Notes
* PDF uses a standard font, so characters outside Latin letters (for example Tamil) show as “?” in the **PDF** only; Word and Excel keep them.
* Experience counts both the joining and the relieving day (01/06/2018 → 31/05/2020 = 2 years 0 months 0 days). An empty relieving date means “Till date”.
