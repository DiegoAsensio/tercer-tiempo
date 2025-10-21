// netlify/functions/api.js
const admin = require('firebase-admin');

let firebaseInitialized = false;

function initFirebase() {
  if (firebaseInitialized) return;
  
  try {
    if (admin.apps.length > 0) {
      firebaseInitialized = true;
      console.log('✅ Firebase ya estaba inicializado');
      return;
    }
    
    // Verificar variables de entorno
    if (!process.env.FIREBASE_PROJECT_ID) {
      throw new Error('FIREBASE_PROJECT_ID no configurado');
    }
    if (!process.env.FIREBASE_CLIENT_EMAIL) {
      throw new Error('FIREBASE_CLIENT_EMAIL no configurado');
    }
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error('FIREBASE_PRIVATE_KEY no configurado');
    }
    
    console.log('🔧 Inicializando Firebase...');
    console.log('Project ID:', process.env.FIREBASE_PROJECT_ID);
    console.log('Client Email:', process.env.FIREBASE_CLIENT_EMAIL);
    
    // Reemplazar \n literales por saltos de línea reales
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
    
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL || `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
    });
    
    firebaseInitialized = true;
    console.log('✅ Firebase inicializado correctamente');
  } catch (error) {
    console.error('❌ Error inicializando Firebase:', error.message);
    throw error;
  }
}

exports.handler = async (event, context) => {
  // Evitar que la función espere el event loop
  context.callbackWaitsForEmptyEventLoop = false;
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Manejar preflight CORS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/api', '');
  console.log('📡', event.httpMethod, path);

  try {
    // Inicializar Firebase
    initFirebase();
    const db = admin.database();
    
    // GET /data - Leer todos los datos
    if (event.httpMethod === 'GET' && path === '/data') {
      console.log('📖 Leyendo datos de Firebase...');
      
      const snapshot = await db.ref('futbol').once('value');
      const data = snapshot.val();
      
      if (!data) {
        console.log('⚠️ Firebase vacío, devolviendo estructura inicial');
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ players: [], matches: [] })
        };
      }
      
      console.log('✅ Datos leídos:', {
        players: data.players?.length || 0,
        matches: data.matches?.length || 0
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
    }

    // POST /data - Guardar datos completos
    if (event.httpMethod === 'POST' && path === '/data') {
      console.log('💾 Guardando datos en Firebase...');
      
      if (!event.body) {
        throw new Error('Body vacío');
      }
      
      const data = JSON.parse(event.body);
      
      // Validar estructura
      if (!data.players || !Array.isArray(data.players)) {
        throw new Error('players debe ser un array');
      }
      if (!data.matches || !Array.isArray(data.matches)) {
        throw new Error('matches debe ser un array');
      }
      
      console.log('📝 Guardando:', {
        players: data.players.length,
        matches: data.matches.length
      });
      
      // Guardar en Firebase
      await db.ref('futbol').set(data);
      
      console.log('✅ Guardado exitoso');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          saved: {
            players: data.players.length,
            matches: data.matches.length
          }
        })
      };
    }

    // Ruta no encontrada
    console.log('❌ Ruta no encontrada');
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Ruta no encontrada', path })
    };

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack,
        env: {
          hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
          hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
          hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
          hasDatabaseURL: !!process.env.FIREBASE_DATABASE_URL
        }
      })
    };
  }
};