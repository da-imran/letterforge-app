const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Load env from this package's directory (not cwd-relative)
const envPath = path.join(__dirname, '..', '.env');
const env = fs.readFileSync(envPath, 'utf8');
const mongoUri = env.match(/MONGO_URI=([^\n]+)/)[1].replace(/['"]/g, '').trim();
const dbName = env.match(/MONGODB_DBNAME=([^\n]+)/)[1].replace(/['"]/g, '').trim();

(async () => {
  try {
    const client = await MongoClient.connect(mongoUri + dbName);
    const db = client.db(dbName);
    const collection = db.collection('milestones');

    // Clear existing milestones
    const deleteResult = await collection.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} existing milestones`);

    // Load new milestone data
    const { MILESTONES_DATA } = require('./milestone_data.js');
    console.log(`Loading ${MILESTONES_DATA.length} milestones from file...`);

    // Insert new milestones
    const insertResult = await collection.insertMany(MILESTONES_DATA);
    console.log(`Inserted ${insertResult.insertedCount} new milestones`);

    await client.close();
    console.log('Milestones updated successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
