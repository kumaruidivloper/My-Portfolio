# My Portfolio

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 22.1.4.

Animated counters use shaded 3D digit drums that rotate continuously through 9 to 0, reverse when counting down, and disable rotation transitions when reduced motion is preferred.

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

Use the dashboard's right-aligned three-dot More dashboard options button to view dashboard details or download all records as CSV or Excel (.xlsx). The options float below the button without shifting the dashboard; clicking outside dismisses them. Tab through the three options; Escape closes the options and returns focus to the button. Exports fetch every data source, including widgets not yet rendered, and ignore chart selections/date filters. CSV contains one table with a Section column and labeled data columns; Excel has separate sheets for transfers, each owner's PF/gratuity, combined PF, super, and overall totals, with frozen headers and filters. All record fields are included without compact-number or currency formatting; dates/months retain their recorded labels, except combined PF months are normalized as in the dashboard. Text is protected against CSV spreadsheet-formula execution. Loading or export errors are shown on the dashboard; incomplete downloads are not generated. The Excel library loads only when exporting Excel.

Expanding a dashboard widget moves it to the top at full width. All other widgets also span the full width for alignment, including cards still loading. Collapsing the widget restores the normal side-by-side layout, with summary cards retaining their full width. Mobile layouts remain single-column.

## 1. Install dependencies

Dashboard access and edit/delete confirmations require the configured 14-digit code. Dashboard entry automatically verifies after all 14 digits are entered; pasted codes also fill all 14 fields.

```bash
npm install
```

## 2. Run the app locally

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

- Local dev server: `ng serve --host 192.168.68.112`
- Local preview URL: `http://192.168.68.100:4200/`
- Network host mode: `ng serve --host 0.0.0.0`
- Local IP example: `192.168.0.7`

## 8. Mock api
  kumaruidivloper's Mock API project:
  https://mockapi.io/projects/64b76091df0839c97e168d7a
