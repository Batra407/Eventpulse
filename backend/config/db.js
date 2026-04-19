const mongoose = require('mongoose');

/**
 * MongoDB connection with retry-safe configuration.
 * Uses the MONGO_URI env variable. Falls back gracefully
 * so static file serving still works even without DB.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // Modern Mongoose (>=6) no longer needs useNewUrlParser / useUnifiedTopology
      serverSelectionTimeoutMS: 5000, // Fail fast if unreachable
      socketTimeoutMS: 45000,
    });
    console.log(`✅  MongoDB Connected → ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌  MongoDB Connection Error: ${err.message}`);
    console.warn('⚠️   Server will continue — set MONGO_URI in .env to enable DB features');
  }
};

module.exports = connectDB;
