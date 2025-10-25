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
    version: '2.0.0',
    mode: '📝 Manual Entry - Auto Fill',
    howItWorks: [
      '1. Users add NAMES manually to Google Sheets (column D)',
      '2. App monitors Google Sheets every 30 seconds',
      '3. When new name detected, app searches Shopify for matching order',
      '4. Info auto-filled: order number, tracking, items',
      '5. EXACT MATCH only (customer/shipping/billing name)'
    ],
    features: [
      '✅ Auto-monitoring of Google Sheets',
      '✅ Auto-fill Shopify information',
      '✅ Exact match only (no partial matches)',
      '✅ Priority: customer → shipping → billing name',
      '✅ Chronological order management',
      '✅ Detailed logs in Railway',
      '❌ Webhooks DISABLED (manual mode only)'
    ],
    endpoints: {
      testConnection: 'GET /api/test-connection',
      watchingStatus: 'GET /api/watching-status',
      testSearch: 'GET /api/test-search/:customerName',
      updateAllRows: 'POST /api/update-all-rows-with-orders',
      forceReprocess: 'POST /api/force-reprocess'
    },
    webhooks: '❌ DISABLED - Users add names manually'
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

// Force reprocess all rows
app.post('/api/force-reprocess', async (req, res) => {
  try {
    await sheetsWatcherService.stopWatching();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await sheetsWatcherService.startWatching();
    
    res.json({
      success: true,
      message: 'Retraitement forcé - toutes les lignes seront revérifiées',
      data: sheetsWatcherService.getStatus()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to see what's in the sheets
app.get('/api/debug-sheets', async (req, res) => {
  try {
    const data = await googleSheetsService.getSheetData();
    
    const debug = {
      totalRows: data.length,
      header: data[0] || [],
      rows: []
    };
    
    // Get first 10 data rows with correct column mapping
    for (let i = 1; i < Math.min(11, data.length); i++) {
      const row = data[i];
      debug.rows.push({
        rowNumber: i + 1,
        columnA: row[0] || '',
        columnB: row[1] || '',
        columnC: row[2] || '',
        columnD_Name: row[3] || '',
        columnE: row[4] || '',
        columnF: row[5] || '',
        columnG_OrderNumber: row[6] || '',
        columnH_Tracking: row[7] || '',
        columnI: row[8] || '',
        columnJ: row[9] || '',
        columnK: row[10] || '',
        columnL_Items: row[11] || '',
        hasName: !!(row[3] && row[3].trim()),
        hasOrderNumber: !!(row[6] && row[6].trim()),
        hasTracking: !!(row[7] && row[7].trim()),
        hasItems: !!(row[11] && row[11].trim()),
        shouldProcess: !!(row[3] && row[3].trim() && (!row[6] || !row[7] || !row[11]))
      });
    }
    
    res.json({
      success: true,
      data: debug
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint to search for a specific customer name
app.get('/api/test-search/:customerName', async (req, res) => {
  try {
    const customerName = decodeURIComponent(req.params.customerName);
    console.log(`🧪 Test de recherche pour: ${customerName}`);
    
    const orders = await shopifyService.searchOrdersByCustomerName(customerName);
    
    res.json({
      success: true,
      customerName,
      foundOrders: orders.length,
      orders: orders.map(order => ({
        name: order.name,
        shippingName: shopifyService.getShippingName(order),
        customerName: order.customer ? `${order.customer.first_name} ${order.customer.last_name}`.trim() : 'N/A',
        lineItems: order.line_items ? order.line_items.length : 0,
        created_at: order.created_at
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Debug endpoint to manually process a specific row
app.post('/api/debug-process-row/:rowNumber', async (req, res) => {
  try {
    const rowNumber = parseInt(req.params.rowNumber);
    console.log(`🧪 Debug: Traitement manuel de la ligne ${rowNumber}`);
    
    const data = await googleSheetsService.getSheetData();
    const rowIndex = rowNumber - 1;
    const row = data[rowIndex];
    
    if (!row) {
      return res.status(404).json({
        success: false,
        error: `Ligne ${rowNumber} non trouvée`
      });
    }
    
    const customerName = row[3];
    if (!customerName || customerName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: `Aucun nom dans la colonne D de la ligne ${rowNumber}`
      });
    }
    
    console.log(`🔍 Recherche pour: ${customerName}`);
    
    // Test de recherche
    const orders = await shopifyService.searchOrdersByCustomerName(customerName);
    console.log(`📊 Commandes trouvées: ${orders.length}`);
    
    if (orders.length === 0) {
      return res.json({
        success: true,
        message: `Aucune commande trouvée pour ${customerName}`,
        customerName,
        foundOrders: 0
      });
    }
    
    const order = orders[0];
    console.log(`✓ Commande trouvée: ${order.name}`);
    
    // Test de formatage
    const formattedOrder = shopifyService.formatOrderForSheets(order);
    console.log(`📝 Données formatées:`, formattedOrder);
    
    res.json({
      success: true,
      message: `Traitement réussi pour ${customerName}`,
      customerName,
      foundOrders: orders.length,
      selectedOrder: {
        name: order.name,
        customerName: order.customer ? `${order.customer.first_name} ${order.customer.last_name}`.trim() : 'N/A',
        created_at: order.created_at
      },
      formattedData: formattedOrder
    });
    
  } catch (error) {
    console.error('❌ Erreur debug:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test endpoint to simulate adding a new name and check automatic processing
app.get('/api/test-automatic-system', async (req, res) => {
  try {
    console.log('🧪 Test du système automatique');
    
    // Vérifier le statut du watcher
    const watcherStatus = sheetsWatcherService.getStatus();
    
    // Vérifier les données actuelles
    const data = await googleSheetsService.getSheetData();
    const rowsWithNames = [];
    
    for (let i = 1; i < Math.min(11, data.length); i++) {
      const row = data[i];
      if (row && row[3] && row[3].trim() !== '') {
        const hasOrderNumber = row[6] && row[6].trim() !== '';
        const hasTracking = row[7] && row[7].trim() !== '';
        const hasItems = row[11] && row[11].trim() !== '';
        
        rowsWithNames.push({
          rowNumber: i + 1,
          name: row[3],
          hasOrderNumber,
          hasTracking,
          hasItems,
          isComplete: hasOrderNumber && hasTracking && hasItems
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Système automatique opérationnel',
      watcherStatus,
      totalRows: data.length,
      rowsWithNames,
      instructions: {
        step1: 'Ajoutez un nom dans la colonne D d\'une ligne vide',
        step2: 'L\'application détectera automatiquement le nouveau nom',
        step3: 'Les colonnes G (commande), H (suivi), L (items) seront remplies automatiquement',
        step4: 'Le traitement se fait toutes les 30 secondes'
      }
    });
    
  } catch (error) {
    console.error('❌ Erreur test système:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update all rows using existing order numbers for better efficiency
app.post('/api/update-all-rows-with-orders', async (req, res) => {
  try {
    console.log('🔄 Mise à jour de toutes les lignes avec numéros de commande existants');
    
    const data = await googleSheetsService.getSheetData();
    const results = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 1;
      
      // Vérifier si la ligne a un nom et un numéro de commande
      if (row && row[3] && row[3].trim() !== '' && row[6] && row[6].trim() !== '') {
        const customerName = row[3];
        const orderNumber = row[6];
        
        console.log(`🔍 Traitement ligne ${rowNumber}: ${customerName} - ${orderNumber}`);
        
        try {
          let order = null;
          let correctOrderNumber = orderNumber;
          
          // D'abord, essayer avec le numéro de commande existant
          try {
            order = await shopifyService.getOrder(orderNumber);
            
            if (order) {
              // Vérifier la correspondance exacte avec tous les types de noms
              const matchResult = shopifyService.isExactNameMatch(customerName, order);
              
              // Si pas de correspondance exacte, chercher par nom
              if (!matchResult.isMatch) {
                const orderNames = matchResult.orderNames;
                console.log(`⚠️ ❌ AUCUN MATCH EXACT pour "${customerName}" avec ${orderNumber}`);
                console.log(`   Customer: ${orderNames.customer || 'N/A'}`);
                console.log(`   Shipping: ${orderNames.shipping || 'N/A'}`);
                console.log(`   Billing: ${orderNames.billing || 'N/A'}`);
                console.log(`🔍 Recherche par nom: ${customerName}`);
                
                // Chercher par nom de client
                const ordersByName = await shopifyService.searchOrdersByCustomerName(customerName);
                if (ordersByName.length > 0) {
                  console.log(`📋 ${ordersByName.length} commandes trouvées, recherche du match exact...`);
                  
                  // Trouver une commande avec correspondance EXACTE en priorité : customer → shipping → billing
                  let exactMatch = null;
                  let matchType = null;
                  
                  // Priorité 1: chercher un match avec le nom client
                  for (const orderCandidate of ordersByName) {
                    const candidateMatchResult = shopifyService.isExactNameMatch(customerName, orderCandidate);
                    if (candidateMatchResult.isMatch && candidateMatchResult.matchType === 'customer') {
                      exactMatch = orderCandidate;
                      matchType = 'customer';
                      console.log(`✅ MATCH EXACT trouvé (customer): ${orderCandidate.name}`);
                      break;
                    }
                  }
                  
                  // Priorité 2: si pas de match customer, chercher un match avec le nom d'expédition
                  if (!exactMatch) {
                    for (const orderCandidate of ordersByName) {
                      const candidateMatchResult = shopifyService.isExactNameMatch(customerName, orderCandidate);
                      if (candidateMatchResult.isMatch && candidateMatchResult.matchType === 'shipping') {
                        exactMatch = orderCandidate;
                        matchType = 'shipping';
                        console.log(`✅ MATCH EXACT trouvé (shipping): ${orderCandidate.name}`);
                        break;
                      }
                    }
                  }
                  
                  // Priorité 3: si toujours pas de match, chercher un match avec le nom de facturation
                  if (!exactMatch) {
                    for (const orderCandidate of ordersByName) {
                      const candidateMatchResult = shopifyService.isExactNameMatch(customerName, orderCandidate);
                      if (candidateMatchResult.isMatch && candidateMatchResult.matchType === 'billing') {
                        exactMatch = orderCandidate;
                        matchType = 'billing';
                        console.log(`✅ MATCH EXACT trouvé (billing): ${orderCandidate.name}`);
                        break;
                      }
                    }
                  }
                  
                  if (exactMatch) {
                    order = exactMatch;
                    correctOrderNumber = order.name;
                  } else {
                    console.log(`❌ AUCUN MATCH EXACT trouvé parmi les ${ordersByName.length} commandes`);
                    results.push({
                      rowNumber,
                      customerName,
                      orderNumber,
                      success: false,
                      error: `Aucun match exact trouvé pour "${customerName}"`
                    });
                    continue;
                  }
                } else {
                  console.log(`❌ Aucune commande trouvée pour "${customerName}"`);
                  results.push({
                    rowNumber,
                    customerName,
                    orderNumber,
                    success: false,
                    error: `Aucune commande trouvée pour "${customerName}"`
                  });
                  continue;
                }
              } else {
                console.log(`✅ MATCH EXACT: ${customerName} = ${orderNumber} (type: ${matchResult.matchType})`);
              }
            }
          } catch (orderError) {
            console.log(`⚠️ Erreur avec ${orderNumber}, recherche par nom: ${customerName}`);
            
            // Si erreur avec le numéro, chercher par nom
            const ordersByName = await shopifyService.searchOrdersByCustomerName(customerName);
            if (ordersByName.length > 0) {
              console.log(`📋 ${ordersByName.length} commandes trouvées, recherche du match exact...`);
              
              // Trouver une commande avec correspondance EXACTE en priorité : customer → shipping → billing
              let exactMatch = null;
              let matchType = null;
              
              // Priorité 1: chercher un match avec le nom client
              for (const orderCandidate of ordersByName) {
                const candidateMatchResult = shopifyService.isExactNameMatch(customerName, orderCandidate);
                if (candidateMatchResult.isMatch && candidateMatchResult.matchType === 'customer') {
                  exactMatch = orderCandidate;
                  matchType = 'customer';
                  console.log(`✅ MATCH EXACT trouvé (customer): ${orderCandidate.name}`);
                  break;
                }
              }
              
              // Priorité 2: si pas de match customer, chercher un match avec le nom d'expédition
              if (!exactMatch) {
                for (const orderCandidate of ordersByName) {
                  const candidateMatchResult = shopifyService.isExactNameMatch(customerName, orderCandidate);
                  if (candidateMatchResult.isMatch && candidateMatchResult.matchType === 'shipping') {
                    exactMatch = orderCandidate;
                    matchType = 'shipping';
                    console.log(`✅ MATCH EXACT trouvé (shipping): ${orderCandidate.name}`);
                    break;
                  }
                }
              }
              
              // Priorité 3: si toujours pas de match, chercher un match avec le nom de facturation
              if (!exactMatch) {
                for (const orderCandidate of ordersByName) {
                  const candidateMatchResult = shopifyService.isExactNameMatch(customerName, orderCandidate);
                  if (candidateMatchResult.isMatch && candidateMatchResult.matchType === 'billing') {
                    exactMatch = orderCandidate;
                    matchType = 'billing';
                    console.log(`✅ MATCH EXACT trouvé (billing): ${orderCandidate.name}`);
                    break;
                  }
                }
              }
              
              if (exactMatch) {
                order = exactMatch;
                correctOrderNumber = order.name;
              } else {
                console.log(`❌ AUCUN MATCH EXACT trouvé parmi les ${ordersByName.length} commandes`);
              }
            }
          }
          
          if (order) {
            const formattedOrder = shopifyService.formatOrderForSheets(order);
            
            // Préparer les nouvelles données
            const newRowData = [...row];
            while (newRowData.length < 12) {
              newRowData.push('');
            }
            
            // Mettre à jour les colonnes
            newRowData[6] = formattedOrder.orderNumber;  // Colonne G - Numéro de commande (corrigé)
            newRowData[7] = formattedOrder.trackingNumber;  // Colonne H - Suivi de commande  
            newRowData[11] = formattedOrder.itemsGift;  // Colonne L - Items gift
            
            // Écrire dans Google Sheets avec l'URL de tracking
            await googleSheetsService.updateRow(rowNumber, newRowData, formattedOrder.trackingUrl);
            
            results.push({
              rowNumber,
              customerName,
              originalOrderNumber: orderNumber,
              correctOrderNumber: correctOrderNumber,
              success: true,
              trackingNumber: formattedOrder.trackingNumber,
              itemsGift: formattedOrder.itemsGift,
              orderCustomerName: shopifyService.getShippingName(order)
            });
            
            console.log(`✅ Ligne ${rowNumber} mise à jour: ${formattedOrder.trackingNumber} (${correctOrderNumber})`);
          } else {
            results.push({
              rowNumber,
              customerName,
              orderNumber,
              success: false,
              error: 'Commande non trouvée'
            });
          }
        } catch (error) {
          results.push({
            rowNumber,
            customerName,
            orderNumber,
            success: false,
            error: error.message
          });
        }
        
        // Petite pause pour éviter de surcharger l'API
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    res.json({
      success: true,
      message: `Traitement terminé: ${successCount} succès, ${failCount} échecs`,
      totalRows: results.length,
      successCount,
      failCount,
      results
    });
    
  } catch (error) {
    console.error('❌ Erreur mise à jour globale:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Force update a specific row in Google Sheets
app.post('/api/force-update-row/:rowNumber', async (req, res) => {
  try {
    const rowNumber = parseInt(req.params.rowNumber);
    console.log(`🔄 Force update: Mise à jour forcée de la ligne ${rowNumber}`);
    
    const data = await googleSheetsService.getSheetData();
    const rowIndex = rowNumber - 1;
    const row = data[rowIndex];
    
    if (!row) {
      return res.status(404).json({
        success: false,
        error: `Ligne ${rowNumber} non trouvée`
      });
    }
    
    const customerName = row[3];
    if (!customerName || customerName.trim() === '') {
      return res.status(400).json({
        success: false,
        error: `Aucun nom dans la colonne D de la ligne ${rowNumber}`
      });
    }
    
    console.log(`🔍 Recherche Shopify pour: ${customerName}`);
    
    // Rechercher les commandes
    const orders = await shopifyService.searchOrdersByCustomerName(customerName);
    
    if (orders.length === 0) {
      return res.json({
        success: false,
        message: `Aucune commande trouvée pour ${customerName}`,
        customerName,
        foundOrders: 0
      });
    }
    
    const order = orders[0];
    console.log(`✓ Commande trouvée: ${order.name}`);
    
    // Formater les données
    const formattedOrder = shopifyService.formatOrderForSheets(order);
    console.log(`📝 Données à écrire:`, formattedOrder);
    
    // Préparer les nouvelles données
    const newRowData = [...row];
    while (newRowData.length < 12) {
      newRowData.push('');
    }
    
    // Mettre à jour les colonnes spécifiques
    newRowData[6] = formattedOrder.orderNumber;  // Colonne G - Numéro de commande
    newRowData[7] = formattedOrder.trackingNumber;  // Colonne H - Suivi de commande  
    newRowData[11] = formattedOrder.itemsGift;  // Colonne L - Items gift
    
    console.log(`📝 Nouvelles données ligne:`, newRowData);
    
    // Écrire dans Google Sheets avec l'URL de tracking
    await googleSheetsService.updateRow(rowNumber, newRowData, formattedOrder.trackingUrl);
    
    console.log(`✅ Ligne ${rowNumber} mise à jour avec succès`);
    
    res.json({
      success: true,
      message: `Ligne ${rowNumber} mise à jour avec succès`,
      customerName,
      orderNumber: formattedOrder.orderNumber,
      trackingNumber: formattedOrder.trackingNumber,
      itemsGift: formattedOrder.itemsGift
    });
    
  } catch (error) {
    console.error('❌ Erreur force update:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Reorganize all orders in chronological order
app.post('/api/reorganize-orders-chronologically', async (req, res) => {
  try {
    console.log('🔄 Réorganisation de TOUTES les commandes dans l\'ordre chronologique...');
    
    // 1. Récupérer TOUTES les commandes avec codes promo depuis Shopify
    let allPromoOrders = [];
    let pageInfo = null;
    let page = 0;
    
    while (page < 20) {
      console.log(`📄 Récupération page ${page + 1}...`);
      
      let url = '/orders.json?limit=250&status=any';
      if (pageInfo) url += `&page_info=${pageInfo}`;
      
      const data = await shopifyService.makeRequest(url);
      if (!data.orders || data.orders.length === 0) break;
      
      const requiredCodes = ['J4Y4TC0G1FT', 'J4Y4TC0SH1P'];
      const promoOrders = data.orders.filter(order => {
        if (order.discount_codes && Array.isArray(order.discount_codes)) {
          return order.discount_codes.some(dc => requiredCodes.includes(dc.code));
        }
        return false;
      });
      
      allPromoOrders = allPromoOrders.concat(promoOrders);
      console.log(`   → ${promoOrders.length}/${data.orders.length} avec codes promo (Total: ${allPromoOrders.length})`);
      
      pageInfo = data.page_info;
      if (!pageInfo || data.orders.length < 250) break;
      page++;
    }
    
    // 2. Trier par numéro de commande
    allPromoOrders.sort((a, b) => {
      const numA = parseInt(a.name.replace('#TCO', '').replace('#TC0', '').replace('#C', ''));
      const numB = parseInt(b.name.replace('#TCO', '').replace('#TC0', '').replace('#C', ''));
      return numA - numB;
    });
    
    console.log(`\n📋 ${allPromoOrders.length} commandes triées par ordre chronologique:\n`);
    
    // 3. Récupérer les données actuelles du Sheets
    const sheetsData = await googleSheetsService.getSheetData();
    const header = sheetsData[0]; // Garder l'en-tête
    
    // 4. Créer les nouvelles données dans l'ordre chronologique
    const newRows = [header]; // Commencer avec l'en-tête
    
    for (const order of allPromoOrders) {
      const shippingName = order.shipping_address?.name || 
        (order.customer ? `${order.customer.first_name} ${order.customer.last_name}`.trim() : 'N/A');
      
      const formattedOrder = shopifyService.formatOrderForSheets(order);
      
      // Créer la ligne complète (colonnes A à L)
      const rowData = [];
      rowData[0] = ''; // A: ?
      rowData[1] = ''; // B: ?
      rowData[2] = ''; // C: ?
      rowData[3] = shippingName; // D: Name
      rowData[4] = ''; // E: ?
      rowData[5] = ''; // F: ?
      rowData[6] = formattedOrder.orderNumber; // G: Numéro de commande
      rowData[7] = formattedOrder.trackingNumber; // H: Suivi de commande
      rowData[8] = ''; // I: ?
      rowData[9] = ''; // J: ?
      rowData[10] = ''; // K: ?
      rowData[11] = formattedOrder.itemsGift; // L: Items gift
      
      newRows.push(rowData);
      console.log(`  ${order.name.padEnd(12)} - ${shippingName}`);
    }
    
    // 5. Effacer tout le contenu du Sheets (sauf l'en-tête) et réécrire dans l'ordre
    console.log(`\n✏️ Réécriture de ${newRows.length} lignes dans Google Sheets...`);
    
    // Effacer tout d'abord
    const clearRange = `A2:L${sheetsData.length}`;
    await googleSheetsService.sheets.spreadsheets.values.clear({
      spreadsheetId: googleSheetsService.spreadsheetId,
      range: clearRange
    });
    
    // Écrire les nouvelles données
    const writeRange = `A1:L${newRows.length}`;
    await googleSheetsService.sheets.spreadsheets.values.update({
      spreadsheetId: googleSheetsService.spreadsheetId,
      range: writeRange,
      valueInputOption: 'RAW',
      resource: { values: newRows }
    });
    
    // 6. Appliquer les hyperliens pour les numéros de tracking
    for (let i = 1; i < newRows.length; i++) {
      const row = newRows[i];
      const trackingNumber = row[7]; // Colonne H
      if (trackingNumber && trackingNumber.trim()) {
        // Extraire l'URL de tracking depuis la commande Shopify
        const order = allPromoOrders[i - 1];
        const trackingUrl = order.fulfillments?.[0]?.tracking_info?.[0]?.url || null;
        
        if (trackingUrl) {
          await googleSheetsService.updateRow(i + 1, row, trackingUrl);
        }
      }
    }
    
    res.json({
      success: true,
      message: `Réorganisation terminée: ${allPromoOrders.length} commandes dans l'ordre chronologique`,
      totalOrders: allPromoOrders.length
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Find and insert missing orders with promo codes (OBSOLETE - utiliser reorganize-orders-chronologically)
app.post('/api/find-and-insert-missing-orders', async (req, res) => {
  try {
    console.log('🔍 Recherche des commandes manquantes avec codes promo...');
    
    // 1. Récupérer toutes les commandes avec codes promo depuis Shopify
    let allPromoOrders = [];
    let pageInfo = null;
    let page = 0;
    
    while (page < 20) {
      console.log(`📄 Récupération page ${page + 1}...`);
      
      let url = '/orders.json?limit=250&status=any';
      if (pageInfo) {
        url += `&page_info=${pageInfo}`;
      }
      
      const data = await shopifyService.makeRequest(url);
      
      if (!data.orders || data.orders.length === 0) break;
      
      // Filtrer les commandes avec codes promo
      const requiredCodes = ['J4Y4TC0G1FT', 'J4Y4TC0SH1P'];
      const promoOrders = data.orders.filter(order => {
        if (order.discount_codes && Array.isArray(order.discount_codes)) {
          return order.discount_codes.some(dc => requiredCodes.includes(dc.code));
        }
        return false;
      });
      
      allPromoOrders = allPromoOrders.concat(promoOrders);
      console.log(`   → ${promoOrders.length}/${data.orders.length} commandes avec codes promo (Total: ${allPromoOrders.length})`);
      
      pageInfo = data.page_info;
      if (!pageInfo || data.orders.length < 250) break;
      page++;
    }
    
    console.log(`✅ ${allPromoOrders.length} commandes avec codes promo trouvées\n`);
    
    // 2. Trier par numéro de commande
    allPromoOrders.sort((a, b) => {
      const numA = parseInt(a.name.replace('#TCO', '').replace('#C', ''));
      const numB = parseInt(b.name.replace('#TCO', '').replace('#C', ''));
      return numA - numB;
    });
    
    // 3. Récupérer les commandes existantes dans le Google Sheets
    const sheetsData = await googleSheetsService.getSheetData();
    const existingOrderNumbers = new Set();
    
    for (let i = 1; i < sheetsData.length; i++) {
      const orderNum = sheetsData[i][6]; // Colonne G
      if (orderNum && orderNum.trim()) {
        existingOrderNumbers.add(orderNum.trim());
      }
    }
    
    console.log(`📊 ${existingOrderNumbers.size} commandes déjà dans le Google Sheets\n`);
    
    // 4. Identifier les commandes manquantes
    const missingOrders = allPromoOrders.filter(order => !existingOrderNumbers.has(order.name));
    
    console.log(`🔍 ${missingOrders.length} commandes manquantes trouvées\n`);
    
    if (missingOrders.length === 0) {
      return res.json({
        success: true,
        message: 'Aucune commande manquante',
        totalPromoOrders: allPromoOrders.length,
        existingOrders: existingOrderNumbers.size,
        missingOrders: 0,
        insertedOrders: []
      });
    }
    
    // 5. Trier les commandes existantes par numéro de commande pour trouver les positions d'insertion
    const existingRowsWithOrderNum = [];
    for (let i = 1; i < sheetsData.length; i++) {
      const row = sheetsData[i];
      const orderNum = row[6]; // Colonne G
      if (orderNum && orderNum.trim()) {
        existingRowsWithOrderNum.push({
          rowIndex: i + 1, // Numéro de ligne dans Sheets
          orderNum: orderNum.trim(),
          row: row
        });
      }
    }
    
    // Trier par numéro de commande
    existingRowsWithOrderNum.sort((a, b) => {
      const numA = parseInt(a.orderNum.replace('#TCO', '').replace('#TC0', '').replace('#C', ''));
      const numB = parseInt(b.orderNum.replace('#TCO', '').replace('#TC0', '').replace('#C', ''));
      return numA - numB;
    });
    
    console.log(`\n📊 Commandes existantes triées par ordre chronologique:`);
    existingRowsWithOrderNum.forEach((item, index) => {
      console.log(`  ${(index + 1).toString().padStart(2)}. ${item.orderNum}`);
    });
    
    // 6. Trouver les positions d'insertion pour les commandes manquantes
    const insertedOrders = [];
    
    for (const order of missingOrders) {
      try {
        const orderNum = order.name;
        const orderNumInt = parseInt(orderNum.replace('#TCO', '').replace('#TC0', '').replace('#C', ''));
        
        // Trouver l'index d'insertion dans l'ordre chronologique
        let insertPosition = existingRowsWithOrderNum.length + 1; // Par défaut à la fin
        for (let i = 0; i < existingRowsWithOrderNum.length; i++) {
          const existingNumInt = parseInt(existingRowsWithOrderNum[i].orderNum.replace('#TCO', '').replace('#TC0', '').replace('#C', ''));
          if (orderNumInt < existingNumInt) {
            insertPosition = existingRowsWithOrderNum[i].rowIndex;
            break;
          }
        }
        
        console.log(`\n📌 Insertion de ${orderNum} à la position ${insertPosition}`);
        
        // Formater les données de la commande
        const shippingName = order.shipping_address?.name || 
          (order.customer ? `${order.customer.first_name} ${order.customer.last_name}`.trim() : 'N/A');
        
        const formattedOrder = shopifyService.formatOrderForSheets(order);
        
        // Créer les données de la ligne
        const rowData = [];
        rowData[3] = shippingName; // Colonne D - Name
        rowData[6] = formattedOrder.orderNumber; // Colonne G - Numéro de commande
        rowData[7] = formattedOrder.trackingNumber; // Colonne H - Suivi de commande
        rowData[11] = formattedOrder.itemsGift; // Colonne L - Items gift
        
        // Insérer dans Google Sheets
        await googleSheetsService.insertRowAtPosition(insertPosition, rowData);
        
        insertedOrders.push({
          orderNumber: formattedOrder.orderNumber,
          name: shippingName,
          tracking: formattedOrder.trackingNumber,
          items: formattedOrder.itemsGift,
          position: insertPosition
        });
        
        console.log(`✅ Inséré: ${formattedOrder.orderNumber} - ${shippingName} à la position ${insertPosition}`);
        
        // Mettre à jour la liste des positions existantes
        existingRowsWithOrderNum.push({ rowIndex: insertPosition, orderNum: orderNum, row: rowData });
        existingRowsWithOrderNum.sort((a, b) => {
          const numA = parseInt(a.orderNum.replace('#TCO', '').replace('#TC0', '').replace('#C', ''));
          const numB = parseInt(b.orderNum.replace('#TCO', '').replace('#TC0', '').replace('#C', ''));
          return numA - numB;
        });
        
        // Petite pause pour éviter de surcharger l'API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`❌ Erreur lors de l'insertion de ${order.name}:`, error.message);
      }
    }
    
    res.json({
      success: true,
      message: `${insertedOrders.length} commandes insérées dans l'ordre chronologique`,
      totalPromoOrders: allPromoOrders.length,
      existingOrders: existingOrderNumbers.size,
      missingOrders: missingOrders.length,
      insertedOrders: insertedOrders,
      totalOrders: allPromoOrders.length
    });
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// WEBHOOKS DÉSACTIVÉS
// ========================================
// Les utilisateurs doivent ajouter manuellement les noms dans Google Sheets.
// L'application surveillera automatiquement Google Sheets et remplira les informations.
// ========================================

/*
// Webhook pour les nouvelles commandes Shopify (DÉSACTIVÉ)
app.post('/api/webhook/order-created', async (req, res) => {
  res.status(200).send('Webhook disabled - Please add names manually to Google Sheets');
});

// Webhook pour les commandes expédiées (DÉSACTIVÉ)
app.post('/api/webhook/order-fulfilled', async (req, res) => {
  res.status(200).send('Webhook disabled - Please add names manually to Google Sheets');
});

// Webhook pour les mises à jour de commandes (DÉSACTIVÉ)
app.post('/api/webhook/order-updated', async (req, res) => {
  res.status(200).send('Webhook disabled - Please add names manually to Google Sheets');
});
*/

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
