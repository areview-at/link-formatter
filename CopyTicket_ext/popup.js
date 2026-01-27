const fields = ['incId', 'incName', 'incUrl', 'sep', 'prefix', 'suffix', 'urlPrefix', 'urlSuffix'];
const defaults = {
  incId: true, incName: true, incUrl: true,
  sep: " | ", prefix: "(", suffix: ")", urlPrefix: "[", urlSuffix: "]"
};

function updatePreview() {
  const vals = {};
  fields.forEach(f => {
    const el = document.getElementById(f);
    vals[f] = el.type === 'checkbox' ? el.checked : el.value;
  });

  let info = [];
  if (vals.incId) info.push("TICKET-123");
  if (vals.incName) info.push("Sample Title");
  
  let ticketPart = info.join(vals.sep);
  let previewStr = (ticketPart ? `${vals.prefix}${ticketPart}${vals.suffix}` : "") + 
                   (vals.incUrl ? `${vals.urlPrefix}https://jira.co.at/...${vals.urlSuffix}` : "");
  
  document.getElementById('preview').innerText = previewStr || "Nothing selected";
}

chrome.storage.sync.get(defaults, (data) => {
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el.type === 'checkbox') el.checked = data[f];
    else el.value = data[f];
    el.addEventListener('input', updatePreview);
  });
  updatePreview();
});

document.getElementById('save').addEventListener('click', () => {
  const settings = {};
  fields.forEach(f => {
    const el = document.getElementById(f);
    settings[f] = el.type === 'checkbox' ? el.checked : el.value;
  });
  chrome.storage.sync.set(settings, () => {
    const btn = document.getElementById('save');
    btn.innerText = "Saved!";
    setTimeout(() => { btn.innerText = "Save Settings"; }, 1000);
  });
});

document.getElementById('openShortcuts').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});