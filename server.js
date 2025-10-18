const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const shopifyService = require('./services/shopifyService');
const googleSheetsService = require('./services/googleSheetsService');
const orderSyncService = require('./services/orderSyncService');
const sheetsWatcherService = require('./services/sheetsWatcherService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Middleware spécifique pour les webhooks Shopify (raw body)
app.use('/api/webhook', express.raw({type: 'application/json'}));

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Shopify Google Sheets Sync API',
    version: '1.0.0',
    features: [
      'Synchronisation automatique des commandes Shopify vers Google Sheets',
      'Surveillance en temps réel de Google Sheets pour nouveaux noms',
      'Remplissage automatique des informations Shopify par nom de client',
      'Gestion chronologique des commandes multiples par client',
      'Mapping intelligent des articles selon notation spécifique',
      'Validation de la structure du tableau Google Sheets'
    ],
    endpoints: {
      testConnection: 'GET /api/test-connection',
      getOrders: 'GET /api/orders?limit=10&status=any',
      syncOrders: 'POST /api/sync-orders',
      startWatching: 'POST /api/start-watching',
      stopWatching: 'POST /api/stop-watching',
      watchingStatus: 'GET /api/watching-status',
      analyzeCustomer: 'GET /api/analyze-customer/:customerName',
      webhookOrderCreated: 'POST /api/webhook/order-created'
    },
    examples: {
      syncRecentOrders: {
        method: 'POST',
        url: '/api/sync-orders',
        body: { "limit": 10 }
      },
      syncSpecificOrders: {
        method: 'POST',
        url: '/api/sync-orders',
        body: { "orderIds": ["#TCO10842", "#TCO10867"] }
      },
      analyzeCustomer: {
        method: 'GET',
        url: '/api/analyze-customer/Franck%20Cathus'
      },
      webhookOrderCreated: {
        method: 'POST',
        url: '/api/webhook/order-created',
        description: 'Webhook Shopify pour nouvelles commandes'
      },
      webhookOrderFulfilled: {
        method: 'POST',
        url: '/api/webhook/order-fulfilled',
        description: 'Webhook Shopify pour commandes expédiées (recommandé)'
      }
    }
  });
});

// Test connection endpoint
app.get('/api/test-connection', async (req, res) => {
  try {
    const shopifyTest = await shopifyService.testConnection();
    const sheetsTest = await googleSheetsService.testConnection();
    
    res.json({
      success: true,
      shopify: shopifyTest,
      googleSheets: sheetsTest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get orders from Shopify
app.get('/api/orders', async (req, res) => {
  try {
    const { limit = 10, status = 'any' } = req.query;
    const orders = await shopifyService.getOrders(limit, status);
    res.json({
      success: true,
      data: orders
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Analyze customer orders
app.get('/api/analyze-customer/:customerName', async (req, res) => {
  try {
    const { customerName } = req.params;
    const analysis = await googleSheetsService.analyzeCustomerOrders(decodeURIComponent(customerName));
    
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start watching Google Sheets for new names
app.post('/api/start-watching', async (req, res) => {
  try {
    await sheetsWatcherService.startWatching();
    
    res.json({
      success: true,
      message: 'Surveillance Google Sheets démarrée',
      data: sheetsWatcherService.getStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stop watching Google Sheets
app.post('/api/stop-watching', async (req, res) => {
  try {
    await sheetsWatcherService.stopWatching();
    
    res.json({
      success: true,
      message: 'Surveillance Google Sheets arrêtée',
      data: sheetsWatcherService.getStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get watching status
app.get('/api/watching-status', async (req, res) => {
  try {
    res.json({
      success: true,
      data: sheetsWatcherService.getStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Webhook pour les nouvelles commandes Shopify
app.post('/api/webhook/order-created', async (req, res) => {
  try {
    console.log('🔄 Webhook reçu: nouvelle commande créée');
    
    // Parser le JSON du webhook
    const order = JSON.parse(req.body);
    
    console.log(`📦 Commande reçue: ${order.name || order.id}`);
    
    // Synchroniser automatiquement la commande
    const syncResult = await orderSyncService.syncOrdersToSheets([order]);
    
    if (syncResult.successCount > 0) {
      console.log(`✅ Commande ${order.name || order.id} synchronisée automatiquement`);
      res.status(200).send('OK');
    } else {
      console.error(`❌ Échec de la synchronisation pour la commande ${order.name || order.id}`);
      res.status(500).send('Sync failed');
    }
  } catch (error) {
    console.error('❌ Erreur webhook:', error.message);
    res.status(500).send('Error');
  }
});

// Webhook pour les commandes expédiées (fulfillment)
app.post('/api/webhook/order-fulfilled', async (req, res) => {
  try {
    console.log('🚚 Webhook reçu: commande expédiée');
    
    const fulfillment = JSON.parse(req.body);
    console.log(`📦 Commande expédiée: ${fulfillment.order_id}`);
    
    // Récupérer la commande complète depuis Shopify
    const order = await shopifyService.getOrder(fulfillment.order_id);
    
    if (order) {
      // Synchroniser la commande avec toutes les informations
      const syncResult = await orderSyncService.syncOrdersToSheets([order]);
      
      if (syncResult.successCount > 0) {
        console.log(`✅ Commande ${order.name || order.id} synchronisée automatiquement après expédition`);
        res.status(200).send('OK');
      } else {
        console.error(`❌ Échec de la synchronisation pour la commande ${order.name || order.id}`);
        res.status(500).send('Sync failed');
      }
    } else {
      console.error(`❌ Commande ${fulfillment.order_id} non trouvée`);
      res.status(404).send('Order not found');
    }
  } catch (error) {
    console.error('❌ Erreur webhook fulfillment:', error.message);
    res.status(500).send('Error');
  }
});

// Webhook pour les mises à jour de commandes
app.post('/api/webhook/order-updated', async (req, res) => {
  try {
    console.log('🔄 Webhook reçu: commande mise à jour');
    
    const order = JSON.parse(req.body);
    console.log(`📦 Commande mise à jour: ${order.name || order.id}`);
    
    // Synchroniser la commande mise à jour
    const syncResult = await orderSyncService.syncOrdersToSheets([order]);
    
    if (syncResult.successCount > 0) {
      console.log(`✅ Commande ${order.name || order.id} mise à jour automatiquement`);
      res.status(200).send('OK');
    } else {
      console.error(`❌ Échec de la mise à jour pour la commande ${order.name || order.id}`);
      res.status(500).send('Update failed');
    }
  } catch (error) {
    console.error('❌ Erreur webhook update:', error.message);
    res.status(500).send('Error');
  }
});

// Sync orders to Google Sheets
app.post('/api/sync-orders', async (req, res) => {
  try {
    const { orderIds, limit = 10, status = 'any' } = req.body;
    
    let orders;
    if (orderIds && orderIds.length > 0) {
      // Sync specific orders
      orders = await shopifyService.getOrdersByIds(orderIds);
    } else {
      // Sync recent orders with optional status filter
      orders = await shopifyService.getOrders(limit, status);
    }
    
    const syncResults = await orderSyncService.syncOrdersToSheets(orders);
    
    res.json({
      success: true,
      message: `Synchronisé ${syncResults.successCount} commandes avec succès`,
      data: {
        total: syncResults.total,
        success: syncResults.successCount,
        failed: syncResults.failedCount,
        details: syncResults.details
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  res.status(500).json({
    success: false,
    error: 'Erreur interne du serveur'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint non trouvé'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📊 Application Shopify-Google Sheets Sync`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log('');
  console.log('📋 Endpoints disponibles:');
  console.log(`  GET  /                    - Documentation API`);
  console.log(`  GET  /api/health          - Vérification santé`);
  console.log(`  POST /api/sync-orders     - Synchroniser commandes`);
  console.log(`  POST /api/start-watching  - Démarrer surveillance Google Sheets`);
  console.log(`  POST /api/stop-watching   - Arrêter surveillance Google Sheets`);
  console.log(`  GET  /api/watching-status - Statut surveillance`);
  console.log(`  POST /api/webhook/order-created   - Webhook nouvelle commande`);
  console.log(`  POST /api/webhook/order-updated   - Webhook commande mise à jour`);
  console.log(`  POST /api/webhook/order-fulfilled - Webhook commande expédiée`);
  console.log(`  GET  /api/analyze-customer/:name  - Analyser commandes client`);
  console.log('');
  
  // Démarrer automatiquement la surveillance Google Sheets
  console.log('🔍 Démarrage automatique de la surveillance Google Sheets...');
  sheetsWatcherService.startWatching().catch(error => {
    console.error('❌ Erreur lors du démarrage de la surveillance:', error.message);
  });
});
