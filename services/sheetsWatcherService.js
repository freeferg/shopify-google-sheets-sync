const googleSheetsService = require('./googleSheetsService');
const shopifyService = require('./shopifyService');

class SheetsWatcherService {
  constructor() {
    this.isWatching = false;
    this.lastProcessedRows = new Set();
    this.pollInterval = 30000; // 30 secondes
    this.pollTimer = null;
  }

  async startWatching() {
    if (this.isWatching) {
      console.log('⚠️ Surveillance déjà active');
      return;
    }

    console.log('🔍 Démarrage de la surveillance Google Sheets...');
    this.isWatching = true;
    
    // Initialiser avec les lignes existantes
    await this.initializeExistingRows();
    
    // Démarrer le polling
    this.pollTimer = setInterval(async () => {
      try {
        await this.checkForNewNames();
      } catch (error) {
        console.error('❌ Erreur lors de la surveillance:', error.message);
      }
    }, this.pollInterval);

    console.log(`✅ Surveillance active (vérification toutes les ${this.pollInterval/1000}s)`);
  }

  async stopWatching() {
    if (!this.isWatching) {
      console.log('⚠️ Surveillance déjà arrêtée');
      return;
    }

    console.log('⏹️ Arrêt de la surveillance Google Sheets...');
    this.isWatching = false;
    
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    console.log('✅ Surveillance arrêtée');
  }

  async initializeExistingRows() {
    try {
      const data = await googleSheetsService.getSheetData();
      
      // Traiter les lignes existantes
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row && row[0] && row[0].trim() !== '') {
          const rowKey = `${i}:${row[0]}`;
          
          // Vérifier si la ligne a déjà des informations complètes
          const hasOrderNumber = row[3] && row[3].trim() !== '';
          const hasTracking = row[4] && row[4].trim() !== '';
          const hasItems = row[7] && row[7].trim() !== '';
          
          // Si la ligne n'est pas complète, la traiter
          if (!hasOrderNumber || !hasTracking || !hasItems) {
            console.log(`🔄 Traitement de la ligne existante ${i + 1}: ${row[0]}`);
            await this.fetchAndFillShopifyData(i, row[0], row);
          }
          
          // Marquer comme traitée
          this.lastProcessedRows.add(rowKey);
        }
      }
      
      console.log(`📊 ${this.lastProcessedRows.size} lignes existantes initialisées`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation:', error.message);
    }
  }

  async checkForNewNames() {
    try {
      const data = await googleSheetsService.getSheetData();
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || !row[0] || row[0].trim() === '') continue;
        
        const rowKey = `${i}:${row[0]}`;
        
        // Si cette ligne n'a pas été traitée
        if (!this.lastProcessedRows.has(rowKey)) {
          console.log(`🆕 Nouveau nom détecté: ${row[0]} à la ligne ${i}`);
          
          // Vérifier si la ligne a déjà des informations complètes
          const hasOrderNumber = row[3] && row[3].trim() !== '';
          const hasTracking = row[4] && row[4].trim() !== '';
          const hasItems = row[7] && row[7].trim() !== '';
          
          // Si la ligne n'est pas complète, chercher les informations Shopify
          if (!hasOrderNumber || !hasTracking || !hasItems) {
            await this.fetchAndFillShopifyData(i, row[0], row);
          }
          
          // Marquer comme traitée
          this.lastProcessedRows.add(rowKey);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de la vérification:', error.message);
    }
  }

  async fetchAndFillShopifyData(rowIndex, customerName, currentRow) {
    try {
      console.log(`🔍 Recherche des commandes Shopify pour: ${customerName}`);
      
      // Rechercher les commandes de ce client dans Shopify
      const orders = await shopifyService.searchOrdersByCustomerName(customerName);
      
      if (orders.length === 0) {
        console.log(`⚠️ Aucune commande trouvée pour: ${customerName}`);
        return;
      }
      
      // Prendre la commande la plus récente
      const latestOrder = orders[0];
      const formattedOrder = shopifyService.formatOrderForSheets(latestOrder);
      
      // Préparer les nouvelles données
      const newRowData = [...currentRow];
      
      // Remplir les colonnes manquantes
      if (!newRowData[3] || newRowData[3].trim() === '') {
        newRowData[3] = formattedOrder.orderNumber; // Numéro de commande
      }
      
      if (!newRowData[4] || newRowData[4].trim() === '') {
        newRowData[4] = formattedOrder.trackingNumber; // Suivi de commande
      }
      
      if (!newRowData[7] || newRowData[7].trim() === '') {
        newRowData[7] = formattedOrder.itemsGift; // ITEMS GIFT
      }
      
      // Mettre à jour la ligne dans Google Sheets
      await googleSheetsService.updateRow(rowIndex + 1, newRowData);
      
      console.log(`✅ Ligne ${rowIndex + 1} mise à jour pour ${customerName}`);
      
    } catch (error) {
      console.error(`❌ Erreur lors de la mise à jour pour ${customerName}:`, error.message);
    }
  }

  getStatus() {
    return {
      isWatching: this.isWatching,
      pollInterval: this.pollInterval,
      processedRows: this.lastProcessedRows.size
    };
  }
}

module.exports = new SheetsWatcherService();
