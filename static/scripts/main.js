/**
 * Diabetes Risk Predictor – Cyber & Obsidian Interaction Scripts
 */
document.addEventListener('DOMContentLoaded', function () {
  // 1. Theme Management (Obsidian Dark is Default)
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const root = document.documentElement;

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (themeIcon) {
      themeIcon.className = theme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
    }
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {}
  }

  const savedTheme = localStorage.getItem('theme') || 'dark';
  applyTheme(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', function (e) {
      e.preventDefault();
      const current = root.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  // 2. Mobile Hamburger Menu Toggle
  const hamburger = document.getElementById('hamburgerToggle');
  const navLinks = document.getElementById('mainNav');

  if (hamburger && navLinks) {
    hamburger.addEventListener('click', function (e) {
      e.stopPropagation();
      const isOpen = navLinks.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (isOpen) {
        navLinks.style.display = 'flex';
        navLinks.style.flexDirection = 'column';
        navLinks.style.position = 'absolute';
        navLinks.style.top = '72px';
        navLinks.style.left = '0';
        navLinks.style.right = '0';
        navLinks.style.background = 'var(--bg-surface)';
        navLinks.style.padding = '1.5rem';
        navLinks.style.borderBottom = '1px solid var(--border-light)';
        navLinks.style.boxShadow = 'var(--shadow-lg)';
      } else {
        navLinks.style.display = '';
      }
    });

    document.addEventListener('click', function (e) {
      if (navLinks.classList.contains('open') && !navLinks.contains(e.target) && !hamburger.contains(e.target)) {
        navLinks.classList.remove('open');
        navLinks.style.display = '';
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // 3. BMI Auto-Calculator (Height in cm + Weight in kg -> BMI)
  const heightInput = document.querySelector('input[name="height"]');
  const weightInput = document.querySelector('input[name="weight"]');
  const bmiInput = document.querySelector('input[name="bmi"]');

  function updateComputedBMI() {
    if (!heightInput || !weightInput || !bmiInput) return;
    const h = parseFloat(heightInput.value);
    const w = parseFloat(weightInput.value);
    if (h > 50 && w > 10) {
      const hm = h / 100;
      const computed = (w / (hm * hm)).toFixed(1);
      if (computed >= 10 && computed <= 70) {
        bmiInput.value = computed;
        bmiInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }

  if (heightInput && weightInput) {
    heightInput.addEventListener('input', updateComputedBMI);
    weightInput.addEventListener('input', updateComputedBMI);
  }

  // 4. Conditional Form Groups (Gestational & Family Member)
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

  // 5. Safe Form Submit Loader (Does NOT freeze or permanently disable on HTML5 validation)
  const predictionForms = document.querySelectorAll('form#quickForm, form#fullForm');
  predictionForms.forEach(function (form) {
    form.addEventListener('submit', function (e) {
      if (!form.checkValidity()) {
        return; // Let browser show validation tooltips, DO NOT disable button!
      }
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Running ML Inference...';
      }
    });
  });

  // 6. Bulk Upload Drag-and-Drop & Streaming Logic
  const bulkForm = document.getElementById('bulkUploadForm');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');
  const bulkLoading = document.getElementById('bulkLoading');
  const bulkStatus = document.getElementById('bulkStatus');

  function showFileDetails(name, size) {
    if (fileInfo && fileName) {
      const sizeStr = size ? ` (${(size / 1024).toFixed(1)} KB)` : '';
      fileName.textContent = name + sizeStr;
      fileInfo.style.display = 'flex';
    }
  }

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', function () {
      fileInput.click();
    });

    ['dragenter', 'dragover'].forEach(name => {
      dropZone.addEventListener(name, function (e) {
        e.preventDefault();
        dropZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(name => {
      dropZone.addEventListener(name, function (e) {
        e.preventDefault();
        dropZone.classList.remove('dragover');
      }, false);
    });

    dropZone.addEventListener('drop', function (e) {
      if (e.dataTransfer && e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        showFileDetails(e.dataTransfer.files[0].name, e.dataTransfer.files[0].size);
      }
    });

    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files.length) {
        showFileDetails(fileInput.files[0].name, fileInput.files[0].size);
      }
    });
  }

  if (bulkForm && fileInput) {
    bulkForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!fileInput.files || !fileInput.files.length) {
        if (bulkStatus) {
          bulkStatus.textContent = 'Please choose or drop a CSV file first.';
          bulkStatus.style.color = 'var(--status-high)';
        }
        return;
      }

      if (bulkLoading) bulkLoading.style.display = 'flex';
      if (bulkStatus) {
        bulkStatus.textContent = 'Processing dataset through ML ensemble...';
        bulkStatus.style.color = 'var(--neon-cyan)';
      }

      const file = fileInput.files[0];
      const reader = new FileReader();

      reader.onload = function (ev) {
        const text = ev.target.result;
        const formData = new FormData();
        const mode = bulkForm.querySelector('select[name="mode"]').value || 'quick';
        formData.append('mode', mode);
        formData.append('file_text', text);

        fetch('/bulk-predict-ajax', {
          method: 'POST',
          body: formData,
        })
          .then(async function (response) {
            if (!response.ok) {
              const err = await response.text();
              throw new Error(err || 'Server rejected CSV');
            }
            const blob = await response.blob();
            const cd = response.headers.get('Content-Disposition') || '';
            const m = cd.match(/filename\*?=(?:"([^"]+)"|([^;]+))/i);
            const downloadName = m ? (m[1] || m[2] || 'bulk_predictions.csv') : 'bulk_predictions.csv';

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadName;
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
