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

async function renderLogoReview(root) {
  try {
    const configDir = await root.getDirectoryHandle("configs");
    const appDir = await configDir.getDirectoryHandle("app");
    const logoFile = await appDir.getFileHandle("logo_review.json");
    const logoJson = await logoFile.getFile();
    const config = JSON.parse(await logoJson.text());

    const properties = config.properties;
    const logos = config.logos;

    // Group properties by category
    const categories = {};
    properties.forEach(prop => {
      if (!categories[prop.category]) categories[prop.category] = [];
      categories[prop.category].push(prop);
    });

    // Render table headers
    const thead = document.getElementById('logo-review-thead');
    const tbody = document.getElementById('logo-review-tbody');
    if (thead && tbody) {
      // First header row: categories
      let categoryRow = `<tr>
        <th rowspan="2">Thumbnail</th>
        <th rowspan="2">Filename</th>`;
      Object.entries(categories).forEach(([cat, props]) => {
        categoryRow += `<th colspan="${props.length}">${cat}</th>`;
      });
      categoryRow += `<th rowspan="2">Total</th><th rowspan="2">Notes</th></tr>`;

      // Second header row: property names
      let propRow = '<tr>';
      Object.values(categories).forEach(props => {
        props.forEach(prop => {
          propRow += `<th>${prop.name}</th>`;
        });
      });
      propRow += '</tr>';

      thead.innerHTML = categoryRow + propRow;

      // Render table body
      tbody.innerHTML = '';
      logos.forEach((logo, idx) => {
        let row = `<tr>
          <td><a href="logo/${logo.filename}" target="_blank"><img src="logo/${logo.filename}" class="thumb" alt="${logo.filename}"></a></td>
          <td>${logo.filename}</td>`;
        let total = 0;
        properties.forEach(prop => {
          const val = logo.scores?.[prop.key] ?? '';
          row += `<td><input type="number" min="1" max="10" value="${val}" data-row="${idx}" data-key="${prop.key}"></td>`;
          total += Number(val) || 0;
        });
        row += `<td class="total-cell">${total}</td>
          <td><textarea placeholder="Your notes..." data-row="${idx}">${logo.notes || ''}</textarea></td>
        </tr>`;
        tbody.insertAdjacentHTML('beforeend', row);
      });

      // Add live total calculation and update config on input
      tbody.querySelectorAll('tr').forEach((row, idx) => {
        const inputs = row.querySelectorAll('input[type="number"]');
        const totalCell = row.querySelector('.total-cell');
        const textarea = row.querySelector('textarea');
        function updateTotalAndSave() {
          let sum = 0;
          inputs.forEach(input => {
            const key = input.getAttribute('data-key');
            const val = Number(input.value) || 0;
            sum += val;
            config.logos[idx].scores[key] = val;
          });
          totalCell.textContent = sum;
          config.logos[idx].notes = textarea.value;
          // Optionally, save config here
        }
        inputs.forEach(input => {
          input.addEventListener('input', updateTotalAndSave);
        });
        textarea.addEventListener('input', updateTotalAndSave);
        updateTotalAndSave();
      });
    }
  } catch (err) {
    console.error("Failed to load logo review data:", err);
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
      const section = document.createElement('section');
      section.innerHTML = html;
      app.appendChild(section);
    } catch (err) {
      console.warn(`Failed to load ${name}:`, err);
    }
  }

  setupToggles();
  await renderGuideSteps(root);
  await renderLogoReview(root);
}

// No loader, IndexedDB, or permission logic here anymore!
// The loader will call loadTemplates(rootHandle) as needed.
