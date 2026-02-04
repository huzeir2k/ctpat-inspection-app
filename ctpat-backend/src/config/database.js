const mongoose = require('mongoose');

/**
 * Connect to MongoDB using Mongoose
 * @returns {Promise<void>}
 */
const connectDB = async () => {
  try {
    const conn = await Promise.race([
      mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000, // 5 second timeout
        connectTimeoutMS: 5000,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('MongoDB connection timeout')), 6000)
      ),
    ]);

    console.log(`✓ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`✗ MongoDB Connection Error: ${error.message}`);
    
    // In development, allow the app to continue without DB connection
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  Running in development mode without MongoDB. Data will not persist.');
      return null;
    } else {
      // In production, exit if DB connection fails
      process.exit(1);
    }
  }
};

/**
 * Disconnect from MongoDB
 * @returns {Promise<void>}
 */
const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('✓ MongoDB Disconnected');
  } catch (error) {
    console.error(`✗ MongoDB Disconnection Error: ${error.message}`);
    throw error;
  }
};

module.exports = {
  connectDB,
  disconnectDB,
};
