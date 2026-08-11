# React Browser Extension

Develop a browser extension using React, with live reload services to reduce development headaches.

## Development

1. Run the following command to create a development build with reload services:

   ```shell
   npm run dev
   ```
2. Load the unpacked folder as `/dev` in Chrome `chrome://extensions/`.
3. Edit the manifest file under `extension/manifest.json`. You can also place your icons here.
4. Edit the background script at `src/background.js`.
5. To edit the content script, modify `src/content.js`.

   > **Note:** Do not edit the code between `HMR-START` and `HMR-END` comments. This section is responsible for updating the extension in real time during development and is automatically removed in the production build.
6. The extension reloads automatically in the following conditions:

   * Files under `extension/` are modified.
   * Content scripts are edited.
   * Background scripts are edited.

## Production
1. Run the following command.
```shell
npm run build
```
2. Load the unpacked folder as `/build` in Chrome `chrome://extensions/`.