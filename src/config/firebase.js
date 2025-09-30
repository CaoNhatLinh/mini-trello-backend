const admin = require('firebase-admin');
require('dotenv').config();

let app;

try {
  app = admin.app();
  console.log('Firebase Admin already initialized');
} catch (error) {
  try {
    let serviceAccount;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    } else {
      serviceAccount = require('../../serviceAccountKey.json');
    }

    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: process.env.DATABASE_URL || "https://mini-trello-cd567-default-rtdb.asia-southeast1.firebasedatabase.app"
    });

    console.log('Firebase Admin SDK initialized successfully');
  } catch (initError) {
    console.warn('Firebase Admin SDK initialization failed:', initError.message);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Running in development mode without Firebase...');
    }
  }
}

const auth = admin.auth();
const firestore = admin.firestore();
const database = admin.database();

const db = firestore;

module.exports = {
  admin,
  auth,
  firestore,
  database,
  db,
  app
};