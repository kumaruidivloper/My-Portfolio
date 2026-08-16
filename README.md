# Deployment

## GitHub Pages

Angular 22 builds the app under a nested `browser` directory. For GitHub Pages, the published site needs a root-level `index.html`, so the deploy script copies the browser output into a flat deploy folder before publishing.

1. Build the app for production:
   npm run build:prod

2. Deploy the built site:
   npm run deploy:gh

3. If your project is published under a repository path, make sure the app's base href matches that URL before building.

Example:
ng build --configuration production --base-href "https://<username>.github.io/<repo>/"

Deploy command:
rm -rf dist/gh-pages && mkdir -p dist/gh-pages && cp -R dist/my-portfolio/browser/. dist/gh-pages/ && npx angular-cli-ghpages --dir=dist/gh-pages

Local dev:
ng serve --host 192.168.68.112

http://192.168.68.100:4200/

JSON: https://github.com/kumaruidivloper/JsonServer/blob/main/Profile_data.json

## CSS Loader
https://www.cssportal.com/css-loader-generator/

## Font
https://fontawesomeicons.com/

## Json-Server
https://www.youtube.com/watch?v=wN0n2gj0z9o

## Server Link
https://dashboard.render.com/# [Login with git Repo)
https://jsonserver-eudl.onrender.com

## HostLocal
ng serve --host 0.0.0.0
192.168.0.7

# MyPortfolio

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 16.2.0.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

## Building
Step1: npm run deploy:gh 
Step2: update in index.html 
Step3: npx angular-cli-ghpages --dir=dist/browser/my-portfolio