#!/usr/bin/env node

require('dotenv').config();
const googleSheetsService = require('../services/googleSheetsService');

async function testChronologicalLogic() {
  console.log('🔍 Test de la logique chronologique...\n');
  
  try {
    // Test de connexion
    console.log('📊 Test de connexion Google Sheets...');
    const connectionTest = await googleSheetsService.testConnection();
    if (!connectionTest.success) {
      console.log('❌ Connexion échouée:', connectionTest.error);
      return;
    }
    console.log('✅ Connexion réussie\n');
    
    // Test de validation de structure
    console.log('🔧 Validation de la structure du tableau...');
    const structureValidation = await googleSheetsService.validateSheetStructure();
    if (!structureValidation.isValid) {
      console.log('❌ Structure invalide:', structureValidation.message);
      console.log('En-têtes attendus:', structureValidation.expectedHeaders.join(' | '));
      console.log('En-têtes trouvés:', structureValidation.headers.join(' | '));
      return;
    }
    console.log('✅ Structure valide\n');
    
    // Test d'extraction de date
    console.log('📅 Test d\'extraction de date des numéros de commande...');
    const testOrderNumbers = ['#TCO10842', '#TCO10867', '#TCO11834', 'RMP', 'ORDER123'];
    
    testOrderNumbers.forEach(orderNumber => {
      const extractedDate = googleSheetsService.extractOrderDate(orderNumber);
      console.log(`   ${orderNumber} → ${extractedDate || 'Non extrait'}`);
    });
    
    // Test de recherche par nom
    console.log('\n👤 Test de recherche par nom...');
    const testCustomerName = 'Franck Cathus'; // Remplacer par un nom existant dans votre tableau
    
    try {
      const customerOrders = await googleSheetsService.findRowsByName(testCustomerName);
      console.log(`   Trouvé ${customerOrders.length} commandes pour "${testCustomerName}"`);
      
      if (customerOrders.length > 0) {
        console.log('   Commandes trouvées:');
        customerOrders.forEach((order, index) => {
          console.log(`     ${index + 1}. Ligne ${order.rowIndex}: ${order.orderNumber} (Date: ${order.orderDate || 'N/A'})`);
        });
        
        // Test d'analyse des commandes client
        console.log('\n📊 Analyse des commandes client...');
        const analysis = await googleSheetsService.analyzeCustomerOrders(testCustomerName);
        console.log(`   Client: ${analysis.customerName}`);
        console.log(`   Total commandes: ${analysis.totalOrders}`);
        console.log(`   Ordre chronologique: ${analysis.chronologicalOrder}`);
        
        analysis.orders.forEach((order, index) => {
          console.log(`   Commande ${index + 1}:`);
          console.log(`     - Ligne: ${order.rowIndex}`);
          console.log(`     - Numéro: ${order.orderNumber}`);
          console.log(`     - Date: ${order.orderDate || 'N/A'}`);
          console.log(`     - Suivi: ${order.hasTracking ? 'Oui' : 'Non'}`);
          console.log(`     - Articles: ${order.hasItems ? 'Oui' : 'Non'}`);
        });
      } else {
        console.log('   Aucune commande trouvée pour ce client');
      }
    } catch (error) {
      console.log(`   Erreur lors de la recherche: ${error.message}`);
    }
    
    // Test de simulation d'insertion chronologique
    console.log('\n🔄 Test de simulation d\'insertion chronologique...');
    
    const mockOrderData = {
      name: testCustomerName,
      orderNumber: '#TCO12000', // Numéro entre les existants
      trackingNumber: 'TEST123456',
      itemsGift: '1 DB BLANC'
    };
    
    console.log(`   Simulation d'insertion de commande:`);
    console.log(`   - Client: ${mockOrderData.name}`);
    console.log(`   - Numéro: ${mockOrderData.orderNumber}`);
    console.log(`   - Date extraite: ${googleSheetsService.extractOrderDate(mockOrderData.orderNumber)}`);
    
    // Ne pas vraiment insérer, juste tester la logique
    console.log('   (Test de logique uniquement - pas d\'insertion réelle)');
    
    console.log('\n🎉 Tests terminés avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.message);
  }
}

// Gérer l'interruption
process.on('SIGINT', () => {
  console.log('\n\nTests interrompus.');
  process.exit(0);
});

testChronologicalLogic().catch(console.error);
