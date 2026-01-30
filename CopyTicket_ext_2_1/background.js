// background.js
const INITIAL_PROFILE = {
  id: 1000,
  name: "Standard",
  incId: true, incName: true, incUrl: true, isClickable: true,
  sep: " | ", prefix: "[", suffix: "]", urlPrefix: "(", urlSuffix: ")"
};

// Ensure default profile exists on install
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get(['profiles', 'defaultProfileId']);
  if (!data.profiles || data.profiles.length === 0) {
    chrome.storage.sync.set({ 
      profiles: [INITIAL_PROFILE], 
      defaultProfileId: INITIAL_PROFILE.id 
    });
  }
});

chrome.action.onClicked.addListener((tab) => {
  handleExecution(tab);
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "copy-jira-link") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) handleExecution(tabs[0]);
    });
  }
});

async function handleExecution(tab) {
  if (!tab.url || !tab.url.includes("/browse/")) return;

  const data = await chrome.storage.sync.get(['profiles', 'defaultProfileId']);
  const profiles = data.profiles || [INITIAL_PROFILE];
  const activeProfile = profiles.find(p => p.id === data.defaultProfileId) || profiles[0];

  await executeFormatting(tab, activeProfile);

  // Show the switcher popup
  chrome.action.setPopup({ tabId: tab.id, popup: 'popup.html' });
  chrome.action.openPopup();
  chrome.action.setPopup({ tabId: tab.id, popup: '' });
}

async function executeFormatting(tab, profile) {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (p) => {
      const summaryElement = document.querySelector('h1[data-test-id="issue.views.issue-base.foundation.summary.heading"]') ||
                             document.getElementById('summary-val');
      const summary = summaryElement ? summaryElement.innerText.trim() : document.title.replace(/ - Jira$/, "");
      const urlMatch = window.location.href.match(/^(.*\/browse\/[A-Z0-9-]+)/);
      const cleanUrl = urlMatch ? urlMatch[1] : window.location.href.split('?')[0];
      const issueKey = cleanUrl.split('/').pop();

      let info = [];
      if (p.incId) info.push(issueKey);
      if (p.incName) info.push(summary);
      const textPart = info.join(p.sep);
      const plainText = (textPart ? `${p.prefix}${textPart}${p.suffix}` : "") +
                        (p.incUrl ? `${p.urlPrefix}${cleanUrl}${p.urlSuffix}` : "");

      const items = { "text/plain": new Blob([plainText], { type: "text/plain" }) };
      if (p.isClickable) {
        const htmlText = `<a href="${cleanUrl}">${textPart || issueKey}</a>`;
        items["text/html"] = new Blob([htmlText], { type: "text/html" });
      }

      navigator.clipboard.write([new ClipboardItem(items)]).then(() => {
        const toast = document.createElement('div');
        toast.textContent = `Copied: ${p.name}`;
        toast.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:#0052cc; color:white; padding:10px 20px; border-radius:20px; z-index:999999; font-family:sans-serif; font-weight:bold; box-shadow:0 4px 12px rgba(0,0,0,0.3);";
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
      });
    },
    args: [profile]
  });
}