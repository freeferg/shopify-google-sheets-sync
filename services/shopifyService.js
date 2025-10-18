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

  async searchOrdersByCustomerName(customerName) {
    try {
      console.log(`🔍 Recherche des commandes pour le client: ${customerName}`);
      
      // Rechercher dans les commandes récentes (limite de 250)
      const data = await this.makeRequest('/orders.json?limit=250&status=any');
      const allOrders = data.orders || [];
      
      // Normaliser le nom recherché
      const searchName = customerName.toLowerCase().trim();
      
      // Filtrer les commandes par nom de client OU shipping name
      const matchingOrders = allOrders.filter(order => {
        // Récupérer le shipping name
        const shippingName = this.getShippingName(order).toLowerCase();
        
        // Récupérer le customer name (nom du compte client)
        let customerName = '';
        if (order.customer) {
          customerName = `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim().toLowerCase();
        }
        
        // Vérifier si l'un des deux noms correspond
        const shippingMatch = shippingName.includes(searchName) || searchName.includes(shippingName);
        const customerMatch = customerName && (customerName.includes(searchName) || searchName.includes(customerName));
        
        if (shippingMatch || customerMatch) {
          console.log(`  ✓ Match trouvé: shipping="${shippingName}", customer="${customerName}"`);
        }
        
        return shippingMatch || customerMatch;
      });
      
      // Trier par date de création (plus récentes en premier)
      matchingOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      console.log(`📊 ${matchingOrders.length} commandes trouvées pour ${searchName}`);
      
      return matchingOrders;
    } catch (error) {
      throw new Error(`Erreur lors de la recherche par nom: ${error.message}`);
    }
  }

  async getOrder(orderIdOrName) {
    try {
      // Si c'est un nom de commande (#TCOxxxxx), chercher dans toutes les commandes
      if (orderIdOrName.toString().startsWith('#')) {
        console.log(`🔍 Recherche de la commande par nom: ${orderIdOrName}`);
        const data = await this.makeRequest(`/orders.json?limit=250&status=any&name=${encodeURIComponent(orderIdOrName)}`);
        if (data.orders && data.orders.length > 0) {
          console.log(`✓ Commande ${orderIdOrName} trouvée`);
          return data.orders[0];
        }
        throw new Error(`Commande ${orderIdOrName} non trouvée`);
      }
      
      // Sinon, utiliser l'ID directement
      const data = await this.makeRequest(`/orders/${orderIdOrName}.json`);
      return data.order;
    } catch (error) {
      throw new Error(`Erreur lors de la récupération de la commande ${orderIdOrName}: ${error.message}`);
    }
  }

  hasRequiredDiscountCodes(order) {
    // Codes promo requis
    const requiredCodes = ['J4Y4TC0G1FT', 'J4Y4TC0SH1P'];
    
    // Vérifier si la commande a des discount codes
    if (!order.discount_codes || order.discount_codes.length === 0) {
      return false;
    }
    
    // Vérifier si au moins un des codes requis est présent
    const orderCodes = order.discount_codes.map(dc => dc.code.toUpperCase());
    const hasRequiredCode = requiredCodes.some(code => 
      orderCodes.includes(code.toUpperCase())
    );
    
    if (hasRequiredCode) {
      console.log(`✅ Commande ${order.name} a un code promo valide: ${orderCodes.join(', ')}`);
    } else {
      console.log(`❌ Commande ${order.name} n'a pas de code promo valide. Codes trouvés: ${orderCodes.join(', ')}`);
    }
    
    return hasRequiredCode;
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
        // Créer un lien cliquable vers le suivi
        const trackingUrl = fulfillment.tracking_url || this.generateTrackingUrl(fulfillment.tracking_number, fulfillment.tracking_company);
        return `=HYPERLINK("${trackingUrl}","${fulfillment.tracking_number}")`;
      }
    }
    
    return '';
  }

  generateTrackingUrl(trackingNumber, carrier = '') {
    // Générer l'URL de suivi selon le transporteur
    const carriers = {
      'ups': `https://www.ups.com/track?tracknum=${trackingNumber}`,
      'fedex': `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      'dhl': `https://www.dhl.com/track?trackingNumber=${trackingNumber}`,
      'colissimo': `https://www.laposte.fr/outils/suivre-vos-envois?code=${trackingNumber}`,
      'chronopost': `https://www.chronopost.fr/tracking-colis?listeNumerosLT=${trackingNumber}`,
      'dpd': `https://tracking.dpd.de/status/fr_FR/parcel/${trackingNumber}`,
      'gls': `https://gls-group.eu/FR/fr/suivi-colis?match=${trackingNumber}`,
      'mondial-relay': `https://www.mondialrelay.fr/suivi-de-colis/?NumeroExpedition=${trackingNumber}`
    };
    
    // Si le transporteur est connu, utiliser son URL
    if (carrier && carriers[carrier.toLowerCase()]) {
      return carriers[carrier.toLowerCase()];
    }
    
    // Sinon, essayer de détecter le transporteur par le format du numéro
    if (trackingNumber.match(/^1Z/)) return carriers.ups;
    if (trackingNumber.match(/^[0-9]{12,22}$/)) return carriers.fedex;
    if (trackingNumber.match(/^[0-9]{10}$/)) return carriers.colissimo;
    if (trackingNumber.match(/^[A-Z]{2}[0-9]{9}FR$/)) return carriers.chronopost;
    
    // Par défaut, utiliser un service de suivi générique
    return `https://www.aftership.com/track/${trackingNumber}`;
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
