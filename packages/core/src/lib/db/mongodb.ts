import mongoose from 'mongoose';

let cachedDb: typeof mongoose | null = null;
const uri: string = process.env.MONGO_URI as string;
export async function connectMongoDb() {
  if (cachedDb) {
    return Promise.resolve(cachedDb);
  }

  return mongoose
    .connect(uri, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
      bufferCommands: false,
      maxPoolSize: 10,
    })
    .then(db => {
      cachedDb = db;
      console.log('New MongoDB Connection made');
      return cachedDb;
    });
}
