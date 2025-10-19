const { google } = require('googleapis');

class GoogleSheetsServiceRailway {
  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    this.credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
    
    if (!this.spreadsheetId || !this.credentialsJson) {
      throw new Error('Configuration Google Sheets manquante pour Railway. Vérifiez GOOGLE_SHEETS_SPREADSHEET_ID et GOOGLE_SHEETS_CREDENTIALS');
    }
    
    this.auth = null;
    this.sheets = null;
    this.initAuth();
  }

  initAuth() {
    try {
      const credentials = JSON.parse(this.credentialsJson);
      
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
    } catch (error) {
      throw new Error(`Erreur d'initialisation Google Sheets Railway: ${error.message}`);
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
        valueInputOption: 'RAW',
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
      
      const orderColumnIndex = 3;
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row && row[orderColumnIndex] === orderNumber) {
          return {
            found: true,
            rowIndex: i + 1,
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
      const nameColumnIndex = 0;
      
      const matchingRows = [];
      
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row && row[nameColumnIndex] && row[nameColumnIndex].toLowerCase().trim() === customerName.toLowerCase().trim()) {
          matchingRows.push({
            rowIndex: i + 1,
            rowData: row,
            orderNumber: row[3] || '',
            orderDate: row[3] ? this.extractOrderDate(row[3]) : null
          });
        }
      }
      
      matchingRows.sort((a, b) => {
        if (a.orderDate && b.orderDate) {
          return a.orderDate - b.orderDate;
        }
        return (a.orderNumber || '').localeCompare(b.orderNumber || '');
      });
      
      return matchingRows;
    } catch (error) {
      throw new Error(`Erreur lors de la recherche par nom: ${error.message}`);
    }
  }

  extractOrderDate(orderNumber) {
    const match = orderNumber.match(/#TCO(\d+)/);
    if (match) {
      return parseInt(match[1]);
    }
    
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
          hasTracking: order.rowData[4] && order.rowData[4].trim() !== '',
          hasItems: order.rowData[7] && order.rowData[7].trim() !== ''
        })),
        chronologicalOrder: existingOrders.length > 1 ? 'sorted' : 'single'
      };
      
      return analysis;
    } catch (error) {
      throw new Error(`Erreur lors de l'analyse des commandes client: ${error.message}`);
    }
  }

  async insertRowAtPosition(rowIndex, data) {
    try {
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        resource: {
          requests: [{
            insertDimension: {
              range: {
                sheetId: 0,
                dimension: 'ROWS',
                startIndex: rowIndex - 1,
                endIndex: rowIndex
              },
              inheritFromBefore: false
            }
          }]
        }
      });
      
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
      
      const rowData = [
        name,
        '',
        '',
        orderNumber,
        trackingNumber,
        '',
        '',
        itemsGift
      ];

      const existingOrder = await this.findOrderRow(orderNumber);
      
      if (existingOrder.found) {
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
        const existingCustomerOrders = await this.findRowsByName(name);
        const currentOrderDate = this.extractOrderDate(orderNumber);
        
        if (existingCustomerOrders.length === 0) {
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
          let insertPosition = null;
          
          for (let i = 0; i < existingCustomerOrders.length; i++) {
            const existingOrderDate = existingCustomerOrders[i].orderDate;
            
            if (currentOrderDate && existingOrderDate && currentOrderDate <= existingOrderDate) {
              insertPosition = existingCustomerOrders[i].rowIndex;
              break;
            }
          }
          
          if (insertPosition) {
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

module.exports = new GoogleSheetsServiceRailway();
