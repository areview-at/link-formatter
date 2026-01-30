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
    
    btn.innerHTML = `
      <div style="display:flex; flex-direction:column;">
        <span class="profile-name">${profile.name}</span>
        <span class="shortcut-hint">${isActive ? '✓ Current Active' : 'Set as Active'}</span>
      </div>
      ${isActive ? '<span class="standard-badge">Active</span>' : ''}
    `;
    
    btn.onclick = () => {
      chrome.storage.sync.set({ defaultProfileId: profile.id }, () => {
        window.close();
      });
    };
    container.appendChild(btn);
  });
});

document.getElementById('open-settings').onclick = () => chrome.runtime.openOptionsPage();