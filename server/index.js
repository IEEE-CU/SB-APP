require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ieee_finance_pro';

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Successfully connected to MongoDB Atlas / Local Database.');
    
    // Start listening
    app.listen(PORT, () => {
      console.log(`IEEE Finance Pro Server is running on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error('Database connection failed! Server shutting down.', error);
    process.exit(1);
  });
