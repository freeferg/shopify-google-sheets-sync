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
        // Colonne D (index 3) = Name
        if (row && row[3] && row[3].trim() !== '') {
          const rowKey = `${i}:${row[3]}`;
          
          // Vérifier si la ligne a déjà des informations complètes
          // Colonne G (index 6) = Numéro de commande
          // Colonne H (index 7) = Suivi de commande
          // Colonne L (index 11) = Items gift
          const hasOrderNumber = row[6] && row[6].trim() !== '';
          const hasTracking = row[7] && row[7].trim() !== '';
          const hasItems = row[11] && row[11].trim() !== '';
          
          // Si la ligne n'est pas complète, la traiter
          if (!hasOrderNumber || !hasTracking || !hasItems) {
            console.log(`🔄 Traitement de la ligne existante ${i + 1}: ${row[3]}`);
            await this.fetchAndFillShopifyData(i, row[3], row);
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
        // Colonne D (index 3) = Name
        if (!row || !row[3] || row[3].trim() === '') continue;
        
        const rowKey = `${i}:${row[3]}`;
        
        // Si cette ligne n'a pas été traitée
        if (!this.lastProcessedRows.has(rowKey)) {
          console.log(`🆕 Nouveau nom détecté: ${row[3]} à la ligne ${i + 1}`);
          
          // Vérifier si la ligne a déjà des informations complètes
          // Colonne G (index 6) = Numéro de commande
          // Colonne H (index 7) = Suivi de commande
          // Colonne L (index 11) = Items gift
          const hasOrderNumber = row[6] && row[6].trim() !== '';
          const hasTracking = row[7] && row[7].trim() !== '';
          const hasItems = row[11] && row[11].trim() !== '';
          
          // Si la ligne n'est pas complète, chercher les informations Shopify
          if (!hasOrderNumber || !hasTracking || !hasItems) {
            await this.fetchAndFillShopifyData(i, row[3], row);
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
      let order = null;
      
      // Si un numéro de commande existe déjà (colonne G, index 6), l'utiliser directement
      const existingOrderNumber = currentRow[6] && currentRow[6].trim();
      if (existingOrderNumber && existingOrderNumber.startsWith('#TCO')) {
        console.log(`🔍 Recherche de la commande par numéro: ${existingOrderNumber}`);
        try {
          order = await shopifyService.getOrder(existingOrderNumber);
          console.log(`✓ Commande ${existingOrderNumber} trouvée`);
        } catch (error) {
          console.log(`⚠️ Commande ${existingOrderNumber} non trouvée, recherche par nom...`);
        }
      }
      
      // Si pas de commande trouvée par ID, chercher par nom
      if (!order) {
        console.log(`🔍 Recherche des commandes Shopify pour: ${customerName}`);
        const orders = await shopifyService.searchOrdersByCustomerName(customerName);
        
        if (orders.length === 0) {
          console.log(`⚠️ Aucune commande trouvée pour: ${customerName}`);
          return;
        }
        
        // Prendre la commande la plus récente
        order = orders[0];
      }
      
      const formattedOrder = shopifyService.formatOrderForSheets(order);
      
      // Préparer les nouvelles données - s'assurer que le tableau a la bonne taille
      const newRowData = [...currentRow];
      while (newRowData.length < 12) {
        newRowData.push('');
      }
      
      // Remplir les colonnes manquantes selon la nouvelle structure
      // Colonne G (index 6) = Numéro de commande
      if (!newRowData[6] || newRowData[6].trim() === '') {
        newRowData[6] = formattedOrder.orderNumber;
      }
      
      // Colonne H (index 7) = Suivi de commande
      if (!newRowData[7] || newRowData[7].trim() === '') {
        newRowData[7] = formattedOrder.trackingNumber;
      }
      
      // Colonne L (index 11) = Items gift
      if (!newRowData[11] || newRowData[11].trim() === '') {
        newRowData[11] = formattedOrder.itemsGift;
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
