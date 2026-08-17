# My Portfolio

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 22.1.4.

## 1. Install dependencies

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
