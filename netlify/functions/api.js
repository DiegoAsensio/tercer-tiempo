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
    
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Firebase:', error);
    throw error;
  }
}

const db = admin.database();

exports.handler = async (event, context) => {
  // Headers CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
    'Content-Type': 'application/json'
  };

  // Manejar preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/api', '');
  console.log('📡 Request:', event.httpMethod, path);

  try {
    // GET /data - Obtener todos los datos
    if (event.httpMethod === 'GET' && path === '/data') {
      console.log('📖 Leyendo datos de Firebase...');
      const snapshot = await db.ref('futbol').once('value');
      const data = snapshot.val();
      
      if (!data) {
        console.log('⚠️ No hay datos en Firebase, devolviendo estructura vacía');
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

    // POST /data - Guardar/actualizar datos completos
    if (event.httpMethod === 'POST' && path === '/data') {
      console.log('💾 Guardando datos en Firebase...');
      
      if (!event.body) {
        throw new Error('No se recibió body en la petición');
      }
      
      const data = JSON.parse(event.body);
      
      console.log('📝 Datos a guardar:', {
        players: data.players?.length || 0,
        matches: data.matches?.length || 0
      });
      
      // Validar estructura básica
      if (!data.players || !Array.isArray(data.players)) {
        throw new Error('Estructura de datos inválida: players debe ser un array');
      }
      if (!data.matches || !Array.isArray(data.matches)) {
        throw new Error('Estructura de datos inválida: matches debe ser un array');
      }
      
      // Guardar en Firebase
      await db.ref('futbol').set(data);
      
      console.log('✅ Datos guardados exitosamente en Firebase');
      
      // Verificar que se guardó correctamente
      const verification = await db.ref('futbol').once('value');
      const savedData = verification.val();
      
      console.log('🔍 Verificación post-guardado:', {
        players: savedData.players?.length || 0,
        matches: savedData.matches?.length || 0
      });
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          saved: {
            players: savedData.players?.length || 0,
            matches: savedData.matches?.length || 0
          }
        })
      };
    }

    // Ruta no encontrada
    console.log('❌ Ruta no encontrada:', path);
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ 
        error: 'Not found', 
        path: path,
        method: event.httpMethod
      })
    };

  } catch (error) {
    console.error('❌ Error en la función:', error);
    console.error('Stack trace:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        env_check: {
          hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
          hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
          hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
          databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
        }
      })
    };
  }
};