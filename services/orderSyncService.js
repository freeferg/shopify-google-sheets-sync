const shopifyService = require('./shopifyService');
const googleSheetsService = require('./googleSheetsService');

class OrderSyncService {
  constructor() {
    this.shopifyService = shopifyService;
    this.googleSheetsService = googleSheetsService;
  }

  async syncOrdersToSheets(orders) {
    const results = {
      total: orders.length,
      successCount: 0,
      failedCount: 0,
      details: []
    };

    console.log(`🔄 Début de la synchronisation de ${orders.length} commandes...`);

    // Vérifier la structure du tableau avant de commencer
    const structureValidation = await this.googleSheetsService.validateSheetStructure();
    if (!structureValidation.isValid) {
      throw new Error(`Structure du tableau invalide: ${structureValidation.message}`);
    }

    for (const order of orders) {
      try {
        console.log(`📦 Synchronisation de la commande ${order.name || order.id}...`);
        
        // Formater les données de la commande
        const formattedOrder = this.shopifyService.formatOrderForSheets(order);
        
        // Synchroniser avec Google Sheets
        const syncResult = await this.googleSheetsService.syncOrderData(formattedOrder);
        
        results.successCount++;
        
        // Créer un message détaillé selon l'action
        let actionMessage = '';
        switch (syncResult.action) {
          case 'updated':
            actionMessage = 'Commande mise à jour avec succès';
            break;
          case 'created':
            actionMessage = 'Nouvelle commande ajoutée à la fin du tableau';
            break;
          case 'inserted_chronological':
            actionMessage = `Commande insérée chronologiquement à la position ${syncResult.rowIndex}`;
            break;
          case 'inserted_after_last':
            actionMessage = `Commande ajoutée après la dernière commande du client (ligne ${syncResult.rowIndex})`;
            break;
          default:
            actionMessage = `Commande synchronisée (action: ${syncResult.action})`;
        }
        
        results.details.push({
          orderNumber: formattedOrder.orderNumber,
          customerName: formattedOrder.name,
          action: syncResult.action,
          rowIndex: syncResult.rowIndex,
          success: true,
          message: actionMessage
        });
        
        console.log(`✅ Commande ${formattedOrder.orderNumber} synchronisée (${syncResult.action})`);
        
      } catch (error) {
        results.failedCount++;
        const orderNumber = order.name || order.id;
        
        results.details.push({
          orderNumber: orderNumber,
          success: false,
          error: error.message
        });
        
        console.error(`❌ Erreur pour la commande ${orderNumber}:`, error.message);
      }
    }

    console.log(`🎉 Synchronisation terminée: ${results.successCount}/${results.total} commandes synchronisées`);
    
    return results;
  }

  async syncSpecificOrders(orderIds) {
    try {
      console.log(`🔄 Synchronisation des commandes spécifiques: ${orderIds.join(', ')}`);
      
      const orders = await this.shopifyService.getOrdersByIds(orderIds);
      
      if (orders.length === 0) {
        throw new Error('Aucune commande trouvée avec les IDs fournis');
      }
      
      return await this.syncOrdersToSheets(orders);
    } catch (error) {
      throw new Error(`Erreur lors de la synchronisation des commandes spécifiques: ${error.message}`);
    }
  }

  async syncRecentOrders(limit = 10, status = 'any') {
    try {
      console.log(`🔄 Synchronisation des ${limit} commandes récentes (statut: ${status})`);
      
      const orders = await this.shopifyService.getOrders(limit, status);
      
      if (orders.length === 0) {
        throw new Error('Aucune commande trouvée');
      }
      
      return await this.syncOrdersToSheets(orders);
    } catch (error) {
      throw new Error(`Erreur lors de la synchronisation des commandes récentes: ${error.message}`);
    }
  }

  // Méthode pour analyser et formater les line items selon la notation spécifiée
  analyzeLineItems(lineItems) {
    const analysis = {
      totalItems: 0,
      mappedItems: {},
      unmappedItems: [],
      formattedNotation: ''
    };

    lineItems.forEach(item => {
      analysis.totalItems += item.quantity;
      
      const productTitle = item.title.toLowerCase();
      let itemCode = '';
      let color = '';
      
      // Mapping selon la notation spécifiée
      if (productTitle.includes('débardeur') || productTitle.includes('debardeur')) {
        itemCode = 'DB';
        if (productTitle.includes('blanc')) {
          color = 'BLANC';
        } else if (productTitle.includes('noir')) {
          color = 'NOIR';
        }
      } else if (productTitle.includes('thermal') || productTitle.includes('thermals')) {
        itemCode = 'TH';
        if (productTitle.includes('blanc')) {
          color = 'BLANC';
        } else if (productTitle.includes('noir')) {
          color = 'NOIR';
        }
      }
      
      if (itemCode && color) {
        const key = `${itemCode} ${color}`;
        analysis.mappedItems[key] = (analysis.mappedItems[key] || 0) + item.quantity;
      } else {
        analysis.unmappedItems.push({
          title: item.title,
          quantity: item.quantity,
          reason: !itemCode ? 'Type de produit non reconnu' : 'Couleur non spécifiée'
        });
      }
    });
    
    // Créer la notation formatée
    const items = Object.entries(analysis.mappedItems)
      .filter(([key, quantity]) => quantity > 0)
      .map(([key, quantity]) => `${quantity} ${key}`)
      .join(' + ');
    
    analysis.formattedNotation = items || '';
    
    return analysis;
  }

  // Méthode pour valider les données avant synchronisation
  validateOrderData(order) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Vérifier les données essentielles
    if (!order.id && !order.name) {
      validation.isValid = false;
      validation.errors.push('Numéro de commande manquant');
    }

    if (!order.line_items || order.line_items.length === 0) {
      validation.warnings.push('Aucun article trouvé dans la commande');
    }

    if (!order.shipping_address && !order.customer) {
      validation.warnings.push('Informations de livraison manquantes');
    }

    return validation;
  }

  // Méthode pour obtenir les statistiques de synchronisation
  getSyncStatistics(results) {
    return {
      totalOrders: results.total,
      successfulSyncs: results.successCount,
      failedSyncs: results.failedCount,
      successRate: results.total > 0 ? (results.successCount / results.total * 100).toFixed(2) + '%' : '0%',
      actions: {
        created: results.details.filter(d => d.action === 'created').length,
        updated: results.details.filter(d => d.action === 'updated').length
      }
    };
  }
}

module.exports = new OrderSyncService();
