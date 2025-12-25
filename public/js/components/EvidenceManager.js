/**
 * EvidenceManager Component
 *
 * Encapsulated class for managing evidence file uploads with:
 * - Drag-drop support
 * - Client-side validation
 * - Progress tracking
 * - Error handling & retry
 *
 * Usage:
 *   const evidence = new EvidenceManager('evidence-container', {
 *     caseId: '...',
 *     maxSizeMB: 50,
 *     allowedTypes: ['image/*', 'application/pdf', 'application/msword']
 *   });
 *
 * Anti-drift:
 * - NO global state
 * - Validation before upload (prevent bad data)
 * - Clean error boundaries
 */

export class EvidenceManager {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.caseId = options.caseId;
    this.maxSizeMB = options.maxSizeMB || 50;
    this.allowedTypes = options.allowedTypes || [
      'image/*',
      'application/pdf',
      '.doc',
      '.docx',
      '.xls',
      '.xlsx',
      '.txt'
    ];
    this.uploadForm = null;
    this.fileInput = null;
    this.uploadButton = null;
    this.progressContainer = null;
    this.progressBar = null;
    this.progressText = null;
    this.gallery = null;
    this.selectedFile = null;
    this.currentUpload = null;

    if (!this.container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    this.init();
  }

  /**
   * Initialize component
   */
  init() {
    this.uploadForm = this.container.querySelector('#upload-form');
    this.fileInput = this.container.querySelector('#file-input');
    this.uploadButton = this.container.querySelector('#upload-button');
    this.progressContainer = this.container.querySelector(
      '#progress-container'
    );
    this.progressBar = this.container.querySelector('#progress-bar');
    this.progressText = this.container.querySelector('#progress-text');
    this.gallery = this.container.querySelector('[data-evidence-gallery]');

    if (!this.uploadForm) {
      console.warn('Upload form not found in container');
      return;
    }

    // Attach listeners
    this.attachListeners();

    // Drag-drop support
    this.setupDragDrop();
  }

  /**
   * Attach event listeners
   */
  attachListeners() {
    // File input change
    if (this.fileInput) {
      this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    // Form submission
    this.uploadForm.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  /**
   * Setup drag-drop zone (SSOT Aligned)
   */
  setupDragDrop() {
    const dropZone = this.uploadForm.querySelector('[data-drop-zone]');
    if (!dropZone) return;

    // Prevent defaults...
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, this.preventDefaults.bind(this));
    });

    // Use SSOT variables for drag states
    ['dragenter', 'dragover'].forEach((eventName) => {
      dropZone.addEventListener(eventName, () => {
        if (dropZone instanceof HTMLElement) {
          dropZone.style.borderColor = 'var(--vmp-ok)';
          dropZone.style.backgroundColor = 'hsl(var(--success-default) / 0.1)';
        }
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, () => {
        if (dropZone instanceof HTMLElement) {
          dropZone.style.borderColor = '';
          dropZone.style.backgroundColor = '';
        }
      });
    });

    dropZone.addEventListener('drop', (e) => {
      var dt = null;
      if (e && typeof DragEvent !== 'undefined' && e instanceof DragEvent) {
        dt = e.dataTransfer;
      }
      if (!dt) return;
      var files = dt.files;
      if (files.length > 0 && this.fileInput && this.fileInput instanceof HTMLInputElement) {
        this.fileInput.files = files;
        this.handleFileSelect({ target: { files: files } });
      }
    });
  }

  /**
   * Prevent default drag-drop behavior
   */
  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Handle file selection
   */
  handleFileSelect(event) {
    const files = event.target.files;
    if (files.length === 0) return;

    this.selectedFile = files[0];

    // Validate before showing upload button
    const validation = this.validateFile(this.selectedFile);
    if (!validation.valid) {
      this.showError(validation.error);
      this.selectedFile = null;
      return;
    }

    // Show upload button
    if (this.uploadButton && this.uploadButton instanceof HTMLElement) {
      this.uploadButton.style.display = 'block';
    }
  }

  /**
   * Validate file before upload
   */
  validateFile(file) {
    if (!file) {
      return { valid: false, error: 'No file selected' };
    }

    // Check size
    const sizeMB = file.size / 1024 / 1024;
    if (sizeMB > this.maxSizeMB) {
      return {
        valid: false,
        error: `File is too large (${sizeMB.toFixed(2)}MB). Max size is ${this.maxSizeMB}MB.`
      };
    }

    // Check type (basic check - allow most files)
    const allowedExtensions = [
      'pdf',
      'doc',
      'docx',
      'xls',
      'xlsx',
      'txt',
      'jpg',
      'jpeg',
      'png',
      'gif'
    ];
    const ext = file.name.split('.').pop().toLowerCase();
    const isMimeTypeOk =
      file.type.startsWith('image/') || file.type === 'application/pdf';
    const isExtOk = allowedExtensions.includes(ext);

    if (!isMimeTypeOk && !isExtOk) {
      return {
        valid: false,
        error: `File type not supported. Allowed: ${allowedExtensions.join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * Handle form submission
   */
  async handleSubmit(event) {
    event.preventDefault();

    if (!this.selectedFile) return;

    const formData = new FormData();
    formData.append('file', this.selectedFile);

    // Disable button & show progress
    if (this.uploadButton && this.uploadButton instanceof HTMLButtonElement) this.uploadButton.disabled = true;
    if (this.progressContainer && this.progressContainer instanceof HTMLElement) {
      this.progressContainer.style.display = 'block';
    }

    try {
      this.currentUpload = await this.uploadWithProgress(formData);

      // Refresh gallery
      if (this.gallery) {
        this.gallery.innerHTML = '';
        await this.loadGallery();
      } else {
        // Fallback: reload page
        location.reload();
      }

      // Reset form
      this.resetForm();
    } catch (error) {
      console.error('Upload error:', error);
      this.showError(error.message || 'Upload failed. Please try again.');

      if (this.progressContainer && this.progressContainer instanceof HTMLElement) {
        this.progressContainer.style.display = 'none';
      }
      if (this.uploadButton && this.uploadButton instanceof HTMLButtonElement) {
        this.uploadButton.disabled = false;
      }
    }
  }

  /**
   * Upload with progress tracking
   */
  uploadWithProgress(formData) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = (e.loaded / e.total) * 100;
          if (this.progressBar && this.progressBar instanceof HTMLElement) {
            this.progressBar.style.width = percent + '%';
          }
          if (this.progressText) {
            this.progressText.textContent = `Uploading ${Math.round(percent)}%...`;
          }
        }
      });

      // Completion
      xhr.addEventListener('load', () => {
        if (xhr.status === 201) {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } else {
          reject(
            new Error(
              `Server error: ${xhr.status} ${xhr.statusText}`
            )
          );
        }
      });

      // Error
      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      // Send request
      xhr.open('POST', `/api/cases/${this.caseId}/evidence`);
      xhr.send(formData);
    });
  }

  /**
   * Load gallery from server
   */
  async loadGallery() {
    try {
      const response = await fetch(`/cases/${this.caseId}/evidence`);
      if (!response.ok) throw new Error('Could not load gallery');

      const html = await response.text();
      if (this.gallery) {
        this.gallery.innerHTML = html;
      }
    } catch (error) {
      console.error('Gallery load error:', error);
    }
  }

  /**
   * Reset form state
   */
  resetForm() {
    this.selectedFile = null;
    if (this.fileInput && this.fileInput instanceof HTMLInputElement) this.fileInput.value = '';
    if (this.uploadButton && this.uploadButton instanceof HTMLElement) this.uploadButton.style.display = 'none';
    if (this.progressContainer && this.progressContainer instanceof HTMLElement) {
      this.progressContainer.style.display = 'none';
    }
    if (this.progressBar && this.progressBar instanceof HTMLElement) {
      this.progressBar.style.width = '0%';
    }
  }

  /**
   * Show error using new Toast system
   */
  showError(message) {
    if (window['vmpToast']) {
      window['vmpToast'].error('Upload Failed', message);
    } else {
      alert(message); // Fallback
    }
  }

  /**
   * Cancel current upload
   */
  cancel() {
    if (this.currentUpload) {
      // Note: XMLHttpRequest doesn't allow direct abort from here
      // Would need to track xhr and call abort
      this.resetForm();
    }
  }
}

// Auto-initialize if data attributes present
document.addEventListener('DOMContentLoaded', () => {
  const evidenceContainer = document.querySelector('[data-evidence-manager]');
  if (evidenceContainer) {
    window['evidenceManager'] = new EvidenceManager('evidence-container', {
      caseId: evidenceContainer && evidenceContainer instanceof HTMLElement && evidenceContainer.dataset ? evidenceContainer.dataset.caseId : undefined,
      maxSizeMB: evidenceContainer && evidenceContainer instanceof HTMLElement && evidenceContainer.dataset && evidenceContainer.dataset.maxSizeMb ? parseInt(evidenceContainer.dataset.maxSizeMb) : 50
    });
  }
});
