#!/usr/bin/env node

require('dotenv').config();
const shopifyService = require('../services/shopifyService');
const googleSheetsService = require('../services/googleSheetsService');

async function testConnections() {
  console.log('🔍 Test des connexions...\n');
  
  // Test Shopify
  console.log('📦 Test de la connexion Shopify...');
  try {
    const shopifyResult = await shopifyService.testConnection();
    if (shopifyResult.success) {
      console.log('✅ Shopify connecté avec succès');
      console.log(`   Boutique: ${shopifyResult.shop.name}`);
      console.log(`   Domaine: ${shopifyResult.shop.domain}`);
      console.log(`   Devise: ${shopifyResult.shop.currency}`);
    } else {
      console.log('❌ Erreur de connexion Shopify:', shopifyResult.error);
    }
  } catch (error) {
    console.log('❌ Erreur de connexion Shopify:', error.message);
  }
  
  console.log('\n📊 Test de la connexion Google Sheets...');
  try {
    const sheetsResult = await googleSheetsService.testConnection();
    if (sheetsResult.success) {
      console.log('✅ Google Sheets connecté avec succès');
      console.log(`   Tableau: ${sheetsResult.spreadsheet.title}`);
      console.log(`   Feuilles: ${sheetsResult.spreadsheet.sheets.map(s => s.title).join(', ')}`);
    } else {
      console.log('❌ Erreur de connexion Google Sheets:', sheetsResult.error);
    }
  } catch (error) {
    console.log('❌ Erreur de connexion Google Sheets:', error.message);
  }
  
  console.log('\n🔧 Validation de la structure du tableau...');
  try {
    const structureValidation = await googleSheetsService.validateSheetStructure();
    if (structureValidation.isValid) {
      console.log('✅ Structure du tableau valide');
    } else {
      console.log('❌ Structure du tableau invalide');
      console.log('   En-têtes attendus:', structureValidation.expectedHeaders.join(' | '));
      console.log('   En-têtes trouvés:', structureValidation.headers.join(' | '));
    }
  } catch (error) {
    console.log('❌ Erreur de validation:', error.message);
  }
  
  console.log('\n📋 Test de récupération des commandes...');
  try {
    const orders = await shopifyService.getOrders(3);
    console.log(`✅ ${orders.length} commandes récupérées`);
    
    if (orders.length > 0) {
      const sampleOrder = orders[0];
      console.log('   Exemple de commande:');
      console.log(`   - Numéro: ${sampleOrder.name || sampleOrder.id}`);
      console.log(`   - Articles: ${sampleOrder.line_items.length} items`);
      console.log(`   - Statut: ${sampleOrder.financial_status}`);
      
      // Test du formatage
      const formattedOrder = shopifyService.formatOrderForSheets(sampleOrder);
      console.log('   Formatage pour Google Sheets:');
      console.log(`   - Nom: ${formattedOrder.name}`);
      console.log(`   - Numéro: ${formattedOrder.orderNumber}`);
      console.log(`   - Suivi: ${formattedOrder.trackingNumber}`);
      console.log(`   - Articles: ${formattedOrder.itemsGift}`);
    }
  } catch (error) {
    console.log('❌ Erreur de récupération des commandes:', error.message);
  }
  
  console.log('\n🎉 Test terminé!');
}

testConnections().catch(console.error);
