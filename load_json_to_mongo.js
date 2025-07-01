const mongoose = require('mongoose');
const fs = require('fs');

// ✅ Use env variable instead of hard-coded URI
const uri = process.env.MONGODB_URI;

async function main() {
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Example: Load JSON data from a file
    const data = JSON.parse(fs.readFileSync('data.json', 'utf-8'));

    // Example: Define a schema and model
    const ExampleSchema = new mongoose.Schema({}, { strict: false });
    const ExampleModel = mongoose.model('Example', ExampleSchema);

    // Insert data
    await ExampleModel.insertMany(data);
    console.log('✅ Data inserted successfully');

    mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

main();

