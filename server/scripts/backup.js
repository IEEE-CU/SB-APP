require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Ensure backups directory exists
const BACKUP_DIR = path.join(__dirname, '../../backups');
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const performBackup = async () => {
  try {
    console.log('📦 Starting MongoDB Backup process...');
    
    // Connect to database
    await connectDB();
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    const backupData = {
      timestamp: new Date().toISOString(),
      database: db.databaseName,
      collections: {}
    };

    for (const collectionInfo of collections) {
      const colName = collectionInfo.name;
      
      // Skip system collections or index specs if any
      if (colName.startsWith('system.')) continue;
      
      console.log(`- Fetching documents from: ${colName}...`);
      const documents = await db.collection(colName).find({}).toArray();
      backupData.collections[colName] = documents;
      console.log(`  ✓ Read ${documents.length} documents.`);
    }

    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `backup-${db.databaseName}-${timestampStr}.json`;
    const backupFilePath = path.join(BACKUP_DIR, backupFilename);

    fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf8');
    
    console.log(`\n✅ Backup completed successfully!`);
    console.log(`📂 Saved to: ${backupFilePath}`);
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Backup process failed:', error);
    process.exit(1);
  }
};

performBackup();
