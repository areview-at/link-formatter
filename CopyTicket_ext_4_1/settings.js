// settings.js
const fields = ['incId', 'incName', 'incUrl', 'isClickable', 'sep', 'prefix', 'suffix', 'urlPrefix', 'urlSuffix', 'profileName', 'replacements', 'linkFont', 'linkFontSize', 'useLinkColor'];
let allProfiles = [];
let currentProfileId = null;
let globalDefaultId = null;

const INITIAL_PROFILE = {
  id: 1000,
  name: "Standard",
  incId: true, incName: true, incUrl: true, isClickable: true,
  sep: " | ", prefix: "[", suffix: "]", urlPrefix: "(", urlSuffix: ")",
  replacements: [],
  linkFont: "", linkFontSize: "", linkColor: "", useLinkColor: false
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
      if (el.type === 'checkbox') el.checked = !!p[f];
      else el.value = p[f] ?? '';
    }
  });

  // linkColor needs separate handling: color inputs can't hold an empty string
  const colorEl = document.getElementById('linkColor');
  if (colorEl) colorEl.value = p.linkColor || '#0052CC';

  renderReplacements(p.replacements || []);
  updateLinkStyleVisibility();
  updateHeader();
  updatePreview();
}

function updateLinkStyleVisibility() {
  const isClickable = document.getElementById('isClickable').checked;
  document.getElementById('link-style-section').style.display = isClickable ? 'block' : 'none';
  const useLinkColor = document.getElementById('useLinkColor').checked;
  document.getElementById('linkColor').disabled = !useLinkColor;
}

function updatePreview() {
  const p = allProfiles.find(item => item.id === currentProfileId);
  if (!p) return;

  let resId = "PROJ-123";
  let resName = "Example Issue Summary";
  let resUrl = "https://your-domain.atlassian.net/browse/PROJ-123";

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

  // Live link preview
  const isClickable = document.getElementById('isClickable').checked;
  const linkPreviewBox = document.getElementById('link-preview-box');
  const linkAnchor = document.getElementById('link-preview-anchor');

  linkPreviewBox.style.display = isClickable ? 'block' : 'none';
  if (isClickable && linkAnchor) {
    linkAnchor.textContent = textPart || resId;

    const styleParts = [];
    const fontVal = document.getElementById('linkFont').value;
    const sizeVal = document.getElementById('linkFontSize').value;
    const useColor = document.getElementById('useLinkColor').checked;
    const colorVal = document.getElementById('linkColor').value;

    if (fontVal) styleParts.push(`font-family:${fontVal}`);
    if (sizeVal) styleParts.push(`font-size:${sizeVal}pt`);
    if (useColor && colorVal) styleParts.push(`color:${colorVal}`);

    linkAnchor.style.cssText = styleParts.join(';');
  }
}

function renderReplacements(rules) {
  const container = document.getElementById('replacement-list');
  container.innerHTML = '';

  rules.forEach((rule) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:5px; align-items:center;';

    const findInput = document.createElement('input');
    findInput.type = 'text';
    findInput.placeholder = 'Find';
    findInput.value = rule.find;
    findInput.className = 'rule-find';
    findInput.style.cssText = 'flex:1; font-size:12px;';

    const arrow = document.createElement('span');
    arrow.textContent = '➔';

    const replaceInput = document.createElement('input');
    replaceInput.type = 'text';
    replaceInput.placeholder = 'Replace';
    replaceInput.value = rule.replace;
    replaceInput.className = 'rule-replace';
    replaceInput.style.cssText = 'flex:1; font-size:12px;';

    const select = document.createElement('select');
    select.className = 'rule-target';
    select.style.cssText = 'flex:1; font-size:11px;';
    [['id', 'Key'], ['name', 'Summary'], ['url', 'URL']].forEach(([val, label]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = label;
      if (rule.target === val) opt.selected = true;
      select.appendChild(opt);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'rule-del';
    delBtn.style.cssText = 'background:none; color:#DE350B; padding:5px;';
    delBtn.textContent = '✕';

    [findInput, replaceInput, select].forEach(el => {
      el.oninput = () => updateReplacementsData();
    });
    delBtn.onclick = () => { row.remove(); updateReplacementsData(); };

    row.appendChild(findInput);
    row.appendChild(arrow);
    row.appendChild(replaceInput);
    row.appendChild(select);
    row.appendChild(delBtn);
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

// Attach input listeners for live preview
fields.forEach(f => {
  const el = document.getElementById(f);
  if (el) el.addEventListener('input', updatePreview);
});

// isClickable and useLinkColor also need to toggle visibility on change
document.getElementById('isClickable').addEventListener('change', updateLinkStyleVisibility);
document.getElementById('useLinkColor').addEventListener('change', updateLinkStyleVisibility);

// linkColor is not in fields array, wire it up manually
document.getElementById('linkColor').addEventListener('input', updatePreview);

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
  const isFirefox = typeof InstallTrigger !== 'undefined';
  if (isFirefox) {
    alert("To change shortcuts in Firefox:\n1. Open 'about:addons'\n2. Click the Cog icon ⚙️\n3. Select 'Manage Extension Shortcuts'");
  } else {
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
  // Save linkColor separately (color input always holds a valid hex)
  const colorEl = document.getElementById('linkColor');
  if (colorEl) p.linkColor = colorEl.value;

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

// ── Import / Export ───────────────────────────────────────────────────────────

let pendingImport = null;

function exportProfiles() {
  const payload = {
    app: "Jira Link Formatter",
    version: "4.0",
    defaultProfileId: globalDefaultId,
    profiles: allProfiles
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'jira-link-profiles.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById('export-btn').onclick = exportProfiles;

document.getElementById('import-btn').onclick = () => document.getElementById('import-file').click();

document.getElementById('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      const raw = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed.profiles) ? parsed.profiles : null);
      if (!raw || raw.length === 0) throw new Error("No profiles array found.");
      const valid = raw.filter(p => p && p.name).map(p => ({ ...INITIAL_PROFILE, ...p }));
      if (valid.length === 0) throw new Error("No valid profiles found (each needs a name).");
      pendingImport = valid;
      pendingImport._defaultId = parsed.defaultProfileId || null;
      const names = valid.map(p => `"${p.name}"`).join(', ');
      document.getElementById('import-summary').textContent =
        `${valid.length} profile(s) found: ${names}`;
      document.getElementById('import-panel').style.display = 'block';
    } catch (err) {
      alert("Could not read file: " + err.message);
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});

document.getElementById('import-add-btn').onclick = () => {
  if (!pendingImport) return;
  const existingIds = new Set(allProfiles.map(p => p.id));
  let nextId = Date.now();
  pendingImport.forEach(p => {
    if (existingIds.has(p.id)) p.id = nextId++;
    existingIds.add(p.id);
    allProfiles.push(p);
  });
  finishImport(pendingImport.length + ' profile(s) added.');
};

document.getElementById('import-replace-btn').onclick = () => {
  if (!pendingImport) return;
  let nextId = Date.now();
  allProfiles = pendingImport.map((p, i) => ({ ...p, id: p.id || nextId + i }));
  const savedDefault = pendingImport._defaultId;
  globalDefaultId = (savedDefault && allProfiles.find(p => p.id == savedDefault))
    ? savedDefault
    : allProfiles[0].id;
  finishImport('Replaced with ' + allProfiles.length + ' profile(s).');
};

document.getElementById('import-cancel-btn').onclick = () => {
  pendingImport = null;
  document.getElementById('import-panel').style.display = 'none';
};

function finishImport(msg) {
  pendingImport = null;
  document.getElementById('import-panel').style.display = 'none';
  chrome.storage.sync.set({ profiles: allProfiles, defaultProfileId: globalDefaultId }, () => {
    populateDropdown();
    loadProfile(globalDefaultId);
    const btn = document.getElementById('import-btn');
    const orig = btn.textContent;
    btn.textContent = '✓ ' + msg;
    setTimeout(() => { btn.textContent = orig; }, 2500);
  });
}
