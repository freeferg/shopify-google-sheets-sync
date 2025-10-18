const axios = require('axios');

class ShopifyService {
  constructor() {
    this.shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    this.baseURL = `https://${this.shopDomain}/admin/api/2023-10`;
    
    if (!this.shopDomain || !this.accessToken) {
      throw new Error('Configuration Shopify manquante. Vérifiez SHOPIFY_SHOP_DOMAIN et SHOPIFY_ACCESS_TOKEN');
    }
  }

  async makeRequest(endpoint, method = 'GET', data = null) {
    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        }
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Shopify API Error: ${error.response.status} - ${error.response.data?.message || error.message}`);
      }
      throw new Error(`Erreur de connexion Shopify: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      const data = await this.makeRequest('/shop.json');
      return {
        success: true,
        shop: {
          name: data.shop.name,
          domain: data.shop.domain,
          currency: data.shop.currency
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getOrders(limit = 10, status = 'any') {
    try {
      let endpoint = `/orders.json?limit=${limit}`;
      
      if (status !== 'any') {
        endpoint += `&status=${status}`;
      }

      const data = await this.makeRequest(endpoint);
      return data.orders || [];
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des commandes: ${error.message}`);
    }
  }

  async getOrdersByIds(orderIds) {
    try {
      const orders = [];
      
      for (const orderId of orderIds) {
        try {
          const data = await this.makeRequest(`/orders/${orderId}.json`);
          if (data.order) {
            orders.push(data.order);
          }
        } catch (error) {
          console.error(`Erreur lors de la récupération de la commande ${orderId}:`, error.message);
        }
      }
      
      return orders;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération des commandes par IDs: ${error.message}`);
    }
  }

  async getOrder(orderId) {
    try {
      const data = await this.makeRequest(`/orders/${orderId}.json`);
      return data.order;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération de la commande ${orderId}: ${error.message}`);
    }
  }

  // Méthode pour formater les données de commande selon les besoins de Google Sheets
  formatOrderForSheets(order) {
    const shippingName = this.getShippingName(order);
    const orderNumber = order.name || order.id.toString();
    const trackingNumber = this.getTrackingNumber(order);
    const itemsGift = this.formatItemsGift(order.line_items);

    return {
      name: shippingName,
      orderNumber: orderNumber,
      trackingNumber: trackingNumber,
      itemsGift: itemsGift,
      rawOrder: order // Garder les données brutes pour debug
    };
  }

  getShippingName(order) {
    if (order.shipping_address) {
      const address = order.shipping_address;
      return `${address.first_name || ''} ${address.last_name || ''}`.trim();
    }
    
    if (order.customer) {
      const customer = order.customer;
      return `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
    }
    
    return 'N/A';
  }

  getTrackingNumber(order) {
    if (order.fulfillments && order.fulfillments.length > 0) {
      const fulfillment = order.fulfillments[0];
      if (fulfillment.tracking_number) {
        return fulfillment.tracking_number;
      }
    }
    
    return '';
  }

  formatItemsGift(lineItems) {
    const itemMap = {};
    
    lineItems.forEach(item => {
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
      
      if (itemCode) {
        const key = `${itemCode} ${color}`.trim();
        itemMap[key] = (itemMap[key] || 0) + item.quantity;
      }
    });
    
    // Convertir en format de notation
    const items = Object.entries(itemMap)
      .filter(([key, quantity]) => quantity > 0)
      .map(([key, quantity]) => `${quantity} ${key}`)
      .join(' + ');
    
    return items || '';
  }
}

module.exports = new ShopifyService();
