// settings.js
const fields = ['incId', 'incName', 'incUrl', 'isClickable', 'sep', 'prefix', 'suffix', 'urlPrefix', 'urlSuffix', 'profileName', 'replacements'];
let allProfiles = [];
let currentProfileId = null;
let globalDefaultId = null;

const INITIAL_PROFILE = {
  id: 1000,
  name: "Standard",
  incId: true, incName: true, incUrl: true, isClickable: true,
  sep: " | ", prefix: "[", suffix: "]", urlPrefix: "(", urlSuffix: ")",
  replacements: []
};

chrome.storage.sync.get(['profiles', 'defaultProfileId', 'theme'], (data) => {
  allProfiles = data.profiles || [INITIAL_PROFILE];
  globalDefaultId = data.defaultProfileId || allProfiles[0].id;
  
  if (data.theme === 'dark') {
    document.body.classList.add('dark-mode');
    document.getElementById('themeSelect').value = 'dark';
  }

  populateDropdown();
  loadProfile(globalDefaultId);
});

function loadProfile(id) {
  const p = allProfiles.find(item => item.id == id);
  if (!p) return;
  
  currentProfileId = p.id;
  document.getElementById('profileDropdown').value = p.id;
  document.getElementById('profileName').value = p.name;

  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el && f !== 'profileName') {
      if (el.type === 'checkbox') el.checked = p[f];
      else el.value = p[f];
    }
  });
  renderReplacements(p.replacements || []);
  updateHeader();
  updatePreview(); // Ensure preview loads with the profile
}

function updatePreview() {
  const p = allProfiles.find(item => item.id === currentProfileId);
  if (!p) return;

  let resId = "PROJ-123";
  let resName = "Example Issue Summary";
  let resUrl = "https://your-domain.atlassian.net/browse/PROJ-123";

  // Apply Replacements to Preview
  if (p.replacements && Array.isArray(p.replacements)) {
    p.replacements.forEach(rule => {
      if (!rule.find) return;
      const regex = new RegExp(rule.find, 'g');
      if (rule.target === 'id') resId = resId.replace(regex, rule.replace);
      if (rule.target === 'name') resName = resName.replace(regex, rule.replace);
      if (rule.target === 'url') resUrl = resUrl.replace(regex, rule.replace);
    });
  }

  const info = [];
  if (document.getElementById('incId').checked) info.push(resId);
  if (document.getElementById('incName').checked) info.push(resName);

  const textPart = info.join(document.getElementById('sep').value);
  const previewText = (textPart ? `${document.getElementById('prefix').value}${textPart}${document.getElementById('suffix').value}` : "") +
                      (document.getElementById('incUrl').checked ? `${document.getElementById('urlPrefix').value}${resUrl}${document.getElementById('urlSuffix').value}` : "");

  document.getElementById('preview').textContent = previewText;
}

function renderReplacements(rules) {
  const container = document.getElementById('replacement-list');
  container.innerHTML = '';
  
  rules.forEach((rule, index) => {
    const row = document.createElement('div');
    row.style = "display: flex; gap: 5px; align-items: center;";
    row.innerHTML = `
      <input type="text" placeholder="Find" value="${rule.find}" class="rule-find" style="flex:1; font-size:12px;">
      <span>➔</span>
      <input type="text" placeholder="Replace" value="${rule.replace}" class="rule-replace" style="flex:1; font-size:12px;">
      <select class="rule-target" style="flex:1; font-size:11px;">
        <option value="id" ${rule.target === 'id' ? 'selected' : ''}>Key</option>
        <option value="name" ${rule.target === 'name' ? 'selected' : ''}>Summary</option>
        <option value="url" ${rule.target === 'url' ? 'selected' : ''}>URL</option>
      </select>
      <button class="rule-del" style="background:none; color:#DE350B; padding:5px;">✕</button>
    `;
    
    // Listeners to update the profile data in memory
    row.querySelectorAll('input, select').forEach(el => {
      el.oninput = () => updateReplacementsData();
    });
    row.querySelector('.rule-del').onclick = () => {
      row.remove();
      updateReplacementsData();
    };
    
    container.appendChild(row);
  });
}

function updateReplacementsData() {
  const p = allProfiles.find(item => item.id === currentProfileId);
  const rows = document.querySelectorAll('#replacement-list > div');
  p.replacements = Array.from(rows).map(row => ({
    find: row.querySelector('.rule-find').value,
    replace: row.querySelector('.rule-replace').value,
    target: row.querySelector('.rule-target').value
  }));
  updatePreview();
}

document.getElementById('add-replacement').onclick = () => {
  const p = allProfiles.find(item => item.id === currentProfileId);
  if (!p.replacements) p.replacements = [];
  p.replacements.push({ find: '', replace: '', target: 'id' });
  renderReplacements(p.replacements);
};

// Listen for any input changes to update preview
fields.forEach(f => {
  const el = document.getElementById(f);
  if (el) el.addEventListener('input', updatePreview);
});

document.getElementById('themeSelect').addEventListener('change', (e) => {
  const mode = e.target.value;
  document.body.classList.toggle('dark-mode', mode === 'dark');
  chrome.storage.sync.set({ theme: mode });
});

document.getElementById('profileName').addEventListener('input', (e) => {
  const p = allProfiles.find(item => item.id === currentProfileId);
  if (p) {
    p.name = e.target.value;
    const option = document.querySelector(`#profileDropdown option[value="${currentProfileId}"]`);
    if (option) option.textContent = p.name;
  }
});

document.getElementById('makeDefault').addEventListener('click', () => {
  globalDefaultId = currentProfileId;
  chrome.storage.sync.set({ defaultProfileId: globalDefaultId }, () => {
    updateHeader();
  });
});

document.getElementById('open-shortcuts').onclick = (e) => {
  e.preventDefault();
  
  // Check if we are in Firefox
  const isFirefox = typeof InstallTrigger !== 'undefined';

  if (isFirefox) {
    // Firefox security blocks about:addons or about:preferences directly.
    // The best practice is to alert the user or redirect to a help page.
    alert("To change shortcuts in Firefox:\n1. Open 'about:addons'\n2. Click the Cog icon ⚙️\n3. Select 'Manage Extension Shortcuts'");
  } else {
    // Standard Chromium path
    chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
  }
};

function updateHeader() {
  const label = document.getElementById('currentDefaultLabel');
  const activeP = allProfiles.find(p => p.id === globalDefaultId);
  label.textContent = activeP ? activeP.name : "None";

  const isDefault = currentProfileId == globalDefaultId;
  const btn = document.getElementById('makeDefault');
  btn.textContent = isDefault ? "Active" : "Set as Active";
  btn.classList.toggle('is-standard', isDefault);
}

function populateDropdown() {
  const dropdown = document.getElementById('profileDropdown');
  dropdown.innerHTML = '';
  allProfiles.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    dropdown.appendChild(opt);
  });
}

document.getElementById('profileDropdown').addEventListener('change', (e) => loadProfile(e.target.value));

document.getElementById('save').addEventListener('click', () => {
  const p = allProfiles.find(item => item.id === currentProfileId);
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el) p[f] = (el.type === 'checkbox') ? el.checked : el.value;
  });
  
  chrome.storage.sync.set({ profiles: allProfiles }, () => {
    const btn = document.getElementById('save');
    btn.textContent = "✓ Saved!";
    setTimeout(() => btn.textContent = "Save Changes", 1500);
  });
});

document.getElementById('add').addEventListener('click', () => {
  const newId = Date.now();
  const newProfile = { ...INITIAL_PROFILE, id: newId, name: "New Profile" };
  allProfiles.push(newProfile);
  populateDropdown();
  loadProfile(newId);
});

document.getElementById('delete').addEventListener('click', () => {
  if (allProfiles.length <= 1) return alert("Must keep one profile.");
  allProfiles = allProfiles.filter(p => p.id != currentProfileId);
  if (globalDefaultId == currentProfileId) globalDefaultId = allProfiles[0].id;
  chrome.storage.sync.set({ profiles: allProfiles, defaultProfileId: globalDefaultId }, () => {
    populateDropdown();
    loadProfile(globalDefaultId);
  });
});