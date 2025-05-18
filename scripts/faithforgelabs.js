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

async function renderGuideSteps(root) {
  try {
    // Get the config file
    const configDir = await root.getDirectoryHandle("configs");
    const appDir = await configDir.getDirectoryHandle("app");
    const stepsFile = await appDir.getFileHandle("guide_steps.json");
    const stepsJson = await stepsFile.getFile();
    const steps = JSON.parse(await stepsJson.text());

    // Render steps
    const container = document.getElementById('steps-list');
    if (container) {
      container.innerHTML = '';
      steps.forEach((step, index) => {
        const div = document.createElement('div');
        div.className = 'step';
        div.innerHTML = `
          <label><input type="checkbox"> Step ${index + 1}: ${step.title}</label>
          <p>${step.description}</p>
          <textarea class="notes" rows="3" placeholder="Notes for this step..."></textarea>
          <div class="image-slot">
            <img src="${step.image}" alt="${step.title} Image" onerror="this.style.display='none';" />
          </div>
        `;
        container.appendChild(div);
      });
    }
  } catch (err) {
    console.error("Failed to load guide steps:", err);
  }
}

// Call this after loading templates
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
      app.insertAdjacentHTML('beforeend', html);
    } catch (err) {
      console.warn(`Failed to load ${name}:`, err);
    }
  }

  setupToggles();
  await renderGuideSteps(root); // <-- Add this line
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
