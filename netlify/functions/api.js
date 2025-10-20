// netlify/functions/api.js
const admin = require('firebase-admin');

// Inicializar Firebase Admin (solo una vez)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    }),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
  });
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

  try {
    const path = event.path.replace('/.netlify/functions/api', '');

    // GET /data - Obtener todos los datos
    if (event.httpMethod === 'GET' && path === '/data') {
      const snapshot = await db.ref('futbol').once('value');
      const data = snapshot.val() || { players: [], matches: [] };
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
    }

    // POST /data - Guardar/actualizar datos completos
    if (event.httpMethod === 'POST' && path === '/data') {
      const data = JSON.parse(event.body);
      await db.ref('futbol').set(data);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // POST /match - Guardar un partido nuevo
    if (event.httpMethod === 'POST' && path === '/match') {
      const match = JSON.parse(event.body);
      const snapshot = await db.ref('futbol/matches').once('value');
      const matches = snapshot.val() || [];
      matches.push(match);
      await db.ref('futbol/matches').set(matches);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    // DELETE /match/:id - Eliminar un partido
    if (event.httpMethod === 'DELETE' && path.startsWith('/match/')) {
      const matchId = path.split('/')[2];
      const snapshot = await db.ref('futbol/matches').once('value');
      const matches = snapshot.val() || [];
      const filtered = matches.filter(m => m.id !== matchId);
      await db.ref('futbol/matches').set(filtered);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true })
      };
    }

    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Not found' })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};