# 🚀 Déploiement Railway - Guide Rapide

## ⚡ Déploiement en 5 minutes

### 1. Préparer les credentials

#### Google Sheets API
1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un Service Account et télécharger le JSON
3. Partager votre tableau Google Sheets avec l'email du Service Account

#### Shopify API
1. Admin Shopify > Apps > Develop apps
2. Créer une app privée avec permissions : `read_orders`, `read_customers`, `read_products`
3. Installer et copier le token d'accès

### 2. Déployer sur Railway

```bash
# Installer Railway CLI
npm install -g @railway/cli

# Se connecter
railway login

# Déployer
railway up
```

### 3. Configurer les variables

Dans Railway Dashboard > Variables, ajouter :

```bash
SHOPIFY_SHOP_DOMAIN=votre-boutique.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxx
GOOGLE_SHEETS_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}
NODE_ENV=production
```

### 4. Configurer les webhooks Shopify

1. Admin Shopify > Settings > Notifications
2. Créer webhook "Order creation"
3. URL : `https://votre-app.up.railway.app/api/webhook/order-created`
4. Format : JSON

## ✅ Test

```bash
# Remplacer par votre URL Railway
curl https://votre-app.up.railway.app/api/test-connection
```

## 🎉 C'est tout !

Votre application fonctionne maintenant 24/7 et synchronise automatiquement toutes les nouvelles commandes Shopify vers Google Sheets !

## 📞 Support

- **Guide complet** : [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Railway Docs** : [docs.railway.app](https://docs.railway.app)
- **Logs** : `railway logs`
