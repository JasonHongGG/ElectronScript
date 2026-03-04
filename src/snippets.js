// ============================================================
//  腳本定義：依照 App 分類，每個 App 各有自己的腳本
// ============================================================

export const snippets = {
    // ── VS Code 專用腳本 ──────────────────────────────────────
    vscode: {
        auto: {
            name: '[VS Code] 開啟自動點擊',
            code: `
        if (!window.myAutoClicker) {
          window.myAutoClicker = setInterval(() => {
            const buttons = Array.from(document.querySelectorAll('a.monaco-button, button'));
            const acceptBtn = buttons.find(b =>
              b.textContent.trim().includes('Continue') ||
              b.textContent.trim().includes('Allow')
            );
            if (acceptBtn) {
              console.log('偵測到按鈕，執行點擊！');
              acceptBtn.click();
            }
          }, 1500);
          console.log('自動點擊腳本已注入並啟動。');
        } else {
          console.log('自動點擊腳本已經在運行中。');
        }
      `,
        },
        stop: {
            name: '[VS Code] 停止自動點擊',
            code: `
        if (window.myAutoClicker) {
          clearInterval(window.myAutoClicker);
          window.myAutoClicker = null;
          console.log('自動點擊腳本已停止。');
        } else {
          console.log('沒有運行中的自動點擊腳本。');
        }
      `,
        },
    },

    // ── Antigravity 專用腳本 ──────────────────────────────────
    antigravity: {
        auto: {
            name: '[Antigravity] 開啟自動點擊',
            code: `
        if (!window.myAutoClicker) {
          window.myAutoClicker = setInterval(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const acceptBtn = buttons.find(b =>
              b.textContent.trim().includes('Run') ||
              b.textContent.trim().includes('Retry')
            );
            if (acceptBtn) {
              console.log('偵測到按鈕，執行點擊！');
              acceptBtn.click();
            }
          }, 1500);
          console.log('自動點擊腳本已注入並啟動。');
        } else {
          console.log('自動點擊腳本已經在運行中。');
        }
      `,
        },
        stop: {
            name: '[Antigravity] 停止自動點擊',
            code: `
        if (window.myAutoClicker) {
          clearInterval(window.myAutoClicker);
          window.myAutoClicker = null;
          console.log('自動點擊腳本已停止。');
        } else {
          console.log('沒有運行中的自動點擊腳本。');
        }
      `,
        },
    },
};
