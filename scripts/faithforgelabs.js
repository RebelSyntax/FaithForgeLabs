let rootHandle = null;

async function verifyPermission(handle, mode = 'readwrite') {
  const options = { mode };
  if ((await handle.queryPermission(options)) === 'granted') return true;
  if ((await handle.requestPermission(options)) === 'granted') return true;
  return false;
}

function toggleContent(id) {
  const content = document.getElementById(id);
  if (content) {
    content.style.display = content.style.display === 'none' ? 'block' : 'none';
  }
}

function setupToggles() {
  document.querySelectorAll('.collapsible-toggle').forEach(toggle => {
    const id = toggle.getAttribute("data-target");
    if (!id) return;

    // Prevent duplicate listeners on reload
    if (toggle._bound) return;
    toggle.addEventListener("click", () => toggleContent(id));
    toggle._bound = true;
  });
}

async function loadTemplates(root) {
  const app = document.getElementById("app");
  app.innerHTML = '';

  const templateFiles = ["title.html", "tools.html", "guide.html", "logo-review.html"];
  const templateDir = await root.getDirectoryHandle("templates");

  for (const name of templateFiles) {
    try {
      const fileHandle = await templateDir.getFileHandle(name);
      const file = await fileHandle.getFile();
      const html = await file.text();

      const section = document.createElement("section");
      section.innerHTML = html;
      app.appendChild(section);
    } catch (err) {
      console.warn(`Failed to load ${name}:`, err);
    }
  }

  setupToggles(); // hook up all toggle elements
}

document.getElementById("load-folder").addEventListener("click", async () => {
  try {
    rootHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    if (await verifyPermission(rootHandle)) {
      await loadTemplates(rootHandle);
    } else {
      alert('Permission denied for folder access.');
    }
  } catch (err) {
    console.error(err);
    alert('Failed to load folder.');
  }
});
