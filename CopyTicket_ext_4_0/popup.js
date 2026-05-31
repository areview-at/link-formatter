// popup.js
chrome.storage.sync.get(['profiles', 'defaultProfileId', 'theme'], (data) => {
  if (data.theme === 'dark') document.body.classList.add('dark-mode');

  const container = document.getElementById('profile-list');
  const profiles = data.profiles || [];
  const defaultId = data.defaultProfileId;

  // Auto-close timer
  let autoClose = setTimeout(() => window.close(), 3000);
  document.body.onmouseenter = () => clearTimeout(autoClose);

  profiles.forEach((profile, index) => {
    const btn = document.createElement('button');
    const isActive = profile.id === defaultId;
    const colors = ['btn-blue', 'btn-green', 'btn-purple', 'btn-teal', 'btn-orange'];
    btn.className = `profile-btn ${colors[index % colors.length]} ${isActive ? 'is-standard' : ''}`;
    
    // Create a container for the text
    const textContainer = document.createElement('div');
    textContainer.style.display = 'flex';
    textContainer.style.flexDirection = 'column';

    // Profile Name (Safer)
    const nameSpan = document.createElement('span');
    nameSpan.className = 'profile-name';
    nameSpan.textContent = profile.name; 

    // Hint (Safer)
    const hintSpan = document.createElement('span');
    hintSpan.className = 'shortcut-hint';
    hintSpan.textContent = isActive ? '✓ Current Active' : 'Set as Active';

    textContainer.appendChild(nameSpan);
    textContainer.appendChild(hintSpan);
    btn.appendChild(textContainer);

    // Badge (Safer)
    if (isActive) {
      const badge = document.createElement('span');
      badge.className = 'standard-badge';
      badge.textContent = 'Active';
      btn.appendChild(badge);
    }
    
    btn.onclick = () => {
      chrome.storage.sync.set({ defaultProfileId: profile.id }, () => {
        window.close();
      });
    };
    container.appendChild(btn);
  });
});

document.getElementById('open-settings').onclick = () => chrome.runtime.openOptionsPage();