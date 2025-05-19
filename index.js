const DB_NAME = 'faithforge-db';
const STORE_NAME = 'handles';

// --- DOM CACHE ---
const loadBtn = document.getElementById('load-folder');
const resetBtn = document.getElementById('reset-app');
const applyBtn = document.getElementById('apply-config');
const output = document.getElementById('output');
const configSummary = document.getElementById('config-summary');

// --- Folder handles cache ---
const folderHandles = {};
const folderFiles = {};

// --- IndexedDB helpers ---
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function saveHandle(handle) {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(handle, 'root');
  return tx.complete;
}
async function getSavedHandle() {
  const db = await openDB();
  return new Promise(resolve => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get('root');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}
async function clearSavedHandle() {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete('root');
  return tx.complete;
}
async function verifyPermission(handle, mode = 'readwrite') {
  const options = { mode };
  if ((await handle.queryPermission(options)) === 'granted') return true;
  if ((await handle.requestPermission(options)) === 'granted') return true;
  return false;
}

// --- UI HELPERS ---
function showError(msg) {
  output.textContent = msg;
  loadBtn.style.display = 'inline-block';
}
function resetUI() {
  output.textContent = 'Please load your App folder to begin.';
  document.getElementById('app-title').textContent = 'FaithForgeLabs App Loader';
  document.getElementById('tagline').textContent = '';
  document.getElementById('app-content').innerHTML = '';
  configSummary.style.display = 'none';
  if (applyBtn) applyBtn.style.display = 'none';
  document.getElementById('branding-logo').src = "index.png"; // fallback/default
}

// --- CONFIG VALIDATION ---
function validateConfig(config) {
  const errors = [];
  if (!config.folders || typeof config.folders.scripts !== "string" || !config.folders.scripts)
    errors.push('Missing or invalid "folders.scripts" (required, string).');
  if (!Array.isArray(config.scripts) || config.scripts.length === 0 || !config.scripts.every(s => typeof s === "string"))
    errors.push('Missing or invalid "scripts" (required, non-empty array of strings).');
  if (!config.appTitle || typeof config.appTitle !== "string")
    errors.push('Missing or invalid "appTitle" (required, string).');
  return errors;
}

// --- CONFIG SUMMARY ---
function showConfigSummary(config) {
  let summary = `
    <strong>App Title:</strong> ${config.appTitle}<br>
    <strong>Tagline:</strong> ${config.tagline || "(none)"}<br>
    <strong>Scripts:</strong> ${config.scripts.join(", ")}<br>
  `;

  for (const [key, files] of Object.entries(folderFiles)) {
    const folderId = `folder-summary-${key}`;
    summary += `
      <div style="margin-top:0.5em;">
        <button type="button" class="folder-toggle" data-target="${folderId}" style="background:none;border:none;color:#5a6dc6;cursor:pointer;font-weight:bold;">
          ${key.charAt(0).toUpperCase() + key.slice(1)} Folder
        </button>
        <ul id="${folderId}" style="margin:0.2em 0 0.5em 1.5em; font-size:0.97em; display:none;">
          ${files.length
            ? files.map(f => `<li>${f}</li>`).join("")
            : "<li style='color:#b71c1c;'>No files found</li>"}
        </ul>
      </div>
    `;
  }

  configSummary.innerHTML = summary;
  configSummary.style.display = 'block';

  // Add toggle logic
  configSummary.querySelectorAll('.folder-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const ul = configSummary.querySelector(`#${btn.dataset.target}`);
      if (ul) ul.style.display = ul.style.display === 'none' ? 'block' : 'none';
    });
  });
}

// --- MAIN LOADER FLOW ---
let pendingConfig = null;
let pendingRoot = null;

async function loadApp(root) {
  try {
    await saveHandle(root);
    let config = {};
    try {
      const configHandle = await root.getFileHandle('index-config.json');
      const configFile = await configHandle.getFile();
      config = JSON.parse(await configFile.text());
      window.appConfig = config;
    } catch (e) {
      showError('Config not found or invalid! Please load the folder where your index-config.json file is located.');
      await clearSavedHandle();
      return;
    }
    const configErrors = validateConfig(config);
    if (configErrors.length > 0) {
      output.innerHTML = '<ul style="color:#b71c1c;">' +
        configErrors.map(e => `<li>${e}</li>`).join('') +
        '</ul>';
      loadBtn.style.display = 'inline-block';
      await clearSavedHandle();
      return;
    }

    // --- Dynamically get handles for all folders in config ---
    Object.keys(folderHandles).forEach(k => delete folderHandles[k]);
    Object.keys(folderFiles).forEach(k => delete folderFiles[k]);
    for (const [key, folderName] of Object.entries(config.folders || {})) {
      try {
        const dirHandle = await root.getDirectoryHandle(folderName);
        folderHandles[key] = dirHandle;

        // List files in this directory
        folderFiles[key] = [];
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file') {
            folderFiles[key].push(entry.name);
          }
        }
      } catch (e) {
        showError(`Folder "${folderName}" for "${key}" could not be found. Please check your folder structure.`);
        await clearSavedHandle();
        return;
      }
    }

    // After successful folder/config load, but before apply:
    pendingConfig = config;
    pendingRoot = root;
    window.appConfig = config;
    setAppState('review');
  } catch (err) {
    showError('Error: ' + err);
    setAppState('error');
    await clearSavedHandle();
  }
}

applyBtn.addEventListener('click', async () => {
  applyBtn.style.display = 'none';
  output.textContent = '';
  try {
    if (pendingConfig.logo) {
      document.getElementById('branding-logo').src = pendingConfig.logo;
    }
    if (pendingConfig.appTitle) {
      document.title = pendingConfig.appTitle;
      document.getElementById('app-title').textContent = pendingConfig.appTitle;
    }
    if (pendingConfig.tagline) {
      document.getElementById('tagline').textContent = pendingConfig.tagline;
    }
    if (!pendingConfig.folders || !pendingConfig.folders.scripts) {
      showError('Config is missing "folders.scripts" path! Please load the correct folder.');
      await clearSavedHandle();
      return;
    }
    if (!pendingConfig.scripts || !Array.isArray(pendingConfig.scripts)) {
      showError('Config is missing "scripts" array! Please load the correct folder.');
      await clearSavedHandle();
      return;
    }
    // Use the cached scripts folder handle
    let scriptsDir = folderHandles.scripts;
    if (!scriptsDir) {
      showError(`Scripts folder "${pendingConfig.folders.scripts}" not found! Please load the correct folder.`);
      await clearSavedHandle();
      return;
    }
    let combinedCode = '';
    for (const scriptName of pendingConfig.scripts) {
      try {
        const fileHandle = await scriptsDir.getFileHandle(scriptName);
        const file = await fileHandle.getFile();
        const code = await file.text();
        combinedCode += '\n' + code;
      } catch (e) {
        showError(`Failed to load script: ${scriptName}. Please check your config and scripts folder.`);
        await clearSavedHandle();
        return;
      }
    }
    try {
      Function(combinedCode)();
    } catch (e) {
      showError('Error running app scripts: ' + e);
      setAppState('error');
      await clearSavedHandle();
      return;
    }
    setAppState('loaded');
    pendingConfig = null;
    pendingRoot = null;
  } catch (err) {
    showError('Error: ' + err);
    setAppState('error');
    await clearSavedHandle();
  }
});

// --- UI STATE MGMT ---
function setAppState(state) {
  document.body.classList.remove('unloaded', 'review', 'loaded', 'error', 'admin-open');
  if (state === 'unloaded') {
    document.body.classList.add('unloaded', 'admin-open');
    loadBtn.style.display = 'inline-block';
    resetBtn.style.display = 'none';
    if (applyBtn) applyBtn.style.display = 'none';
    resetUI();
  } else if (state === 'review') {
    document.body.classList.add('review', 'admin-open');
    loadBtn.style.display = 'none';
    resetBtn.style.display = 'inline-block';
    if (applyBtn) applyBtn.style.display = 'inline-block';
    output.textContent = 'Review the configuration above. Click "Apply Config" to continue.';
    showConfigSummary(window.appConfig);
  } else if (state === 'loaded') {
    document.body.classList.add('loaded');
    document.body.classList.remove('admin-open');
    loadBtn.style.display = 'none';
    resetBtn.style.display = 'inline-block';
    if (applyBtn) applyBtn.style.display = 'none';
    output.textContent = '';
    if (window.appConfig) showConfigSummary(window.appConfig);
  } else if (state === 'error') {
    document.body.classList.add('error', 'admin-open');
    loadBtn.style.display = 'inline-block';
    resetBtn.style.display = 'inline-block';
    if (applyBtn) applyBtn.style.display = 'none';
  }
}

// --- LOADER/RESETTER ---
loadBtn.addEventListener('click', async () => {
  try {
    const root = await window.showDirectoryPicker();
    await loadApp(root);
  } catch (err) {
    showError('Error: ' + err);
  }
});
resetBtn.addEventListener('click', async () => {
  await clearSavedHandle();
  setAppState('unloaded');
});

// --- ON PAGE LOAD ---
window.addEventListener('DOMContentLoaded', async () => {
  const savedHandle = await getSavedHandle();
  if (savedHandle && await verifyPermission(savedHandle)) {
    await loadApp(savedHandle); // This should end in setAppState('review')
  } else {
    setAppState('unloaded');
  }
});