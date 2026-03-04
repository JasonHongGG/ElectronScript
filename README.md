# Electron Script Injector

這是一個可以幫助你自動將 JavaScript 腳本注入到多個正在運行中的 Electron 應用程式的工具，免除你每次都需要開啟 Developer Tools 並手動點擊 Snippets 的麻煩。

## 原理
Electron 其實就是一個 Chromium 瀏覽器。只要在啟動 Electron App 時加上 debug port 參數，我們就可以透過 Chrome DevTools Protocol (CDP) 從外部程式碼連線進去，並在 App 內執行任何 JavaScript 腳本。

## 使用步驟

### 1. 啟動你的 Electron Apps 並指定 Debug Ports
為了讓外部工具能連線，你必須在啟動各個 Electron App 視窗時，指定不同的 debug port（除錯通訊埠）。

例如如果你是透過 command line 啟動，可以這樣做：
\`\`\`bash
# 第一個視窗
your-electron-app.exe --remote-debugging-port=9222
# 第二個視窗
your-electron-app.exe --remote-debugging-port=9223
# 第三個視窗
your-electron-app.exe --remote-debugging-port=9224
\`\`\`
*(依此類推)*

### 2. 設定 Ports 和腳本
這個資料夾中有兩個重要的設定檔：

- **\`config.js\`**: 在這裡填上你剛剛啟動 Electron App 時指定的所有的 Ports。例如 \`[9222, 9223, 9224]\`。
- **\`snippets.js\`**: 在這裡自定義你以前在 DevTools "Snippets" 裡面寫的程式碼。我已經幫你寫了 \`autoClicker\` 和 \`stopAutoClicker\` 當作範例，你可以隨意新增更多。

### 3. 執行這個工具
開啟終端機 (命令提示字元或 PowerShell)，並在這個資料夾下執行：
\`\`\`bash
npm start
\`\`\`
*(或者 \`node index.js\`)*

執行後，畫面會出現選單，詢問你想執行 \`snippets.js\` 裡面的哪一個腳本。
選擇後，這個工具就會在背景自動連線到所有設定好的 Ports，並且將程式碼注入進去執行！
