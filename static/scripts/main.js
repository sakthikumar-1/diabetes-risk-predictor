/**
 * GlucoShield Clinical AI – Interactive UX Scripts
 * Theme Management, Live Auto-Calculations, Validation & Async Data Handling
 */

document.addEventListener('DOMContentLoaded', function () {
  // -------------------------------------------------------------------------
  // 1. Theme Management (Light / Dark with System Preference & LocalStorage)
  // -------------------------------------------------------------------------
  const themeToggle = document.getElementById('themeToggle');
  const themeContainer = document.getElementById('themeIconContainer') || document.getElementById('themeToggle');
  const root = document.documentElement;

  const sunSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;
  const moonSVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;

  function updateThemeIcon(theme) {
    if (themeContainer) {
      themeContainer.innerHTML = theme === 'dark' ? sunSVG : moonSVG;
    }
    if (themeToggle) {
      themeToggle.setAttribute('title', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {}

    // Dispatch custom event for Chart.js theme updates
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
  }

  // Read current theme set by the inline head script
  const currentTheme = root.getAttribute('data-theme') || 'light';
  updateThemeIcon(currentTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', function (e) {
      e.preventDefault();
      const active = root.getAttribute('data-theme') || 'light';
      const target = active === 'dark' ? 'light' : 'dark';
      applyTheme(target);
    });
  }

  // -------------------------------------------------------------------------
  // 2. Mobile Responsive Navigation
  // -------------------------------------------------------------------------
  const mobileToggle = document.getElementById('mobileNavToggle') || document.getElementById('hamburgerToggle');
  const mainNav = document.getElementById('mainNav');

  if (mobileToggle && mainNav) {
    mobileToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      const isOpen = mainNav.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.addEventListener('click', function (e) {
      if (mainNav.classList.contains('open') && !mainNav.contains(e.target) && !mobileToggle.contains(e.target)) {
        mainNav.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // -------------------------------------------------------------------------
  // 3. Clinical BMI Auto-Calculator (Height in cm + Weight in kg -> BMI)
  // -------------------------------------------------------------------------
  const heightInput = document.querySelector('input[name="height"]') || document.getElementById('height');
  const weightInput = document.querySelector('input[name="weight"]') || document.getElementById('weight');
  const bmiInput = document.querySelector('input[name="bmi"]') || document.getElementById('bmi');

  function calculateBMI() {
    if (!heightInput || !weightInput || !bmiInput) return;
    const h = parseFloat(heightInput.value);
    const w = parseFloat(weightInput.value);

    if (h > 50 && w > 15) {
      const heightInMeters = h / 100;
      const bmiVal = (w / (heightInMeters * heightInMeters)).toFixed(1);
      if (bmiVal >= 10 && bmiVal <= 80) {
        bmiInput.value = bmiVal;
        bmiInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  if (heightInput && weightInput) {
    heightInput.addEventListener('input', calculateBMI);
    weightInput.addEventListener('input', calculateBMI);
  }

  // -------------------------------------------------------------------------
  // 4. Conditional Demographic Groups
  // -------------------------------------------------------------------------
  const genderSelect = document.querySelector('select[name="gender"]');
  const gestationalGroup = document.getElementById('gestationalGroup') || document.querySelector('[data-group="gestational"]');
  if (genderSelect && gestationalGroup) {
    function toggleGestational() {
      gestationalGroup.style.display = genderSelect.value === 'Female' ? 'flex' : 'none';
    }
    genderSelect.addEventListener('change', toggleGestational);
    toggleGestational();
  }

  const familySelect = document.querySelector('select[name="family_history"]');
  const familyMemberGroup = document.getElementById('familyMemberGroup') || document.querySelector('[data-group="family-member"]');
  if (familySelect && familyMemberGroup) {
    function toggleFamily() {
      familyMemberGroup.style.display = familySelect.value === 'Yes' ? 'flex' : 'none';
    }
    familySelect.addEventListener('change', toggleFamily);
    toggleFamily();
  }

  // -------------------------------------------------------------------------
  // 5. Non-Blocking Form Submission Feedback
  // -------------------------------------------------------------------------
  const assessmentForms = document.querySelectorAll('form#quickForm, form#fullForm, form.assessment-form');
  assessmentForms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!form.checkValidity()) {
        return; // Allow native validation tooltips to appear without locking button
      }
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Inference...';
        submitBtn.style.opacity = '0.85';
      }
    });
  });

  // -------------------------------------------------------------------------
  // 6. Bulk Screening CSV Upload & Processing
  // -------------------------------------------------------------------------
  const bulkForm = document.getElementById('bulkUploadForm');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');
  const bulkLoading = document.getElementById('bulkLoading');
  const bulkStatus = document.getElementById('bulkStatus');

  function displayFile(name, size) {
    if (fileInfo && fileName) {
      const sizeFormatted = size ? ` (${(size / 1024).toFixed(1)} KB)` : '';
      fileName.textContent = name + sizeFormatted;
      fileInfo.style.display = 'flex';
    }
  }

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', function () {
      fileInput.click();
    });

    ['dragenter', 'dragover'].forEach(evt => {
      dropZone.addEventListener(evt, function (e) {
        e.preventDefault();
        dropZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(evt => {
      dropZone.addEventListener(evt, function (e) {
        e.preventDefault();
        dropZone.classList.remove('dragover');
      }, false);
    });

    dropZone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        displayFile(e.dataTransfer.files[0].name, e.dataTransfer.files[0].size);
      }
    });

    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files.length) {
        displayFile(fileInput.files[0].name, fileInput.files[0].size);
      }
    });
  }

  if (bulkForm && fileInput) {
    bulkForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!fileInput.files || !fileInput.files.length) {
        if (bulkStatus) {
          bulkStatus.textContent = 'Please select a valid CSV file before submitting.';
          bulkStatus.style.color = 'var(--status-high)';
        }
        return;
      }

      if (bulkLoading) bulkLoading.style.display = 'flex';
      if (bulkStatus) {
        bulkStatus.textContent = 'Analyzing cohort data with clinical ML pipeline...';
        bulkStatus.style.color = 'var(--accent-primary)';
      }

      const file = fileInput.files[0];
      const reader = new FileReader();

      reader.onload = function (ev) {
        const text = ev.target.result;
        const formData = new FormData();
        const mode = bulkForm.querySelector('select[name="mode"]')?.value || 'quick';
        formData.append('mode', mode);
        formData.append('file_text', text);

        fetch('/bulk-predict-ajax', {
          method: 'POST',
          body: formData,
        })
          .then(async function (response) {
            if (!response.ok) {
              const err = await response.text();
              throw new Error(err || 'Server rejected CSV data');
            }
            const blob = await response.blob();
            const cd = response.headers.get('Content-Disposition') || '';
            const match = cd.match(/filename\*?=(?:"([^"]+)"|([^;]+))/i);
            const downloadFilename = match ? (match[1] || match[2] || 'bulk_predictions.csv') : 'bulk_predictions.csv';

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadFilename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);

            if (bulkStatus) {
              bulkStatus.textContent = '✔ Batch predictions computed and downloaded successfully!';
              bulkStatus.style.color = 'var(--status-low)';
            }
          })
          .catch(function (err) {
            if (bulkStatus) {
              bulkStatus.textContent = 'Error: ' + (err.message || 'Processing failed');
              bulkStatus.style.color = 'var(--status-high)';
            }
          })
          .finally(function () {
            if (bulkLoading) bulkLoading.style.display = 'none';
          });
      };

      reader.onerror = function () {
        if (bulkStatus) {
          bulkStatus.textContent = 'Failed to read file in browser.';
          bulkStatus.style.color = 'var(--status-high)';
        }
        if (bulkLoading) bulkLoading.style.display = 'none';
      };

      reader.readAsText(file);
    });
  }
});
