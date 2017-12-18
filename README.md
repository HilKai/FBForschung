<h1> FB-Forschung repository using https://github.com/EmailThis/extension-boilerplate </h1>


<p>
## Installation <br>
1. Clone the repository `git clone https://github.com/HilKai/FBForschung`<br>
2. Run `npm install`<br>
3. Run `npm run build`<br>


<h2> Load the extension in Chrome & Opera</h2>
1. Open Chrome/Opera browser and navigate to chrome://extensions<br>
2. Select "Developer Mode" and then click "Load unpacked extension..."<br>
3. From the file browser, choose to `FBForschung/build/chrome` or (`extension-boilerplate/build/opera`)<br>


<h2> Load the extension in Firefox</h2>
1. Open Firefox browser and navigate to about:debugging<br>
2. Click "Load Temporary Add-on" and from the file browser, choose `FBForschung/build/firefox`<br>


<h2> Developing</h2>
The following tasks can be used when you want to start developing the extension and want to enable live reload - <br>

- `npm run chrome-watch`<br>
- `npm run opera-watch`<br>
- `npm run firefox-watch`<br>


<h2>Packaging</h2>
Run `npm run dist` to create a zipped, production-ready extension for each browser. You can then upload that to the appstore.<br>

</p>