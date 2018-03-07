# Browser Plugin for FBforschung.de

Find information on the project itself under <https://fbforschung.de>.

## Installation

### Chrome and Opera
1. Open Chrome/Opera browser and navigate to chrome://extensions
1. Select "Developer Mode" and then click "Load unpacked extension..."
1. From the file browser, choose to `FBForschung/build/chrome` or (`extension-boilerplate/build/opera`)

## Firefox
1. Open Firefox browser and navigate to about:debugging
1. Click "Load Temporary Add-on" and from the file browser, choose `FBForschung/build/firefox`

## Development
1. Clone the repository `git clone https://github.com/HilKai/FBForschung`
1. Run `npm install`
1. Run `npm run build`

The following tasks can be used when you want to start developing the extension and want to enable live reload:
- `npm run chrome-watch`
- `npm run opera-watch`
- `npm run firefox-watch`

## Distribution
Run `npm run dist` to create a zipped, production-ready extension for each browser. You can then upload that to the appstore.

## Contact
Extensive contact information is available unter <https://fbforschung.de/impressum>, for quick contact use [@MarHai](https://github.com/MarHai). 
