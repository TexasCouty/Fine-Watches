const { MongoClient } = require('mongodb');

async function main() {
  const uri = 'mongodb+srv://texascouty21:lkjbPrV8Mr1iRrev@patek-cluster.rchgesl.mongodb.net/?retryWrites=true&w=majority&appName=patek-cluster';

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db('watchlookup'); // <-- your DB name!
    const collection = db.collection('watch_refs'); // <-- your collection name!

    const result = await collection.findOne({ reference: '5402ST' });
    console.log('Result:', result);
  } finally {
    await client.close();
  }
}

main();

