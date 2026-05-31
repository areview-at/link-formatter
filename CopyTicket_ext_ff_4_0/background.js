// background.js
const INITIAL_PROFILE = {
  id: 1000,
  name: "Standard",
  incId: true, incName: true, incUrl: true, isClickable: true,
  sep: " | ", prefix: "[", suffix: "]", urlPrefix: "(", urlSuffix: ")",
  replacements: [],
  linkFont: "", linkFontSize: "", linkColor: "", useLinkColor: false
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

  await executeFormatting(tab, activeProfile);

  try {
    await chrome.action.setPopup({ tabId: tab.id, popup: 'popup.html' });
    await chrome.action.openPopup();
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
      // 1. Issue Key Extraction
      let issueKey = "";
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
        const sidebarKeyEl = document.querySelector('#issuekey-val a, [data-test-id="issue.views.issue-base.foundation.breadcrumbs.current-issue.item"]');
        issueKey = sidebarKeyEl ? sidebarKeyEl.innerText.trim() : "";
      }

      // 2. Summary Extraction
      const summarySelectors = [
        'h1[data-test-id="issue.views.issue-base.foundation.summary.heading"]',
        '#summary-val',
        '.ghx-fieldname-summary'
      ];
      let summary = "";
      for (let selector of summarySelectors) {
        const el = document.querySelector(selector);
        if (el) { summary = el.innerText.replace(/\n/g, ' ').trim(); break; }
      }
      if (!summary) summary = document.title.replace(/ - Jira$/, "");

      // 3. Clean URL
      const baseUrl = window.location.origin;
      const cleanUrl = issueKey ? `${baseUrl}/browse/${issueKey}` : url;

      // 4. Transformations
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

      // 5. Build plain text
      let info = [];
      if (p.incId && transformedId) info.push(transformedId);
      if (p.incName && transformedName) info.push(transformedName);

      const textPart = info.join(p.sep);
      const plainText = (textPart ? `${p.prefix}${textPart}${p.suffix}` : "") +
                        (p.incUrl ? `${p.urlPrefix}${transformedUrl}${p.urlSuffix}` : "");

      // 6. Build clipboard items
      const items = { "text/plain": new Blob([plainText], { type: "text/plain" }) };

      if (p.isClickable) {
        // Build inline style from link formatting settings
        const styleParts = [];
        if (p.linkFont) styleParts.push(`font-family:${p.linkFont}`);
        if (p.linkFontSize) styleParts.push(`font-size:${p.linkFontSize}pt`);
        if (p.useLinkColor && p.linkColor) styleParts.push(`color:${p.linkColor}`);
        const styleAttr = styleParts.length ? ` style="${styleParts.join(';')}"` : '';
        const htmlText = `<a href="${cleanUrl}"${styleAttr}>${textPart || issueKey}</a>`;
        items["text/html"] = new Blob([htmlText], { type: "text/html" });
      }

      // 7. Copy and toast
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
