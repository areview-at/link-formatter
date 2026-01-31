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
  if (!tab.url || (!tab.url.includes("/browse/") && !tab.url.includes("selectedIssue="))) return;

  const data = await chrome.storage.sync.get(['profiles', 'defaultProfileId']);
  const profiles = data.profiles || [INITIAL_PROFILE];
  const activeProfile = profiles.find(p => p.id === data.defaultProfileId) || profiles[0];

  await executeFormatting(tab, activeProfile);

  // STABILIZED POPUP TRIGGER
  try {
    // 1. Ensure the popup is set for this tab
    await chrome.action.setPopup({ tabId: tab.id, popup: 'popup.html' });
    
    // 2. Open it
    await chrome.action.openPopup();
    
    // 3. Do NOT immediately set it back to ''. 
    // Instead, let's clear it only AFTER the user interacts or it closes.
  } catch (e) {
    console.error("Popup failed to open: ", e);
  }
}

async function executeFormatting(tab, profile) {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (p) => {
    // 1. Try to find the Issue Key
    let issueKey = "";
    const urlMatch = window.location.href.match(/selectedIssue=([A-Z0-9-]+)/) || 
                    window.location.href.match(/\/browse\/([A-Z0-9-]+)/);
    
    if (urlMatch) {
      issueKey = urlMatch[1];
    } else {
      // Fallback to DOM for sidebar key
      const sidebarKeyEl = document.querySelector('#issuekey-val a');
      issueKey = sidebarKeyEl ? sidebarKeyEl.innerText.trim() : "";
    }

    // 2. Try to find the Summary
    const summarySelectors = [
      'h1[data-test-id="issue.views.issue-base.foundation.summary.heading"]', // New Jira UI
      '#summary-val', // Classic / Browse UI AND Board Sidebar
      '.ghx-fieldname-summary' // Alternate Board Sidebar class
    ];
    
    let summary = "";
    for (let selector of summarySelectors) {
      const el = document.querySelector(selector);
      if (el) {
        summary = el.innerText.replace(/\n/g, ' ').trim();
        break;
      }
    }
    if (!summary) summary = document.title.replace(/ - Jira$/, "");

    // 3. Construct the Clean URL
    // We want the standard /browse/ link even if we are on a board
    const baseUrl = window.location.origin;
    const cleanUrl = `${baseUrl}/browse/${issueKey}`;

    // 4. Formatting logic
    let info = [];
    if (p.incId && issueKey) info.push(issueKey);
    if (p.incName && summary) info.push(summary);
    
    const textPart = info.join(p.sep);
    const plainText = (textPart ? `${p.prefix}${textPart}${p.suffix}` : "") +
                      (p.incUrl ? `${p.urlPrefix}${cleanUrl}${p.urlSuffix}` : "");

    const items = { "text/plain": new Blob([plainText], { type: "text/plain" }) };
    if (p.isClickable) {
      const htmlText = `<a href="${cleanUrl}">${textPart || issueKey}</a>`;
      items["text/html"] = new Blob([htmlText], { type: "text/html" });
    }

    // 5. Copy and Toast
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