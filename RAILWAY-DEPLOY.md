# 🚀 Déploiement Railway - Guide Simplifié

## 📋 Prérequis

1. **Compte Railway** : [railway.app](https://railway.app)
2. **Repository GitHub** : Votre code doit être sur GitHub
3. **Credentials Google Sheets** : Fichier JSON du Service Account

## 🔧 Étape 1 : Préparer les credentials

### Google Sheets API
1. **Google Cloud Console** → Créer Service Account
2. **Télécharger le JSON** des credentials
3. **Partager votre tableau** avec l'email du Service Account

### Shopify API
1. **Admin Shopify** → Apps → Develop apps
2. **Créer une app privée** avec permissions : `read_orders`, `read_customers`, `read_products`
3. **Installer et copier le token**

## 🚂 Étape 2 : Déployer sur Railway

### Option 1 : Via Railway Dashboard (Recommandé)

1. **Aller sur [railway.app](https://railway.app)**
2. **"New Project" > "Deploy from GitHub repo"**
3. **Sélectionner votre repository** : `freeferg/shopify-google-sheets-sync`
4. **Railway détectera automatiquement Node.js**

### Option 2 : Via Railway CLI

```bash
# Installer Railway CLI
npm install -g @railway/cli

# Se connecter
railway login

# Déployer
railway up
```

## ⚙️ Étape 3 : Configurer les variables d'environnement

Dans Railway Dashboard > Variables, ajouter :

```bash
# Shopify
SHOPIFY_SHOP_DOMAIN=votre-boutique.myshopify.com
SHOPIFY_ACCESS_TOKEN=votre-token-shopify

# Google Sheets
GOOGLE_SHEETS_SPREADSHEET_ID=votre-spreadsheet-id
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}

# Application
NODE_ENV=production
```

### 📝 Pour GOOGLE_SHEETS_CREDENTIALS

1. **Ouvrir le fichier JSON** téléchargé depuis Google Cloud Console
2. **Copier tout le contenu** (c'est long, avec des clés cryptées)
3. **Coller dans Railway** comme valeur de la variable `GOOGLE_SHEETS_CREDENTIALS`

## 🔄 Étape 4 : Configurer les webhooks Shopify

1. **Admin Shopify** → Settings → Notifications
2. **Créer webhook** "Order creation"
3. **URL** : `https://votre-app.up.railway.app/api/webhook/order-created`
4. **Format** : JSON

## ✅ Étape 5 : Tester

```bash
# Remplacer par votre URL Railway
curl https://votre-app.up.railway.app/api/test-connection
```

## 🎉 C'est tout !

Votre application fonctionne maintenant 24/7 sur Railway et synchronise automatiquement toutes les nouvelles commandes Shopify vers Google Sheets !

## 📞 Support

- **Railway Docs** : [docs.railway.app](https://docs.railway.app)
- **Logs** : Railway Dashboard > Deployments > Voir les logs
