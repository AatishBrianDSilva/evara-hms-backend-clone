import mongoose from "mongoose";

let cachedDb: typeof mongoose | null = null;
const uri: string =
  "mongodb+srv://admin:EZCpxVfJ1KgfnWcU@evara-hms-dev.hw9cyf9.mongodb.net/?retryWrites=true&w=majority";
export async function connectMongoDb() {
  if (cachedDb) {
    return Promise.resolve(cachedDb);
  }

  return mongoose.connect(uri, { connectTimeoutMS: 5000 }).then((db) => {
    cachedDb = db;
    console.log("New MongoDB Connection made");
    return cachedDb;
  });
}
