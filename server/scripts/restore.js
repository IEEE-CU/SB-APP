require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

const performRestore = async () => {
  try {
    const backupDir = path.join(__dirname, '../../backups');
    
    // Find the latest backup if no file is specified
    let targetFile = process.argv[2];
    if (targetFile === 'seed' || targetFile === 'test' || (targetFile && !targetFile.endsWith('.json'))) {
      targetFile = undefined;
    }
    
    if (!targetFile) {
      if (!fs.existsSync(backupDir)) {
        console.error('❌ Backups directory does not exist. Run backup first.');
        process.exit(1);
      }
      
      const files = fs.readdirSync(backupDir)
        .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
        .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

      if (files.length === 0) {
        console.error('❌ No backup files found.');
        process.exit(1);
      }
      
      targetFile = path.join(backupDir, files[0].name);
    } else {
      if (!path.isAbsolute(targetFile)) {
        targetFile = path.resolve(process.cwd(), targetFile);
      }
    }

    if (!fs.existsSync(targetFile)) {
      console.error(`❌ Backup file not found: ${targetFile}`);
      process.exit(1);
    }

    console.log(`📦 Loading backup file: ${targetFile}`);
    const backupData = JSON.parse(fs.readFileSync(targetFile, 'utf8'));
    
    console.log(`- Backup Timestamp: ${backupData.timestamp}`);
    console.log(`- Source Database: ${backupData.database}`);
    
    await connectDB();
    const db = mongoose.connection.db;
    
    for (const [colName, documents] of Object.entries(backupData.collections)) {
      console.log(`- Restoring collection: ${colName} (${documents.length} documents)...`);
      
      // Clean collection first
      await db.collection(colName).deleteMany({});
      
      if (documents.length > 0) {
        // Parse date strings back to Date objects and ObjectId strings to ObjectIds
        const parsedDocs = documents.map(doc => {
          const parsed = { ...doc };
          for (const [key, val] of Object.entries(parsed)) {
            // Convert standard ISO date strings back to Date objects
            if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
              parsed[key] = new Date(val);
            }
            // If the field is _id or ends in Id / ID / ObjectIds, convert to ObjectId if it matches the format
            if (key === '_id' && typeof val === 'string') {
              parsed[key] = new mongoose.Types.ObjectId(val);
            } else if (key.endsWith('Id') && typeof val === 'string' && mongoose.Types.ObjectId.isValid(val)) {
              parsed[key] = new mongoose.Types.ObjectId(val);
            } else if (Array.isArray(val)) {
              parsed[key] = val.map(item => {
                if (typeof item === 'string' && mongoose.Types.ObjectId.isValid(item)) {
                  return new mongoose.Types.ObjectId(item);
                }
                return item;
              });
            }
          }
          return parsed;
        });

        await db.collection(colName).insertMany(parsedDocs);
      }
      console.log(`  ✓ Restored ${documents.length} documents.`);
    }

    console.log('\n✅ Database restore completed successfully!');
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Restore process failed:', error);
    process.exit(1);
  }
};

performRestore();
