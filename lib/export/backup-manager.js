/**
 * Backup Manager
 * Full database export/import for backup and migration
 */

import { downloadFile, generateExportFilename } from './markdown-exporter.js';

/**
 * Export entire database as JSON
 */
export async function exportDatabase(database) {
  const data = await database.exportAll();

  // Add export metadata
  data.exportMetadata = {
    version: '1.0.0',
    exportedAt: Date.now(),
    platform: navigator.platform,
    userAgent: navigator.userAgent
  };

  return data;
}

/**
 * Download database as JSON file
 */
export async function downloadDatabaseBackup(database) {
  const data = await exportDatabase(database);
  const json = JSON.stringify(data, null, 2);
  const filename = generateExportFilename('super-bookmarks-backup', 'json');

  downloadFile(json, filename, 'application/json');

  return {
    filename,
    size: json.length,
    notesCount: data.notes.length,
    embeddingsCount: data.embeddings.length,
    tagsCount: data.tags.length
  };
}

/**
 * Import database from JSON file
 */
export async function importDatabase(database, file, options = {}) {
  const {
    clearExisting = false,
    onProgress = () => {}
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        onProgress({ status: 'parsing', message: 'Parsing backup file...' });

        const data = JSON.parse(e.target.result);

        // Validate data structure
        if (!data.notes || !Array.isArray(data.notes)) {
          throw new Error('Invalid backup file: missing notes array');
        }

        onProgress({ status: 'importing', message: 'Importing data...' });

        const result = await database.importAll(data, { clearExisting });

        onProgress({ status: 'complete', message: 'Import complete!' });

        resolve({
          success: true,
          ...result,
          version: data.version,
          exportedAt: data.exportedAt
        });

      } catch (error) {
        reject(new Error(`Failed to import: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Validate backup file without importing
 */
export function validateBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);

        // Check required fields
        const validation = {
          isValid: true,
          errors: [],
          stats: {
            notesCount: 0,
            embeddingsCount: 0,
            tagsCount: 0,
            version: 'unknown',
            exportedAt: null
          }
        };

        if (!data.notes || !Array.isArray(data.notes)) {
          validation.isValid = false;
          validation.errors.push('Missing or invalid notes array');
        } else {
          validation.stats.notesCount = data.notes.length;
        }

        if (data.embeddings && Array.isArray(data.embeddings)) {
          validation.stats.embeddingsCount = data.embeddings.length;
        }

        if (data.tags && Array.isArray(data.tags)) {
          validation.stats.tagsCount = data.tags.length;
        }

        validation.stats.version = data.version || data.exportMetadata?.version || 'unknown';
        validation.stats.exportedAt = data.exportedAt || data.exportMetadata?.exportedAt;

        resolve(validation);

      } catch (error) {
        resolve({
          isValid: false,
          errors: ['Invalid JSON format: ' + error.message],
          stats: null
        });
      }
    };

    reader.onerror = () => {
      resolve({
        isValid: false,
        errors: ['Failed to read file'],
        stats: null
      });
    };

    reader.readAsText(file);
  });
}

/**
 * Create automatic backup to chrome.storage.local
 */
export async function createAutoBackup(database) {
  const data = await exportDatabase(database);

  // Only store essential data (skip large embeddings for auto-backup)
  const lightBackup = {
    version: data.version,
    exportedAt: Date.now(),
    notes: data.notes,
    tags: data.tags
  };

  const json = JSON.stringify(lightBackup);

  // Check size (chrome.storage.local has ~5MB limit)
  if (json.length > 4 * 1024 * 1024) {
    console.warn('[BackupManager] Backup too large for auto-backup');
    return null;
  }

  await chrome.storage.local.set({
    autoBackup: lightBackup,
    autoBackupDate: Date.now()
  });

  return lightBackup;
}

/**
 * Restore from auto-backup
 */
export async function restoreAutoBackup(database) {
  const { autoBackup, autoBackupDate } = await chrome.storage.local.get([
    'autoBackup',
    'autoBackupDate'
  ]);

  if (!autoBackup) {
    throw new Error('No auto-backup found');
  }

  await database.importAll(autoBackup, { clearExisting: true });

  return {
    restoredAt: Date.now(),
    backupDate: autoBackupDate,
    notesCount: autoBackup.notes?.length || 0,
    tagsCount: autoBackup.tags?.length || 0
  };
}
