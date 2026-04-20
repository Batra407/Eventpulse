const mongoose = require('mongoose');

// Cache the connection to avoid recreating it across hot-reloads or function invocations
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * Serverless-optimized MongoDB connection
 * Uses the MONGO_URI env variable.
 */
const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      serverSelectionTimeoutMS: 5000, // Fail fast if unreachable
      socketTimeoutMS: 45000,
      bufferCommands: false, // Do not hang queries if connection drops
    };

    // Disable Mongoose global model buffering to prevent infinite hanging in serverless
    mongoose.set('bufferCommands', false);

    console.log('⏳  Connecting to MongoDB...');
    cached.promise = mongoose.connect(process.env.MONGO_URI, opts).then((mongoose) => {
      console.log(`✅  MongoDB Connected → ${mongoose.connection.host}`);
      return mongoose;
    });
  }
  
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null; // Clear promise so we can retry later
    console.error(`❌  MongoDB Connection Error: ${err.message}`);
    throw err;
  }

  return cached.conn;
};

module.exports = connectDB;
