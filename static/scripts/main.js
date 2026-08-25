document.addEventListener('DOMContentLoaded', function () {
  // Theme toggle: initialize and persist preference
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark', isDark);
    if (themeIcon) themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    if (themeToggle) themeToggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  }
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const current = document.body.classList.contains('dark') ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('theme', next);
    });
  }

  const forms = document.querySelectorAll('form');
  forms.forEach(function (form) {
    form.addEventListener('submit', function () {
      if (form.id === 'bulkUploadForm') {
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Process Bulk Upload →';
        }
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');
      if (!submitButton) return;
      submitButton.disabled = true;
      submitButton.textContent = 'Processing...';
    });
  });

  // Show a loading hint when the bulk form is submitted (iframe-based fallback will handle download)
  const bulkForm = document.getElementById('bulkUploadForm');
  if (bulkForm) {
    bulkForm.addEventListener('submit', function (e) {
      // Prevent default full form submit and use AJAX file read + POST when possible
      e.preventDefault();
      const loader = document.getElementById('bulkLoading');
      const status = document.getElementById('bulkStatus');
      if (loader) loader.style.display = 'block';
      if (status) status.textContent = '';

      const fileInput = document.getElementById('fileInput');
      if (!fileInput || !fileInput.files || !fileInput.files.length) {
        if (status) status.textContent = 'No file selected';
        if (loader) loader.style.display = 'none';
        return;
      }

      const file = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = function (ev) {
        const text = ev.target.result;
        // Send text to server endpoint that accepts raw CSV text
        const form = new FormData();
        const mode = document.querySelector('#bulkUploadForm select[name="mode"]').value || 'quick';
        form.append('mode', mode);
        form.append('file_text', text);

        fetch('/bulk-predict-ajax', {
          method: 'POST',
          body: form,
        })
          .then(async function (response) {
            if (!response.ok) {
              const txt = await response.text();
              throw new Error(txt || 'Bulk prediction failed');
            }
            const blob = await response.blob();
            // get filename from header if present
            const cd = response.headers.get('Content-Disposition') || '';
            const m = cd.match(/filename\*?=(?:"([^"]+)"|([^;]+))/i);
            const filename = m ? (m[1] || m[2] || 'bulk_predictions.csv') : 'bulk_predictions.csv';
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            if (status) status.textContent = 'Prediction file downloaded successfully.';
          })
          .catch(function (err) {
            if (status) status.textContent = err.message || 'Bulk prediction failed';
          })
          .finally(function () {
            if (loader) loader.style.display = 'none';
          });
      };
      reader.onerror = function () {
        if (status) status.textContent = 'Failed to read file in browser';
        if (loader) loader.style.display = 'none';
      };
      reader.readAsText(file);
    });
  }

  const gender = document.querySelector('[name="gender"]');
  const gestationalGroup = document.getElementById('gestationalGroup');
  const familyHistory = document.querySelector('[name="family_history"]');
  const familyMemberGroup = document.getElementById('familyMemberGroup');

  if (gender) {
    gender.addEventListener('change', () => {
      if (gestationalGroup) {
        gestationalGroup.style.display = gender.value === 'Female' ? 'block' : 'none';
      }
    });
  }

  if (familyHistory) {
    familyHistory.addEventListener('change', () => {
      if (familyMemberGroup) {
        familyMemberGroup.style.display = familyHistory.value === 'Yes' ? 'block' : 'none';
      }
    });
  }

  const bmi = document.querySelector('[name="bmi"]');
  const glucose = document.querySelector('[name="glucose"]');
  const age = document.querySelector('[name="age"]');
  const preview = document.getElementById('livePreview');

  function updateRisk() {
    if (!preview || !bmi || !glucose || !age) return;
    const b = parseFloat(bmi.value) || 25;
    const g = parseFloat(glucose.value) || 100;
    const a = parseFloat(age.value) || 40;
    let risk = (b * 0.8 + g * 0.5 + a * 0.3) / 3;
    risk = Math.min(95, Math.max(5, risk));
    preview.innerHTML = `Estimated risk: ${Math.round(risk)}% (updates as you type)`;
  }

  if (bmi && glucose && age) {
    [bmi, glucose, age].forEach((element) => element.addEventListener('input', updateRisk));
  }

  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');
  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        showFileInfo(e.dataTransfer.files[0].name);
      }
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) {
        showFileInfo(fileInput.files[0].name);
      }
    });
  }

  function showFileInfo(name) {
    if (fileInfo && fileName) {
      fileName.textContent = name;
      fileInfo.style.display = 'block';
    }
  }
});