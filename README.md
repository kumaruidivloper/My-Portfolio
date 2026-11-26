# My Portfolio

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 22.1.4.

Animated counters use shaded 3D digit drums that rotate continuously through 9 to 0, reverse when counting down, and disable rotation transitions when reduced motion is preferred.

The home intro uses a compact transparent circular frame with theme-aware inset shadows that become outer shadows on hover. The **Find me online** links sit below the raised download button. Only the frame shrinks toward its center as you scroll down from the top and grows back as you scroll up. The intro content stays full size, and the QR form does not shift. The frame stays full size when reduced motion is enabled or the browser doesn't support scroll-driven animations.

The QR form loads its generator when needed and generates codes locally as you type. If the generator cannot load, refresh the page to retry; if the text is too long to encode, shorten it.

The portfolio's scroll button stays in the bottom-right corner on desktop and mobile and switches between scrolling to the top and bottom.

Awesome Companies displays each existing experience record as a colored lanyard and ID-style career badge, using a user-supplied ID portrait and the portfolio's name and title while preserving company names, dates and order. Each available company logo appears on both the lanyard strap and badge; the straps retain their original colors and shaded design. The badge portrait is separate from the main portfolio photo. Chapter numbers represent the career sequence, not employee IDs. Cards adapt from three columns to one and disable hover movement for reduced motion. Logos are stored locally from [Dart Innovations](https://dartinnovations.com/), [Boeing](https://www.boeing.com/) and [Harman](https://www.harman.com/). Mindtree, Cognizant, Volvo, TCS, Xentaqsys and Schindlers use user-supplied logos; empty margins are trimmed where needed to fit the badges. The supplied TCS logo uses a plain white background. Company trademarks belong to their owners. Companies without an available logo use explicitly labeled monograms; historical employer names are not replaced with successor brands.

Dashboard highlight color dots follow the chart's category/legend mapping, including repeated transfer dates. In line view, the dots use the single metric series color.

All dashboard bar and line charts use compact Y-axis ticks (1k, 1.5k, 1M, 1B), while tooltips, tables, and summary cards retain their full-value formatting.

The Vasuki super Current super balance card shows the difference from the previous recorded period as small supporting text. The difference is unavailable until two periods are recorded.

For either Overall metric, View all details includes an interest comparison card showing the current (or selected) month's interest, the previous recorded month's interest, and the change between them. Without an earlier record, the comparison is marked unavailable.

The Total interest card sums monthly interest in the chosen date range and remains unchanged when selecting a chart month; the interest comparison card follows the selection.

View all details provides a two-handle date-range slider bounded by the selected metric's earliest and latest records. Click or tap the track to move the nearest handle (From wins an equal-distance tie), then optionally drag to continue adjusting it. Drag the From/To handles or their date labels (mouse or touch), or focus either control and use arrow keys to adjust the range. Transfers step by calendar day; monthly metrics step by month. Date labels follow their handles with pointers, with From above and To below to avoid overlap; handles cannot cross. The chart, counts, totals, and previous-period comparisons use only records within the inclusive range. Changing metrics or reopening the modal restores the full range; Reset date filter restores it without changing the metric. Ranges with no records show an empty-state message; the slider is disabled for missing or single-date histories. Edit-form calendars retain quick year selection via their heading.

Click a bar, line point, or pie/doughnut slice in View all details to show the selected date/month's values in the cards. The count card shows the selected transaction or record's position in chart order (for example, 3 of 20), together with its date/month; previous-period values refer to the record before the selection. Exchange-rate cards show selected and previous transfer rates while selected, including rates below 1. Reset selection restores the default summaries and total counts; changing metrics or reopening the modal also clears the selection.

The dashboard owns page scrolling while open. Opening a dashboard dialog locks the dashboard behind it, keeping scrolling within the dialog; portfolio scrolling is unchanged.

Dashboard grids default to descending date/month order (newest first). Click a column header to change sorting; edit/delete actions continue to target the original record.

Dashboard tables shade even rows subtly using the current theme colors, including mobile record cards. Alternating shading follows the visible row order after sorting or pagination; hover highlighting remains available.

Table delete buttons retain a red warning accent in both themes; dark mode uses a muted dark-red background and a brighter icon so the pressed hover shadow remains readable.

All dashboard stepped forms use theme-surface Next and Submit buttons with accent-colored text, raised shadows, and inset hover/focus feedback instead of solid accent fills. Disabled controls retain their muted appearance.

Kumar Australia Salary (API resource 8) and Vasuki Australia Salary (resource 9) use the same lazy-loaded dashboard widget layout, previews, chart types, sortable/paginated tables, and themed stepped add/edit forms. Each salary field can be selected in the widget chart or dashboard details. Forms include month, initial advance repayment, total salary, Australian tax, India deduction, total deduction, and Australian salary; Vasuki also includes Australian health insurance. All amounts are entered manually: totals and net salary are not recalculated. Each owner can have one record per month. Editing and deletion require the existing confirmation code; adding does not. Salary remains separate from overall balance and its interest calculations. CSV exports and separate Excel salary sheets include every salary record and field.

Expanded salary widgets show Total salary credited (sum of Australian salary), Total gross salary, and Total deductions for an inclusive From/To month range. The two-handle slider steps through calendar months and filters the totals, chart, and table together; keyboard arrows adjust either focused handle. Initially all months are included. Reset salary range restores the full history, as does a successful add/edit/delete or reload. Selecting a gap with no records shows zero totals and an empty-state message. Empty and single-month histories disable the slider. Switching chart metrics does not change totals; exports still include all salary records.

The Salary period panel uses the shared themed month picker for exact From/To selection, including theme-matched calendar popups and disabled months outside the allowed range. All time / Last 3, 6, or 12 months shortcuts end at the latest recorded month (not today's date) and are disabled when the full history is shorter than that period. Selected presets use the dashboard's themed inset style, and the panel shows the available timeline and selected record count.

Salary chart metric and chart-type selectors reserve space for their widest option, keeping their widths stable when selections change.

Salary tables offer a desktop Columns chooser. Individual tables initially show Month, Total salary, Australian tax, Australian salary, and Actions; all except Australian salary are required. Other salary fields can be enabled, and Reset columns restores this default. The combined read-only table omits Actions, and its owner breakdown keeps Owner visible and shares the selected salary fields. Mobile cards always show all fields. Column selections do not affect calculations, charts, or exports.

The separate Combined Australia Salary widget is read-only and derives all salary fields from both owners, grouped by calendar month. It includes months recorded for either owner, combined credited/gross/deduction totals, all chart types, and combined monthly and owner-breakdown tables controlled by the same period filter. It refreshes after either source widget saves; if either source fails to load, an error and retry are shown instead of partial totals. Add/edit/delete remain only in the individual widgets. This derived view does not add another API resource or affect overall balance. Downloads include a separate Combined Australia Salary CSV section and Excel sheet alongside both individual salary datasets. Combined exports use the same monthly aggregation as the widget, include all salary fields in AUD, and ignore widget filters. Combined rows are derived totals, not additional salary credits to add to the individual datasets.

Use Add data at the top of the dashboard to create a transfer, PF, gratuity, super, or individual salary record from one centralized form. Choose a record type to show its fields and enable Next; Back returns to the record-type selection. Transfer received amount is calculated from the sent amount and exchange rate, and monthly categories prevent duplicate months. Select a grey data summary to close the form and open its corresponding dashboard accordion; the switches still open the form fields. Existing add/edit forms within each widget remain available.

The Transfer card shows saved overall PF, gratuity and Super totals for the current and previous two calendar months when records exist. Month change compares each month's difference with the previous month's difference; older records remain saved. When adding Super, the form also previews the selected month's overall total and summed monthly differences alongside the previous calendar month, including changes in both values. It uses the entered Super balance and the dashboard's carry-forward rules; missing history or a loading error makes the comparison unavailable. The preview does not save any data.

Use the dashboard's right-aligned three-dot More dashboard options button to view dashboard details or download all records as CSV or Excel (.xlsx). The options float below the button without shifting the dashboard; clicking outside dismisses them. Tab through the three options; Escape closes the options and returns focus to the button. Exports fetch every data source, including widgets not yet rendered, and ignore chart selections/date filters. CSV contains one table with a Section column and labeled data columns; Excel has separate sheets for transfers, each owner's PF/gratuity, combined PF, super, and overall totals, with frozen headers and filters. All record fields are included without compact-number or currency formatting; dates/months retain their recorded labels, except combined PF months are normalized as in the dashboard. Text is protected against CSV spreadsheet-formula execution. Loading or export errors are shown on the dashboard; incomplete downloads are not generated. The Excel library loads only when exporting Excel.

Expanding a dashboard widget moves it to the top at full width. All other widgets also span the full width for alignment, including cards still loading. Collapsing the widget restores the normal side-by-side layout, with summary cards retaining their full width. Mobile layouts remain single-column.

The About skill bars supplement API-provided skills with Claude / Claude Code (83%), Prompt Engineering (76%), AI-Assisted Development (85%), Generative AI (72%), MCP (Model Context Protocol) (68%), and AI Agents (79%). These varied levels stay fixed across reloads. Existing matching labels keep their API-provided levels. All skills render in balanced columns using the same viewport-driven counter/bar animation; these additions do not modify the remote API.

## 1. Install dependencies

Dashboard access and edit/delete confirmations require the configured 14-digit code. Dashboard entry automatically verifies after all 14 digits are entered; pasted codes also fill all 14 fields. If the code is incorrect, the entry dialog stays open and shows an alert strip below the fields. When the encryption key is needed, enter it in the same access dialog's themed password field. The key is checked after eight characters, with progress shown inside the field; select Continue if the code was entered first.

My Access loads bank and account records from the configured MockAPI access-details resource. Sensitive-looking values are masked until individually revealed. It requires the 14-digit code in production and, by default, in local development. This is a client-side gate, not server-side authorization; do not use it to protect real credentials.

Form focus indicators avoid outer outlines while retaining the existing shadows. High-contrast mode uses an inset system-colored outline.

MockAPI fields use `enc:` followed by base64-encoded IV, ciphertext and authentication tag. The browser derives the AES-256-GCM key using PBKDF2/HMAC-SHA256 with the original file's salt and 310,000 iterations. The portfolio loads without the key; the My Dashboard and My Access code dialog includes a key field once per page session, and the key stays in memory only. Direct local links also use this dialog for the key. Before opening a protected page, the app fetches its encrypted data and verifies the key locally; the key is not sent to the API. Incorrect keys can be retried in the dialog, while network errors or a response without encrypted data prevent verification. Reads decrypt each field before rendering, and saves encrypt fields in the same format after successfully decrypting data with that key. Plaintext responses remain readable during migration; they are not protected until migrated or saved. Browser-side encryption is not a substitute for server-side authorization, and Web Crypto requires HTTPS or localhost.

Revealing a password or profile password on a card or in the edit form requires a separate mock reveal code each time; other masked fields are unchanged. This check is also browser-side and does not protect the data from browser tools or network access.

Each My Access card has an edit dialog. Required fields cannot be blank; optional fields may be empty or set to `NA`. Password and confirmation-code fields have individual show/hide controls and are masked again when the dialog reopens. Saving requires the same 14-digit confirmation code as dashboard edits, verified in the browser in both local and production environments. Saving refreshes the records first and checks whether the edited card changed since the dialog opened.

The code check also works on local-network HTTP URLs without Web Crypto. HTTP and browser-side code checks do not protect sensitive data; use HTTPS and server-side authorization for real credentials.

The dashboard code dialog contains a mask switch, enabled by default on every launch, that visually obscures dashboard values, charts, and entry fields; a crossed-out eye indicates masking is on. The title row has the status strip on the left and the switch on the right. On mobile, the switch sits in a padded oval. The strip shows a green check for **Value Masked** and a red info icon for **Value Unmasked**. The dashboard code boxes and encryption key field use light, theme-aware tints matching the status: green when masked and red when unmasked. The encryption key itself remains hidden in both states. The dashboard and My Access code dialogs are enabled locally by default; set `showAccessCodePromptLocally` to `false` in `src/environments/environment.ts` to bypass the code locally. The encryption key is still required, and the dashboard still opens masked. Production always requires the code regardless of this setting. Masking is a visual aid, not data protection: accessible text, browser tools, and exports can still expose the data.

```bash
npm install
```

## 2. Run the app locally

The portfolio shows both a centered spinner and a horizontal loading bar at the top while its initial data request is pending. Once the data arrives, the bar fills left to right over 3.5 seconds. When the page opens, the bar drains right to left once and the profile border unwinds with it before both return to scroll tracking. On narrow screens the startup bar is thicker and stays flush with the top edge. If loading fails, use **Try again**.

Start the Angular dev server:

```bash
npm start
```

Or run directly with Angular CLI:

```bash
ng serve --host 0.0.0.0 --port 4200
```

Open the app in the browser:

```text
http://localhost:4200/
```

For a local network preview:

```bash
ng serve --host 0.0.0.0
```

## 3. Build the app

### Standard build

```bash
npm run build
```

This builds the app into the `dist/my-portfolio` folder.

### Production build

```bash
npm run build:prod
```

This runs:

```bash
ng build --configuration production
```

Production builds warn above 550 kB for the initial bundle or 9 kB for an individual component stylesheet. The corresponding error limits are 1 MB and 10 kB.

## 4. Deploy to GitHub Pages

Run the deploy script:

```bash
npm run deploy:gh
```

This script does the following:

1. Builds the app in production mode
2. Copies the Angular output from `dist/my-portfolio/browser` to `dist/gh-pages`
3. Publishes the content to the `gh-pages` branch using `angular-cli-ghpages`

### Manual deploy command

```bash
rm -rf dist/gh-pages && mkdir -p dist/gh-pages && cp -R dist/my-portfolio/browser/. dist/gh-pages/ && npx angular-cli-ghpages --dir=dist/gh-pages
```

### GitHub Pages repo setting

After publishing, make sure GitHub Pages is configured as:

- Source: Deploy from a branch
- Branch: `gh-pages`
- Folder: `/ (root)`

## 5. Useful commands

```bash
npm start
npm run build
npm run build:prod
npm run deploy:gh
npm test
```

## 6. Extra project links

### JSON API

https://github.com/kumaruidivloper/JsonServer/blob/main/Profile_data.json

### CSS Loader

https://www.cssportal.com/css-loader-generator/

### Font

https://fontawesomeicons.com/

### Json Server tutorial

https://www.youtube.com/watch?v=wN0n2gj0z9o

### Server / Hosting

https://dashboard.render.com/#
https://jsonserver-eudl.onrender.com

## 7. Local development notes

- Lazy-loaded feature modules are in `src/app/features/`: My Dashboard, My Access, and Interview Q&A.
- Reusable UI components are in `src/app/shared/`, with each component's template, styles, and tests alongside it.
- Shared services and their tests are in `src/app/shared/service/`.
- HTTP interceptors and their tests are in `src/app/interceptor/`.
- On the development machine, `npm start` serves `http://localhost:4200/dashboard`; localhost supports Web Crypto.
- For another device on the network, use HTTPS with a certificate trusted by that device. Plain HTTP on a LAN IP cannot decrypt the dashboard data.

For example, with [mkcert](https://github.com/FiloSottile/mkcert) installed, create and trust a local development CA, then generate a certificate for the server's LAN IP:

```bash
mkcert -install
mkdir -p .local-ssl
mkcert -cert-file .local-ssl/lan.pem -key-file .local-ssl/lan-key.pem 192.168.68.112 localhost 127.0.0.1
npx ng serve --host 0.0.0.0 --port 4200 --ssl --ssl-cert .local-ssl/lan.pem --ssl-key .local-ssl/lan-key.pem
```

Stop any existing server on port 4200 first. Open `https://192.168.68.112:4200/dashboard`; replace the example IP with the server's actual LAN IP. Other devices must also trust the mkcert CA before using the site. Keep the CA private key and the generated server key private; `.local-ssl/` is ignored by Git. Installing a local CA changes device trust, so use it only on devices you control.

## 8. Mock api
  kumaruidivloper's Mock API project:
  https://mockapi.io/projects/90064b76091df0839c97e168d7a

  Resources 1–5 use the `/bank/:id` path; resources 6 and above remain under `/taskList/:id`.
