// background.js
const INITIAL_PROFILE = {
  id: 1000,
  name: "Standard",
  incId: true, incName: true, incUrl: true, isClickable: true,
  sep: " | ", prefix: "[", suffix: "]", urlPrefix: "(", urlSuffix: ")",
  replacements: []
};

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.sync.get(['profiles', 'defaultProfileId']);
  if (!data.profiles || data.profiles.length === 0) {
    chrome.storage.sync.set({ 
      profiles: [INITIAL_PROFILE], 
      defaultProfileId: INITIAL_PROFILE.id 
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "trigger-copy") {
    // sender.tab refers to the tab where the content script button was clicked
    handleExecution(sender.tab);
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
  const isJiraIssue = tab.url && (
    tab.url.includes("/browse/") || 
    tab.url.includes("selectedIssue=") || 
    tab.url.includes("/issues/")
  );

  if (!isJiraIssue) {
    await chrome.action.setPopup({ tabId: tab.id, popup: 'popup.html' });
    await chrome.action.openPopup();
    return;
  }

  const data = await chrome.storage.sync.get(['profiles', 'defaultProfileId']);
  const profiles = data.profiles || [INITIAL_PROFILE];
  const activeProfile = profiles.find(p => p.id === data.defaultProfileId) || profiles[0];

  // 1. Always execute the formatting first to ensure that the copy action is executed
  await executeFormatting(tab, activeProfile);

  // 2. Trigger the popup
  try {
    // Reset the popup for this tab to ensure it's "fresh"
    await chrome.action.setPopup({ tabId: tab.id, popup: 'popup.html' });
    
    // Open the popup programmatically
    await chrome.action.openPopup();

    // 3. IMPORTANT: Reset the popup to empty AFTER it opens.
    // This ensures the NEXT click on the icon triggers onClicked again 
    // instead of just opening the popup without running the background script.
    // We use a small timeout so the browser has time to actually render the popup.
    setTimeout(() => {
      chrome.action.setPopup({ tabId: tab.id, popup: '' });
    }, 500); 

  } catch (e) {
    console.error("Popup failed: ", e);
  }
}

async function executeFormatting(tab, profile) {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (p) => {
    // 1. Improved Issue Key Extraction
    let issueKey = "";
    
    // Pattern 1: Standard /browse/KEY
    // Pattern 2: /projects/PROJ/issues/KEY (New)
    // Pattern 3: selectedIssue=KEY (Boards)
    const url = window.location.href;
    const browseMatch = url.match(/\/browse\/([A-Z0-9-]+)/);
    const projectIssueMatch = url.match(/\/projects\/[^\/]+\/issues\/([A-Z0-9-]+)/);
    const selectedMatch = url.match(/selectedIssue=([A-Z0-9-]+)/);
    
    if (browseMatch) {
      issueKey = browseMatch[1];
    } else if (projectIssueMatch) {
      issueKey = projectIssueMatch[1];
    } else if (selectedMatch) {
      issueKey = selectedMatch[1];
    } else {
      // Fallback to DOM for sidebar key in various views
      const sidebarKeyEl = document.querySelector('#issuekey-val a, [data-test-id="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]');
      issueKey = sidebarKeyEl ? sidebarKeyEl.innerText.trim() : "";
    }

    // 2. Summary Extraction (Remains the same as before)
    const summarySelectors = [
      'h1[data-test-id="issue.views.issue-base.foundation.summary.heading"]', 
      '#summary-val', 
      '.ghx-fieldname-summary'
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
    // This strips out all the JQL and filters for a clean /browse/ link
    const baseUrl = window.location.origin;
    const cleanUrl = issueKey ? `${baseUrl}/browse/${issueKey}` : url;

    // 4. Transformation Logic
    let transformedId = issueKey;
    let transformedName = summary;
    let transformedUrl = cleanUrl;

    if (p.replacements && Array.isArray(p.replacements)) {
      p.replacements.forEach(rule => {
        if (!rule.find) return;
        const regex = new RegExp(rule.find, 'g');
        
        if (rule.target === 'id') transformedId = transformedId.replace(regex, rule.replace);
        if (rule.target === 'name') transformedName = transformedName.replace(regex, rule.replace);
        if (rule.target === 'url') transformedUrl = transformedUrl.replace(regex, rule.replace);
      });
    }

    // 5. Construct final strings using transformed values
    let info = [];
    if (p.incId && transformedId) info.push(transformedId);
    if (p.incName && transformedName) info.push(transformedName);
    
    const textPart = info.join(p.sep);
    const plainText = (textPart ? `${p.prefix}${textPart}${p.suffix}` : "") +
                      (p.incUrl ? `${p.urlPrefix}${transformedUrl}${p.urlSuffix}` : "");

    const items = { "text/plain": new Blob([plainText], { type: "text/plain" }) };
    if (p.isClickable) {
      const htmlText = `<a href="${cleanUrl}">${textPart || issueKey}</a>`;
      items["text/html"] = new Blob([htmlText], { type: "text/html" });
    }

    // 6. Copy and Toast
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