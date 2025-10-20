// netlify/functions/api.js
const admin = require('firebase-admin');

// Inicializar Firebase Admin (solo una vez)
if (!admin.apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey
      }),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
    });
    
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    throw error;
  }
}

const db = admin.database();

exports.handler = async (event, context) => {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE'
  };

  // Manejar preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  console.log('Request:', event.httpMethod, event.path);

  try {
    const path = event.path.replace('/.netlify/functions/api', '');

    // GET /data - Obtener todos los datos
    if (event.httpMethod === 'GET' && path === '/data') {
      console.log('Fetching data from Firebase...');
      const snapshot = await db.ref('futbol').once('value');
      const data = snapshot.val() || { players: [], matches: [] };
      console.log('Data fetched successfully');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
    }

    // POST /data - Guardar/actualizar datos completos
    if (event.httpMethod === 'POST' && path === '/data') {
      console.log('Saving data to Firebase...');
      const data = JSON.parse(event.body);
      await db.ref('futbol').set(data);
      console.log('Data saved successfully');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // POST /match - Guardar un partido nuevo
    if (event.httpMethod === 'POST' && path === '/match') {
      console.log('Saving match to Firebase...');
      const match = JSON.parse(event.body);
      const snapshot = await db.ref('futbol/matches').once('value');
      const matches = snapshot.val() || [];
      matches.push(match);
      await db.ref('futbol/matches').set(matches);
      console.log('Match saved successfully');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // DELETE /match/:id - Eliminar un partido
    if (event.httpMethod === 'DELETE' && path.startsWith('/match/')) {
      console.log('Deleting match from Firebase...');
      const matchId = path.split('/')[2];
      const snapshot = await db.ref('futbol/matches').once('value');
      const matches = snapshot.val() || [];
      const filtered = matches.filter(m => m.id !== matchId);
      await db.ref('futbol/matches').set(filtered);
      console.log('Match deleted successfully');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    console.log('Path not found:', path);
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found', path: path })
    };

  } catch (error) {
    console.error('Error in function:', error);
    console.error('Error stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        env_check: {
          hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
          hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
          hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY
        }
      })
    };
  }
};