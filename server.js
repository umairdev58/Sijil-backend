const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const salesRoutes = require('./routes/sales');
const customerRoutes = require('./routes/customers');
const supplierRoutes = require('./routes/suppliers');
const purchaseRoutes = require('./routes/purchases');
const dailyLedgerRoutes = require('./routes/dailyLedger');
const freightRoutes = require('./routes/freight');
const transportRoutes = require('./routes/transport');
const dubaiTransportRoutes = require('./routes/dubaiTransport');
const dubaiClearanceRoutes = require('./routes/dubaiClearance');
const { initializeAdmin } = require('./utils/adminInitializer');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Higher limit for development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection with better error handling
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sijil';
    
    console.log('Attempting to connect to MongoDB...');
    console.log('Connection string:', mongoURI.replace(/\/\/.*@/, '//***:***@')); // Hide credentials
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000, // Increased timeout for Atlas
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    });
    
    console.log('✅ Connected to MongoDB successfully');
    
    // Initialize admin user after database connection
    await initializeAdmin();
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.error('💡 Tip: Make sure MongoDB is running locally or check your Atlas connection string');
    } else if (error.code === 'EREFUSED') {
      console.error('💡 Tip: MongoDB service might not be running. Start MongoDB locally or check your connection string');
    } else if (error.message.includes('Authentication failed')) {
      console.error('💡 Tip: Check your MongoDB username and password');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('💡 Tip: Check your network connection and MongoDB Atlas IP whitelist');
    }
    
    console.error('💡 For local development, make sure MongoDB is installed and running');
    console.error('💡 For MongoDB Atlas, check your connection string and network access');
    
    // Don't exit process, let it continue for development
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

// Connect to database
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/daily-ledger', dailyLedgerRoutes);
app.use('/api/freight-invoices', freightRoutes);
app.use('/api/transport-invoices', transportRoutes);
app.use('/api/dubai-transport-invoices', dubaiTransportRoutes);
app.use('/api/dubai-clearance-invoices', dubaiClearanceRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Accounting System API is running',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
}); 