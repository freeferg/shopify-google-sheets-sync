const { google } = require('googleapis');
const fs = require('fs');

// Détecter l'environnement Railway
const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production' || 
                  process.env.NODE_ENV === 'production' || 
                  process.env.GOOGLE_SHEETS_CREDENTIALS; // Si cette variable existe, c'est Railway

if (isRailway) {
  // Utiliser le service Railway
  module.exports = require('./googleSheetsServiceRailway');
} else {
  // Utiliser le service local
  class GoogleSheetsService {
    constructor() {
      this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
      this.credentialsFile = process.env.GOOGLE_SHEETS_CREDENTIALS_FILE || './credentials.json';
      
      if (!this.spreadsheetId) {
        throw new Error('Configuration Google Sheets manquante. Vérifiez GOOGLE_SHEETS_SPREADSHEET_ID');
      }
      
      this.auth = null;
      this.sheets = null;
      this.initAuth();
    }

  initAuth() {
    try {
      if (!fs.existsSync(this.credentialsFile)) {
        throw new Error(`Fichier de credentials Google non trouvé: ${this.credentialsFile}`);
      }

      const credentials = JSON.parse(fs.readFileSync(this.credentialsFile, 'utf8'));
      
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    } catch (error) {
      throw new Error(`Erreur d'initialisation Google Sheets: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'properties.title,sheets.properties'
      });
      
      return {
        success: true,
        spreadsheet: {
          title: response.data.properties.title,
          sheets: response.data.sheets.map(sheet => ({
            title: sheet.properties.title,
            sheetId: sheet.properties.sheetId
          }))
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getSheetData(range = 'A:L') {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range
      });
      
      return response.data.values || [];
    } catch (error) {
      throw new Error(`Erreur lors de la lecture des données: ${error.message}`);
    }
  }

  async appendRow(data) {
    try {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: 'A:H',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [data]
        }
      });
      
      return {
        success: true,
        updatedRange: response.data.updates?.updatedRange,
        updatedRows: response.data.updates?.updatedRows
      };
    } catch (error) {
      throw new Error(`Erreur lors de l'ajout de la ligne: ${error.message}`);
    }
  }

  async updateRow(rowIndex, data) {
    try {
      const range = `A${rowIndex}:L${rowIndex}`;
      
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [data]
        }
      });
      
      return {
        success: true,
        updatedRange: response.data.updatedRange,
        updatedRows: response.data.updatedRows
      };
    } catch (error) {
      throw new Error(`Erreur lors de la mise à jour de la ligne ${rowIndex}: ${error.message}`);
    }
  }

  async findOrderRow(orderNumber) {
    try {
      const data = await this.getSheetData();
      
      // Rechercher la colonne "Numéro de commande" (colonne D, index 3)
      const orderColumnIndex = 3;
      
      for (let i = 1; i < data.length; i++) { // Commencer à l'index 1 pour ignorer l'en-tête
        const row = data[i];
        if (row && row[orderColumnIndex] === orderNumber) {
          return {
            found: true,
            rowIndex: i + 1, // +1 car les index de Google Sheets commencent à 1
            rowData: row
          };
        }
      }
      
      return { found: false };
    } catch (error) {
      throw new Error(`Erreur lors de la recherche de la commande: ${error.message}`);
    }
  }

  async findRowsByName(customerName) {
    try {
      const data = await this.getSheetData();
      const nameColumnIndex = 3; // Colonne D: Name
      
      const matchingRows = [];
      
      for (let i = 1; i < data.length; i++) { // Commencer à l'index 1 pour ignorer l'en-tête
        const row = data[i];
        if (row && row[nameColumnIndex] && row[nameColumnIndex].toLowerCase().trim() === customerName.toLowerCase().trim()) {
          matchingRows.push({
            rowIndex: i + 1, // +1 car les index de Google Sheets commencent à 1
            rowData: row,
            orderNumber: row[6] || '', // Colonne G: Numéro de commande
            orderDate: row[6] ? this.extractOrderDate(row[6]) : null // Extraire la date du numéro de commande si possible
          });
        }
      }
      
      // Trier par numéro de commande (chronologique)
      matchingRows.sort((a, b) => {
        if (a.orderDate && b.orderDate) {
          return a.orderDate - b.orderDate;
        }
        // Fallback: trier par numéro de commande
        return (a.orderNumber || '').localeCompare(b.orderNumber || '');
      });
      
      return matchingRows;
    } catch (error) {
      throw new Error(`Erreur lors de la recherche par nom: ${error.message}`);
    }
  }

  extractOrderDate(orderNumber) {
    // Essayer d'extraire une date du numéro de commande
    // Format attendu: #TCO12345 (les numéros plus élevés = plus récents)
    const match = orderNumber.match(/#TCO(\d+)/);
    if (match) {
      return parseInt(match[1]);
    }
    
    // Fallback pour d'autres formats de numéros de commande
    const numberMatch = orderNumber.match(/(\d+)/);
    if (numberMatch) {
      return parseInt(numberMatch[1]);
    }
    
    return null;
  }

  async analyzeCustomerOrders(customerName) {
    try {
      const existingOrders = await this.findRowsByName(customerName);
      
      const analysis = {
        customerName,
        totalOrders: existingOrders.length,
        orders: existingOrders.map(order => ({
          rowIndex: order.rowIndex,
          orderNumber: order.orderNumber,
          orderDate: order.orderDate,
          hasTracking: order.rowData[4] && order.rowData[4].trim() !== '', // Colonne E: Suivi de commande
          hasItems: order.rowData[7] && order.rowData[7].trim() !== '' // Colonne H: ITEMS GIFT
        })),
        chronologicalOrder: existingOrders.length > 1 ? 'sorted' : 'single'
      };
      
      return analysis;
    } catch (error) {
      throw new Error(`Erreur lors de l'analyse des commandes client: ${error.message}`);
    }
  }

  async getNextAvailableRowForCustomer(customerName) {
    try {
      const existingRows = await this.findRowsByName(customerName);
      
      if (existingRows.length === 0) {
        // Aucune commande existante pour ce client, ajouter à la fin
        const data = await this.getSheetData();
        return data.length + 1; // Prochaine ligne disponible
      }
      
      // Trouver la position où insérer la nouvelle commande
      // Les commandes existantes sont triées chronologiquement
      // La nouvelle commande doit être insérée à la bonne position chronologique
      
      const data = await this.getSheetData();
      const lastExistingRow = existingRows[existingRows.length - 1];
      
      // Si c'est la dernière commande chronologiquement, l'ajouter après la dernière ligne existante
      return lastExistingRow.rowIndex + 1;
    } catch (error) {
      throw new Error(`Erreur lors de la recherche de position: ${error.message}`);
    }
  }

  async updateRow(rowIndex, rowData) {
    try {
      await this.auth();
      
      const request = {
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!${rowIndex}:${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [rowData]
        }
      };
      
      await this.sheets.spreadsheets.values.update(request);
      console.log(`✅ Ligne ${rowIndex} mise à jour avec succès`);
    } catch (error) {
      throw new Error(`Erreur lors de la mise à jour de la ligne: ${error.message}`);
    }
  }

  async insertRowAtPosition(rowIndex, data) {
    try {
      // Insérer une ligne vide à la position spécifiée
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          requests: [{
            insertDimension: {
              range: {
                sheetId: 0, // Supposer la première feuille
                dimension: 'ROWS',
                startIndex: rowIndex - 1, // -1 car l'API utilise des index 0-based
                endIndex: rowIndex
              },
              inheritFromBefore: false
            }
          }]
        }
      });
      
      // Maintenant mettre à jour la ligne avec les données
      const result = await this.updateRow(rowIndex, data);
      
      return {
        success: true,
        action: 'inserted',
        rowIndex: rowIndex,
        ...result
      };
    } catch (error) {
      throw new Error(`Erreur lors de l'insertion à la position ${rowIndex}: ${error.message}`);
    }
  }

  async syncOrderData(orderData) {
    try {
      const { name, orderNumber, trackingNumber, itemsGift } = orderData;
      
      // Format des données selon les colonnes du tableau
      const rowData = [
        name,                    // Colonne A: Name
        '',                      // Colonne B: Ig Link
        '',                      // Colonne C: Contenus
        orderNumber,             // Colonne D: Numéro de commande
        trackingNumber,          // Colonne E: Suivi de commande
        '',                      // Colonne F: Done (checkbox)
        '',                      // Colonne G: Tiktok Link
        itemsGift                // Colonne H: ITEMS GIFT
      ];

      // Vérifier si la commande existe déjà
      const existingOrder = await this.findOrderRow(orderNumber);
      
      if (existingOrder.found) {
        // Mettre à jour la ligne existante
        const result = await this.updateRow(existingOrder.rowIndex, rowData);
        return {
          success: true,
          action: 'updated',
          rowIndex: existingOrder.rowIndex,
          orderNumber,
          customerName: name,
          ...result
        };
      } else {
        // Nouvelle commande - déterminer la position chronologique
        const existingCustomerOrders = await this.findRowsByName(name);
        const currentOrderDate = this.extractOrderDate(orderNumber);
        
        if (existingCustomerOrders.length === 0) {
          // Premier client, ajouter à la fin
          const result = await this.appendRow(rowData);
          return {
            success: true,
            action: 'created',
            rowIndex: result.updatedRange ? this.extractRowFromRange(result.updatedRange) : null,
            orderNumber,
            customerName: name,
            ...result
          };
        } else {
          // Client existant - insérer à la bonne position chronologique
          let insertPosition = null;
          
          // Trouver la position chronologique correcte
          for (let i = 0; i < existingCustomerOrders.length; i++) {
            const existingOrderDate = existingCustomerOrders[i].orderDate;
            
            if (currentOrderDate && existingOrderDate && currentOrderDate <= existingOrderDate) {
              // Insérer avant cette commande
              insertPosition = existingCustomerOrders[i].rowIndex;
              break;
            }
          }
          
          if (insertPosition) {
            // Insérer à la position chronologique
            const result = await this.insertRowAtPosition(insertPosition, rowData);
            return {
              success: true,
              action: 'inserted_chronological',
              rowIndex: insertPosition,
              orderNumber,
              customerName: name,
              ...result
            };
          } else {
            // Ajouter après la dernière commande du client (plus récent)
            const lastCustomerRow = existingCustomerOrders[existingCustomerOrders.length - 1];
            const result = await this.insertRowAtPosition(lastCustomerRow.rowIndex + 1, rowData);
            return {
              success: true,
              action: 'inserted_after_last',
              rowIndex: lastCustomerRow.rowIndex + 1,
              orderNumber,
              customerName: name,
              ...result
            };
          }
        }
      }
    } catch (error) {
      throw new Error(`Erreur lors de la synchronisation: ${error.message}`);
    }
  }

  extractRowFromRange(range) {
    // Extraire le numéro de ligne d'une plage comme "A5:H5"
    const match = range.match(/A(\d+):/);
    return match ? parseInt(match[1]) : null;
  }

  async getHeaders() {
    try {
      const data = await this.getSheetData('A1:H1');
      return data[0] || [];
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des en-têtes: ${error.message}`);
    }
  }

  async validateSheetStructure() {
    try {
      const headers = await this.getHeaders();
      const expectedHeaders = [
        'Name',
        'Ig Link',
        'Contenus',
        'Numéro de commande',
        'Suivi de commande',
        'Done',
        'Tiktok Link',
        'ITEMS GIFT'
      ];
      
      const isValid = expectedHeaders.every((expected, index) => {
        return headers[index] === expected;
      });
      
      return {
        isValid,
        headers,
        expectedHeaders,
        message: isValid ? 'Structure du tableau valide' : 'Structure du tableau non conforme'
      };
    } catch (error) {
      return {
        isValid: false,
        error: error.message
      };
    }
  }
}

module.exports = new GoogleSheetsService();
}
