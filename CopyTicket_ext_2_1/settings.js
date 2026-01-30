// settings.js
const fields = ['incId', 'incName', 'incUrl', 'isClickable', 'sep', 'prefix', 'suffix', 'urlPrefix', 'urlSuffix', 'profileName'];
let allProfiles = [];
let currentProfileId = null;
let globalDefaultId = null;

const INITIAL_PROFILE = {
  id: 1000,
  name: "Standard",
  incId: true, incName: true, incUrl: true, isClickable: true,
  sep: " | ", prefix: "[", suffix: "]", urlPrefix: "(", urlSuffix: ")"
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
  updateHeader();
  updatePreview(); // Ensure preview loads with the profile
}

function updatePreview() {
  const p = allProfiles.find(item => item.id === currentProfileId);
  if (!p) return;

  const sampleKey = "PROJ-123";
  const sampleSummary = "Example Issue Summary";
  const sampleUrl = "https://your-domain.atlassian.net/browse/PROJ-123";

  let info = [];
  if (document.getElementById('incId').checked) info.push(sampleKey);
  if (document.getElementById('incName').checked) info.push(sampleSummary);

  const textPart = info.join(document.getElementById('sep').value);
  const previewText = (textPart ? `${document.getElementById('prefix').value}${textPart}${document.getElementById('suffix').value}` : "") +
                      (document.getElementById('incUrl').checked ? `${document.getElementById('urlPrefix').value}${sampleUrl}${document.getElementById('urlSuffix').value}` : "");

  document.getElementById('preview').textContent = previewText;
}

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