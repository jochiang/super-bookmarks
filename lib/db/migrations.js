/**
 * Database migrations for Super Bookmarks
 * Handle schema upgrades between versions
 */

export const migrations = {
  // Migration from version 0 to 1 (initial schema)
  1: (db, transaction) => {
    // This is the initial schema, created in database.js onupgradeneeded
    // Future migrations can be added here
    console.log('Database initialized to version 1');
  }

  // Example future migration:
  // 2: (db, transaction) => {
  //   // Add new index or store
  //   const notesStore = transaction.objectStore('notes');
  //   notesStore.createIndex('byTitle', 'title', { unique: false });
  // }
};

/**
 * Run migrations between versions
 */
export function runMigrations(db, oldVersion, newVersion, transaction) {
  console.log(`Migrating database from v${oldVersion} to v${newVersion}`);

  for (let version = oldVersion + 1; version <= newVersion; version++) {
    if (migrations[version]) {
      console.log(`Running migration for version ${version}`);
      migrations[version](db, transaction);
    }
  }
}
