document.addEventListener('DOMContentLoaded', function () {
  // ============================================================
  // THEME TOGGLE 
  // ============================================================
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.body.classList.toggle('dark', isDark);
    if (themeIcon) {
      themeIcon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    }
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    }
    localStorage.setItem('theme', theme);
  }

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  }

  // ============================================================
  // HAMBURGER MENU TOGGLE
  // ============================================================
  const hamburger = document.getElementById('hamburgerToggle');
  const navLinks = document.getElementById('mainNav');

  if (hamburger && navLinks) {
    const toggleMenu = function (open) {
      const isOpen = open !== undefined ? open : !navLinks.classList.contains('open');
      navLinks.classList.toggle('open', isOpen);
      hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    hamburger.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu();
    });

    // Close when clicking outside
    document.addEventListener('click', function (e) {
      if (navLinks.classList.contains('open') &&
          !hamburger.contains(e.target) &&
          !navLinks.contains(e.target)) {
        toggleMenu(false);
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navLinks.classList.contains('open')) {
        toggleMenu(false);
        hamburger.focus();
      }
    });

    // Close when a nav link is clicked (mobile)
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        if (window.innerWidth <= 768) {
          toggleMenu(false);
        }
      });
    });

    // Handle window resize – close menu if switching to desktop
    let resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (window.innerWidth > 768 && navLinks.classList.contains('open')) {
          toggleMenu(false);
        }
      }, 200);
    });
  }

  // ============================================================
  // FORM SUBMIT HANDLING
  // ============================================================
  const forms = document.querySelectorAll('form');
  forms.forEach(function (form) {
    form.addEventListener('submit', function () {
      // Skip bulk upload – handled separately
      if (form.id === 'bulkUploadForm') return;

      const submitButton = form.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Processing...';
        // Re-enable after 30 seconds (fallback)
        setTimeout(function () {
          submitButton.disabled = false;
          submitButton.textContent = submitButton.dataset.originalText || 'Submit';
        }, 30000);
        // Store original text
        if (!submitButton.dataset.originalText) {
          submitButton.dataset.originalText = submitButton.textContent;
        }
      }
    });
  });

  // ============================================================
  // BULK UPLOAD – FileReader fallback
  // ============================================================
  const bulkForm = document.getElementById('bulkUploadForm');
  if (bulkForm) {
    bulkForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const loader = document.getElementById('bulkLoading');
      const status = document.getElementById('bulkStatus');
      const fileInput = document.getElementById('fileInput');

      if (loader) loader.style.display = 'block';
      if (status) status.textContent = '';

      if (!fileInput || !fileInput.files || !fileInput.files.length) {
        if (status) status.textContent = 'No file selected';
        if (loader) loader.style.display = 'none';
        return;
      }

      const file = fileInput.files[0];
      const reader = new FileReader();

      reader.onload = function (ev) {
        const text = ev.target.result;
        const formData = new FormData();
        const mode = document.querySelector('#bulkUploadForm select[name="mode"]').value || 'quick';
        formData.append('mode', mode);
        formData.append('file_text', text);

        fetch('/bulk-predict-ajax', {
          method: 'POST',
          body: formData,
        })
          .then(async function (response) {
            if (!response.ok) {
              const txt = await response.text();
              throw new Error(txt || 'Bulk prediction failed');
            }
            const blob = await response.blob();
            const cd = response.headers.get('Content-Disposition') || '';
            const match = cd.match(/filename\*?=(?:"([^"]+)"|([^;]+))/i);
            const filename = match ? (match[1] || match[2] || 'bulk_predictions.csv') : 'bulk_predictions.csv';
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

  // ============================================================
  // CONDITIONAL FIELDS (Assessment page)
  // ============================================================
  const gender = document.querySelector('[name="gender"]');
  const gestationalGroup = document.getElementById('gestationalGroup');
  const familyHistory = document.querySelector('[name="family_history"]');
  const familyMemberGroup = document.getElementById('familyMemberGroup');

  if (gender && gestationalGroup) {
    gender.addEventListener('change', function () {
      gestationalGroup.style.display = gender.value === 'Female' ? 'block' : 'none';
    });
    // Initial state
    gestationalGroup.style.display = gender.value === 'Female' ? 'block' : 'none';
  }

  if (familyHistory && familyMemberGroup) {
    familyHistory.addEventListener('change', function () {
      familyMemberGroup.style.display = familyHistory.value === 'Yes' ? 'block' : 'none';
    });
    familyMemberGroup.style.display = familyHistory.value === 'Yes' ? 'block' : 'none';
  }

  // ============================================================
  // LIVE RISK PREVIEW (Quick mode)
  // ============================================================
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
    preview.innerHTML = 'Estimated risk: ' + Math.round(risk) + '% (updates as you type)';
  }

  if (bmi && glucose && age && preview) {
    [bmi, glucose, age].forEach(function (el) {
      el.addEventListener('input', updateRisk);
    });
    // Initial calculation
    updateRisk();
  }

  // ============================================================
  // BULK DROP ZONE
  // ============================================================
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const fileInfo = document.getElementById('fileInfo');
  const fileName = document.getElementById('fileName');

  function showFileInfo(name) {
    if (fileInfo && fileName) {
      fileName.textContent = name;
      fileInfo.style.display = 'block';
    }
  }

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', function () {
      fileInput.click();
    });

    dropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', function () {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        showFileInfo(e.dataTransfer.files[0].name);
      }
    });

    fileInput.addEventListener('change', function () {
      if (fileInput.files && fileInput.files.length) {
        showFileInfo(fileInput.files[0].name);
      }
    });
  }
});
