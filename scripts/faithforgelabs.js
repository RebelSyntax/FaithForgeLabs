let rootHandle = null;

async function verifyPermission(handle, mode = 'readwrite') {
  const options = { mode };
  if ((await handle.queryPermission(options)) === 'granted') return true;
  if ((await handle.requestPermission(options)) === 'granted') return true;
  return false;
}

function toggleContent(id) {
  // Close all other sections and remove active-header
  document.querySelectorAll('.collapsible-content').forEach(content => {
    if (content.id !== id) {
      content.classList.remove('open');
      const toggle = document.querySelector(`.collapsible-toggle[data-target="${content.id}"]`);
      if (toggle) toggle.classList.remove('active-header');
    }
  });
  // Toggle the selected section
  const content = document.getElementById(id);
  const toggle = document.querySelector(`.collapsible-toggle[data-target="${id}"]`);
  if (content) {
    content.classList.toggle('open');
    if (toggle) toggle.classList.toggle('active-header', content.classList.contains('open'));
    if (content.classList.contains('open')) {
      // Move the parent section to the end
      const section = content.closest('section');
      if (section && section.parentNode) {
        section.parentNode.appendChild(section);
      }
    }
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
