function toggleContent(id, root=document) {
  root.querySelectorAll('.collapsible-content').forEach(content => {
    if (content.id !== id) {
      content.classList.remove('open');
      const toggle = root.querySelector(`.collapsible-toggle[data-target="${content.id}"]`);
      if (toggle) toggle.classList.remove('active-header');
    }
  });
  const content = root.getElementById ? root.getElementById(id) : root.querySelector(`#${id}`);
  const toggle = root.querySelector(`.collapsible-toggle[data-target="${id}"]`);
  if (content) {
    content.classList.toggle('open');
    if (toggle) toggle.classList.toggle('active-header', content.classList.contains('open'));
    if (content.classList.contains('open')) {
      const section = content.closest('section');
      if (section && section.parentNode) {
        section.parentNode.appendChild(section);
      }
    }
  }
}

function setupToggles(root=document) {
  root.querySelectorAll('.collapsible-toggle').forEach(toggle => {
    const id = toggle.getAttribute("data-target");
    if (!id) return;

    // Prevent duplicate listeners on reload
    if (toggle._bound) return;
    toggle.addEventListener("click", () => toggleContent(id, root));
    toggle._bound = true;
  });
}

async function renderGuideSteps(root, domRoot=document) {
  try {
    const configDir = await root.getDirectoryHandle("configs");
    const appDir = await configDir.getDirectoryHandle("app");
    const stepsFile = await appDir.getFileHandle("guide_steps.json");
    const stepsJson = await stepsFile.getFile();
    const steps = JSON.parse(await stepsJson.text());

    const container = domRoot.getElementById ? domRoot.getElementById('steps-list') : domRoot.querySelector('#steps-list');
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

async function renderLogoReview(root, domRoot=document) {
  try {
    const configDir = await root.getDirectoryHandle("configs");
    const appDir = await configDir.getDirectoryHandle("app");
    const logoFile = await appDir.getFileHandle("logo_review_expanded.json");
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

    // Find or create the gallery container
    let gallery = domRoot.getElementById ? domRoot.getElementById('logo-gallery') : domRoot.querySelector('#logo-gallery');
    if (!gallery) {
      gallery = document.createElement('div');
      gallery.id = 'logo-gallery';
      gallery.style.display = 'flex';
      gallery.style.flexWrap = 'wrap';
      gallery.style.gap = '1.5em';
      gallery.style.justifyContent = 'center';
      if (domRoot.body) domRoot.body.appendChild(gallery);
      else domRoot.appendChild(gallery);
    }
    gallery.innerHTML = '';

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save All Ratings';
    saveBtn.style.margin = '2em auto 1em auto';
    saveBtn.style.display = 'block';
    saveBtn.style.padding = '0.7em 2em';
    saveBtn.style.fontSize = '1.1em';
    saveBtn.style.background = '#5a6dc6';
    saveBtn.style.color = '#fff';
    saveBtn.style.border = 'none';
    saveBtn.style.borderRadius = '8px';
    saveBtn.style.cursor = 'pointer';
    saveBtn.style.boxShadow = '0 2px 8px #e0e4ef33';
    saveBtn.style.fontWeight = '600';
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      try {
        // Get the file handle again (or reuse if you have it)
        const configDir = await root.getDirectoryHandle("configs");
        const appDir = await configDir.getDirectoryHandle("app");
        const logoFile = await appDir.getFileHandle("logo_review_expanded.json", { create: true });
        const writable = await logoFile.createWritable();
        await writable.write(JSON.stringify(config, null, 2));
        await writable.close();
        saveBtn.textContent = 'Saved!';
        setTimeout(() => { saveBtn.textContent = 'Save All Ratings'; saveBtn.disabled = false; }, 1500);
      } catch (err) {
        saveBtn.textContent = 'Save Failed!';
        saveBtn.style.background = '#b71c1c';
        setTimeout(() => { saveBtn.textContent = 'Save All Ratings'; saveBtn.style.background = '#5a6dc6'; saveBtn.disabled = false; }, 2500);
        console.error('Failed to save logo review:', err);
      }
    };
    if (gallery.parentNode) gallery.parentNode.insertBefore(saveBtn, gallery);
    else domRoot.appendChild(saveBtn);

    // Modal overlay for large view
    let modal = domRoot.getElementById ? domRoot.getElementById('logo-modal') : domRoot.querySelector('#logo-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'logo-modal';
      modal.style.position = 'fixed';
      modal.style.top = '0';
      modal.style.left = '0';
      modal.style.width = '100vw';
      modal.style.height = '100vh';
      modal.style.background = 'rgba(0,0,0,0.7)';
      modal.style.display = 'none';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
      modal.style.zIndex = '10000';
      modal.style.overflow = 'auto';
      domRoot.body ? domRoot.body.appendChild(modal) : domRoot.appendChild(modal);
    }
    modal.innerHTML = '';

    function showModal(logo, idx) {
      modal.innerHTML = '';
      modal.style.display = 'flex';
      const modalCard = document.createElement('div');
      modalCard.style.background = '#fff';
      modalCard.style.borderRadius = '16px';
      modalCard.style.boxShadow = '0 4px 24px #0002';
      modalCard.style.display = 'flex';
      modalCard.style.flexDirection = 'row';
      modalCard.style.alignItems = 'flex-start';
      modalCard.style.padding = '2em';
      modalCard.style.gap = '2em';
      modalCard.style.maxWidth = '90vw';
      modalCard.style.maxHeight = '90vh';
      modalCard.style.overflow = 'auto';

      // Large image with zoom
      const imgWrap = document.createElement('div');
      imgWrap.style.flex = '1 1 0';
      imgWrap.style.display = 'flex';
      imgWrap.style.flexDirection = 'column';
      imgWrap.style.alignItems = 'center';
      const img = document.createElement('img');
      img.src = `logo/${logo.filename}`;
      img.alt = logo.filename;
      img.style.maxWidth = '60vw';
      img.style.maxHeight = '80vh';
      img.style.borderRadius = '10px';
      img.style.cursor = 'zoom-in';
      img.title = 'Click to zoom';
      let zoomed = false;
      img.onclick = () => {
        zoomed = !zoomed;
        img.style.maxWidth = zoomed ? '95vw' : '60vw';
        img.style.maxHeight = zoomed ? '95vh' : '80vh';
        img.style.cursor = zoomed ? 'zoom-out' : 'zoom-in';
      };
      imgWrap.appendChild(img);
      // Filename
      const fname = document.createElement('div');
      fname.textContent = logo.filename;
      fname.style.fontWeight = 'bold';
      fname.style.margin = '1em 0 0.5em 0';
      imgWrap.appendChild(fname);
      modalCard.appendChild(imgWrap);

      // Score card and notes
      const right = document.createElement('div');
      right.style.flex = '1 1 0';
      right.style.display = 'flex';
      right.style.flexDirection = 'column';
      right.style.gap = '1em';
      right.style.minWidth = '260px';
      // Score card
      let total = 0;
      const scoreCard = document.createElement('div');
      scoreCard.className = 'score-card';
      for (const [cat, props] of Object.entries(categories)) {
        const catDiv = document.createElement('div');
        catDiv.style.marginBottom = '0.5em';
        const catLabel = document.createElement('div');
        catLabel.textContent = cat;
        catLabel.style.fontWeight = '600';
        catLabel.style.marginBottom = '0.2em';
        catDiv.appendChild(catLabel);
        props.forEach(prop => {
          const label = document.createElement('label');
          label.style.display = 'block';
          label.style.marginBottom = '0.2em';
          label.textContent = prop.label + ': ';
          const input = document.createElement('input');
          input.type = 'number';
          input.min = 1;
          input.max = 10;
          input.value = logo.scores?.[prop.key] ?? '';
          input.style.width = '3em';
          input.setAttribute('data-row', idx);
          input.setAttribute('data-key', prop.key);
          label.appendChild(input);
          catDiv.appendChild(label);
          total += Number(input.value) || 0;
        });
        scoreCard.appendChild(catDiv);
      }
      right.appendChild(scoreCard);
      // Total
      const totalDiv = document.createElement('div');
      totalDiv.className = 'total-cell';
      totalDiv.textContent = 'Total: ' + total;
      totalDiv.style.fontWeight = '600';
      totalDiv.style.marginBottom = '0.7em';
      right.appendChild(totalDiv);
      // Notes
      const notes = document.createElement('textarea');
      notes.placeholder = 'Your notes...';
      notes.rows = 4;
      notes.style.width = '100%';
      notes.value = logo.notes || '';
      notes.setAttribute('data-row', idx);
      right.appendChild(notes);
      // Live update logic
      const inputs = scoreCard.querySelectorAll('input[type="number"]');
      function updateTotalAndSave() {
        let sum = 0;
        inputs.forEach(input => {
          const key = input.getAttribute('data-key');
          const val = Number(input.value) || 0;
          sum += val;
          config.logos[idx].scores[key] = val;
        });
        totalDiv.textContent = 'Total: ' + sum;
        config.logos[idx].notes = notes.value;
        // Optionally, save config here
      }
      inputs.forEach(input => {
        input.addEventListener('input', updateTotalAndSave);
      });
      notes.addEventListener('input', updateTotalAndSave);
      updateTotalAndSave();
      modalCard.appendChild(right);

      // Close button
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '×';
      closeBtn.style.position = 'absolute';
      closeBtn.style.top = '2vh';
      closeBtn.style.right = '3vw';
      closeBtn.style.fontSize = '2.5em';
      closeBtn.style.background = 'none';
      closeBtn.style.border = 'none';
      closeBtn.style.color = '#fff';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.zIndex = '10001';
      closeBtn.title = 'Close';
      closeBtn.onclick = () => { modal.style.display = 'none'; };
      modal.appendChild(modalCard);
      modal.appendChild(closeBtn);
    }

    // Render thumbnail gallery
    logos.forEach((logo, idx) => {
      const thumb = document.createElement('div');
      thumb.className = 'logo-thumb';
      thumb.style.border = '1px solid #e0e4ef';
      thumb.style.borderRadius = '10px';
      thumb.style.background = '#fff';
      thumb.style.padding = '0.5em';
      thumb.style.width = '120px';
      thumb.style.height = '120px';
      thumb.style.display = 'flex';
      thumb.style.alignItems = 'center';
      thumb.style.justifyContent = 'center';
      thumb.style.cursor = 'pointer';
      thumb.style.boxShadow = '0 1px 4px #e0e4ef33';
      thumb.style.overflow = 'hidden';
      thumb.style.transition = 'box-shadow 0.2s, border 0.2s';
      thumb.onmouseenter = () => { thumb.style.boxShadow = '0 4px 16px #b3c6ff55'; thumb.style.border = '1.5px solid #5a6dc6'; };
      thumb.onmouseleave = () => { thumb.style.boxShadow = '0 1px 4px #e0e4ef33'; thumb.style.border = '1px solid #e0e4ef'; };
      const img = document.createElement('img');
      img.src = `logo/${logo.filename}`;
      img.alt = logo.filename;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      img.onerror = () => { img.style.display = 'none'; };
      thumb.appendChild(img);
      thumb.onclick = () => showModal(logo, idx);
      gallery.appendChild(thumb);
    });

    // Hide modal on background click
    modal.onclick = (e) => {
      if (e.target === modal) modal.style.display = 'none';
    };
  } catch (err) {
    console.error("Failed to load logo review data:", err);
  }
}

// Call this after loading templates
async function loadTemplates(root, config, appContext) {
  const app = document.getElementById("app-content");
  app.innerHTML = '';

  // Attach shadow root if not already present
  let shadow = app.shadowRoot;
  if (!shadow) {
    shadow = app.attachShadow({ mode: 'open' });
  } else {
    shadow.innerHTML = '';
  }

  // Always load these stylesheets from the styles folder into shadow root
  if (appContext && appContext.folderHandles && appContext.folderHandles.styles) {
    const stylesDir = appContext.folderHandles.styles;
    const styleFiles = ["style.css"]; // Add more filenames as needed
    for (const styleFile of styleFiles) {
      try {
        const cssFile = await stylesDir.getFileHandle(styleFile);
        const css = await (await cssFile.getFile()).text();
        const styleTag = document.createElement('style');
        styleTag.textContent = css;
        shadow.appendChild(styleTag);
      } catch (e) {
        console.warn(`Could not load style: ${styleFile}`, e);
      }
    }
  }

  const templateFiles = ["title.html", "tools.html", "guide.html", "logo-review.html"];
  const templateDir = await root.getDirectoryHandle("templates");

  for (const name of templateFiles) {
    try {
      const fileHandle = await templateDir.getFileHandle(name);
      const file = await fileHandle.getFile();
      const html = await file.text();
      const section = document.createElement('section');
      section.innerHTML = html;
      shadow.appendChild(section);
    } catch (err) {
      console.warn(`Failed to load ${name}:`, err);
    }
  }

  setupToggles(shadow);
  await renderGuideSteps(root, shadow);
  await renderLogoReview(root, shadow);
}

// Entry point for the loader: attach to appContext, not window/global
appContext.enterhere = function(root, config, appContext) {
  loadTemplates(root, config, appContext);
};
