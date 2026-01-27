// background.js

// 1. Listen for left-click on the icon
chrome.action.onClicked.addListener((tab) => {
    executeFormatting(tab);
});

// 2. Listen for keyboard shortcut
chrome.commands.onCommand.addListener((command) => {
  if (command === "copy-jira-link") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) executeFormatting(tabs[0]);
    });
  }
});

async function executeFormatting(tab) {
  if (!tab.url || !tab.url.includes("/browse/")) return;

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      // Scrape Title from Jira Server/DC summary-val
      const summaryElement = document.getElementById('summary-val');
      let title = "";
      if (summaryElement) {
        const header = summaryElement.querySelector('h1, h2');
        title = header ? header.innerText.trim() : summaryElement.innerText.trim();
      } else {
        title = document.title.split(' - ')[0].trim();
      }

      // Clean URL (Strip queries)
      const urlMatch = window.location.href.match(/^(.*\/browse\/[A-Z0-9-]+)/);
      const cleanUrl = urlMatch ? urlMatch[1] : window.location.href.split('?')[0];
      const ticketId = cleanUrl.split('/').pop();

      return { title, url: cleanUrl, ticketId };
    }
  }, async (results) => {
    if (!results || !results[0].result) return;
    const data = results[0].result;

    const s = await chrome.storage.sync.get({
      incId: true, incName: true, incUrl: true,
      sep: " | ", prefix: "(", suffix: ")", urlPrefix: "[", urlSuffix: "]"
    });

    let info = [];
    if (s.incId) info.push(data.ticketId);
    if (s.incName) info.push(data.title);
    
    let ticketPart = info.join(s.sep);
    let finalStr = (ticketPart ? `${s.prefix}${ticketPart}${s.suffix}` : "") + 
                   (s.incUrl ? `${s.urlPrefix}${data.url}${s.urlSuffix}` : "");

    // Copy and Notify user
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (textToCopy) => {
        navigator.clipboard.writeText(textToCopy).then(() => {
          const div = document.createElement('div');
          div.textContent = "Copied!";
          div.style = "position:fixed; top:20px; right:20px; background:#0052cc; color:white; padding:12px 24px; border-radius:4px; z-index:10000; font-family:sans-serif; font-weight:bold; box-shadow: 0 4px 12px rgba(0,0,0,0.15); pointer-events:none;";
          document.body.appendChild(div);
          setTimeout(() => { 
            div.style.transition="opacity 0.4s"; 
            div.style.opacity='0'; 
            setTimeout(()=>div.remove(), 400); 
          }, 1500);
        });
      },
      args: [finalStr]
    });
  });
}