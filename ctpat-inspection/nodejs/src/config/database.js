/**
 * SQLite Database Configuration
 * Embedded local database for inspection data persistence
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

/**
 * Initialize SQLite database with schema
 */
function initializeDatabase() {
  try {
    // Create/open database file in app documents directory
    const dbPath = path.join(__dirname, '../../ctpat-app.db');
    console.log('🗄️  Database path:', dbPath);

    db = new Database(dbPath);
    
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    
    // Enable write-ahead logging for better concurrency
    db.pragma('journal_mode = WAL');

    // Create tables if they don't exist
    createTables();
    
    return db;
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Create database tables
 */
function createTables() {
  try {
    db.exec(`
      -- Inspections table
      CREATE TABLE IF NOT EXISTS inspections (
        inspectionId TEXT PRIMARY KEY,
        userId TEXT DEFAULT 'local-user',
        truckNumber TEXT NOT NULL,
        trailerNumber TEXT,
        sealNumber TEXT,
        facilityName TEXT,
        verifiedByName TEXT,
        printName TEXT,
        date TEXT,
        time TEXT,
        securityCheckboxChecked INTEGER DEFAULT 0,
        agriculturalPestCheckboxChecked INTEGER DEFAULT 0,
        recipientEmail TEXT,
        inspectionPoints TEXT NOT NULL,
        status TEXT DEFAULT 'draft',
        pdfStoragePath TEXT,
        pdfPublicUrl TEXT,
        completionPercentage INTEGER DEFAULT 0,
        idempotencyKey TEXT,
        notes TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        submittedAt TEXT,
        UNIQUE(idempotencyKey)
      );

      -- Email queue table (for offline email sending)
      CREATE TABLE IF NOT EXISTS email_queue (
        emailId TEXT PRIMARY KEY,
        inspectionId TEXT,
        recipientEmail TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        sentAt TEXT,
        retryCount INTEGER DEFAULT 0,
        error TEXT,
        FOREIGN KEY(inspectionId) REFERENCES inspections(inspectionId)
      );

      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_inspections_userId ON inspections(userId);
      CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status);
      CREATE INDEX IF NOT EXISTS idx_inspections_date ON inspections(date);
      CREATE INDEX IF NOT EXISTS idx_inspections_createdAt ON inspections(createdAt);
      CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
      CREATE INDEX IF NOT EXISTS idx_email_queue_inspectionId ON email_queue(inspectionId);
    `);

    console.log('✓ Database tables created/verified');
  } catch (error) {
    console.error('❌ Failed to create tables:', error);
    throw error;
  }
}

/**
 * Get database instance
 */
function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('✓ Database connection closed');
  }
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
};
