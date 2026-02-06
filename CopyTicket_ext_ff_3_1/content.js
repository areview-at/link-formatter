// content.js
function isJiraPage() {
    // Check if the 'aui-header' exists (standard for Jira Server/DC)
    // or if the generator meta tag says Jira
    const isAui = document.querySelector('.aui-header');
    const isMetaJira = document.querySelector('meta[name="application-name"][content="JIRA"]');
    return !!(isAui || isMetaJira);
}

function injectHeaderButton() {
    if (!isJiraPage()) return;
  // 1. Try multiple ways to find the header navigation
  const headerNav = document.querySelector('.aui-header-primary .aui-nav') || 
                    document.querySelector('.aui-nav') ||
                    document.querySelector('#logo').closest('.aui-header-inner').querySelector('.aui-nav');

  if (!headerNav) return;
  
  // 2. Prevent double injection
  if (document.getElementById('jira-copy-header-item')) return;

  // 3. Create the list item
  const li = document.createElement('li');
  li.id = 'jira-copy-header-item';
  li.setAttribute('role', 'presentation');

  // 4. Create the button
  const btn = document.createElement('a');
  btn.href = "#";
  // We use aui-button-primary to make it stand out first to confirm it works
  btn.className = 'aui-button aui-button-primary aui-style'; 
  btn.style.cssText = `
    margin-left: 10px;
    background-color: #0052cc;
    color: white !important;
    display: inline-flex;
    align-items: center;
    padding: 0 10px;
    height: 30px;
    border-radius: 3px;
    font-weight: bold;
    text-decoration: none;
  `;
  btn.innerHTML = '<span>📋 Copy Link</span>';

  btn.onclick = (e) => {
    e.preventDefault();
    chrome.runtime.sendMessage({ action: "trigger-copy" });
    
    const span = btn.querySelector('span');
    span.innerText = '✅ Copied!';
    setTimeout(() => { span.innerText = '📋 Copy Link'; }, 2000);
  };

  li.appendChild(btn);
  
  // 5. Try to insert it after 'Create', otherwise just append to the nav
  const createBtn = document.getElementById('create-menu') || document.querySelector('.create-issue');
  if (createBtn) {
    createBtn.after(li);
  } else {
    headerNav.appendChild(li);
  }
}

// Observe the DOM for changes (needed for SPAs)
const observer = new MutationObserver(() => injectHeaderButton());
observer.observe(document.body, { childList: true, subtree: true });

// Initial attempt
injectHeaderButton();