# 🚀 Déploiement sur Railway - Guide Complet

Ce guide vous explique comment déployer l'application Shopify Google Sheets Sync sur Railway pour qu'elle fonctionne 24/7.

## 📋 Prérequis

1. **Compte Railway** : [railway.app](https://railway.app) (gratuit)
2. **Compte Google Cloud** : Pour l'API Google Sheets
3. **Boutique Shopify** : Avec accès admin
4. **GitHub/GitLab** : Pour héberger le code (optionnel mais recommandé)

## 🔧 Étape 1 : Préparation du code

### 1.1 Créer un repository Git (recommandé)

```bash
cd /Users/faouezbenradi/Downloads/tucorp

# Initialiser Git
git init

# Ajouter tous les fichiers
git add .

# Premier commit
git commit -m "Initial commit: Shopify Google Sheets Sync app"

# Créer un repository sur GitHub/GitLab et pousser
git remote add origin https://github.com/votre-username/shopify-google-sheets-sync.git
git branch -M main
git push -u origin main
```

### 1.2 Créer un fichier Railway spécifique

Créer `railway.json` :
```json
{
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### 1.3 Ajouter un script de santé

Ajouter dans `package.json` :
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "setup": "node scripts/setup.js",
    "test-connection": "node scripts/test-connection.js",
    "test-chronological": "node scripts/test-chronological.js",
    "healthcheck": "curl -f http://localhost:$PORT || exit 1",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

## 🌐 Étape 2 : Configuration Google Cloud Console

### 2.1 Créer un projet Google Cloud

1. Aller sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créer un nouveau projet ou sélectionner un existant
3. Activer l'API Google Sheets

### 2.2 Créer un Service Account

1. Aller dans **IAM & Admin** > **Service Accounts**
2. Cliquer sur **Create Service Account**
3. Donner un nom : `shopify-sheets-sync`
4. Description : `Service account pour la synchronisation Shopify Google Sheets`
5. Cliquer sur **Create and Continue**

### 2.3 Configurer les permissions

1. Dans **Grant this service account access to project**
2. Ajouter le rôle : **Editor** (ou créer un rôle personnalisé)
3. Cliquer sur **Continue** puis **Done**

### 2.4 Créer et télécharger la clé

1. Cliquer sur le Service Account créé
2. Aller dans l'onglet **Keys**
3. Cliquer sur **Add Key** > **Create new key**
4. Choisir **JSON** et cliquer **Create**
5. Le fichier JSON sera téléchargé automatiquement

### 2.5 Partager le tableau Google Sheets

1. Ouvrir votre tableau Google Sheets
2. Cliquer sur **Partager** (Share)
3. Ajouter l'email du Service Account (visible dans le fichier JSON téléchargé)
4. Donner les permissions **Editor**
5. Copier l'ID du tableau depuis l'URL

## 🛒 Étape 3 : Configuration Shopify

### 3.1 Créer une application privée

1. Aller dans l'admin Shopify de votre boutique
2. Aller dans **Apps** > **Develop apps**
3. Cliquer sur **Create an app**
4. Nom : `Google Sheets Sync`
5. Cliquer sur **Configure Admin API scopes**

### 3.2 Configurer les permissions

Activer ces permissions :
- `read_orders` : Lire les commandes
- `read_customers` : Lire les clients
- `read_products` : Lire les produits
- `read_fulfillments` : Lire les expéditions

### 3.3 Installer l'application

1. Cliquer sur **Install app**
2. Copier l'**Admin API access token**

## 🚂 Étape 4 : Déploiement sur Railway

### 4.1 Créer un compte Railway

1. Aller sur [railway.app](https://railway.app)
2. Cliquer sur **Start a New Project**
3. Se connecter avec GitHub (recommandé)

### 4.2 Créer un nouveau projet

1. Cliquer sur **New Project**
2. Choisir **Deploy from GitHub repo** (si vous avez poussé sur GitHub)
   OU **Empty Project** (si vous déployez directement)

### 4.3 Connecter le repository (si GitHub)

1. Sélectionner votre repository `shopify-google-sheets-sync`
2. Railway détectera automatiquement que c'est un projet Node.js
3. Cliquer sur **Deploy Now**

### 4.4 Configuration manuelle (si pas de GitHub)

1. Choisir **Empty Project**
2. Cliquer sur **Add Service** > **GitHub Repo**
3. Ou utiliser Railway CLI :

```bash
# Installer Railway CLI
npm install -g @railway/cli

# Se connecter
railway login

# Initialiser le projet
railway init

# Déployer
railway up
```

## ⚙️ Étape 5 : Configuration des variables d'environnement

### 5.1 Dans Railway Dashboard

1. Aller dans votre projet Railway
2. Cliquer sur votre service
3. Aller dans l'onglet **Variables**
4. Ajouter ces variables :

```
SHOPIFY_SHOP_DOMAIN=votre-boutique.myshopify.com
SHOPIFY_ACCESS_TOKEN=votre-token-shopify
GOOGLE_SHEETS_SPREADSHEET_ID=votre-spreadsheet-id
NODE_ENV=production
PORT=3000
```

### 5.2 Ajouter les credentials Google

1. Créer une nouvelle variable : `GOOGLE_SHEETS_CREDENTIALS`
2. Copier le contenu **complet** du fichier JSON téléchargé
3. Coller dans la valeur de la variable (tout sur une ligne)

### 5.3 Variables d'environnement complètes

```bash
# Shopify
SHOPIFY_SHOP_DOMAIN=mon-shop.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Google Sheets
GOOGLE_SHEETS_SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account","project_id":"mon-projet",...}

# Application
NODE_ENV=production
PORT=3000
```

## 🔧 Étape 6 : Modification du code pour Railway

### 6.1 Modifier le service Google Sheets

Créer `services/googleSheetsServiceRailway.js` :

```javascript
const { google } = require('googleapis');

class GoogleSheetsServiceRailway {
  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    this.credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
    
    if (!this.spreadsheetId || !this.credentialsJson) {
      throw new Error('Configuration Google Sheets manquante pour Railway');
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

  // ... (copier toutes les autres méthodes du service original)
}

module.exports = new GoogleSheetsServiceRailway();
```

### 6.2 Modifier le service principal

Modifier `services/googleSheetsService.js` :

```javascript
// Au début du fichier, ajouter :
const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production';

if (isRailway) {
  module.exports = require('./googleSheetsServiceRailway');
} else {
  // Code original...
}
```

## 🧪 Étape 7 : Tests et validation

### 7.1 Tester le déploiement

1. Aller dans Railway Dashboard
2. Cliquer sur votre service
3. Aller dans l'onglet **Deployments**
4. Attendre que le déploiement soit terminé (statut vert)
5. Cliquer sur le lien généré par Railway

### 7.2 Tester l'API

```bash
# Remplacer YOUR_RAILWAY_URL par votre URL Railway
curl https://YOUR_RAILWAY_URL/api/test-connection

# Tester la synchronisation
curl -X POST https://YOUR_RAILWAY_URL/api/sync-orders \
  -H "Content-Type: application/json" \
  -d '{"limit": 1}'
```

### 7.3 Vérifier les logs

1. Dans Railway Dashboard
2. Aller dans l'onglet **Deployments**
3. Cliquer sur le déploiement actuel
4. Voir les logs en temps réel

## ⏰ Étape 8 : Configuration de la synchronisation automatique

### 8.1 Option 1 : Webhook Shopify (Recommandé)

1. Dans l'admin Shopify
2. Aller dans **Settings** > **Notifications**
3. Créer un webhook pour les commandes :
   - Event: `Order creation`
   - Format: `JSON`
   - URL: `https://YOUR_RAILWAY_URL/api/webhook/order-created`

Ajouter dans `server.js` :

```javascript
// Webhook pour les nouvelles commandes
app.post('/api/webhook/order-created', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    const order = JSON.parse(req.body);
    
    // Synchroniser automatiquement
    const syncResult = await orderSyncService.syncOrdersToSheets([order]);
    
    console.log(`🔄 Commande ${order.name} synchronisée automatiquement`);
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Erreur webhook:', error);
    res.status(500).send('Error');
  }
});
```

### 8.2 Option 2 : Cron Job Railway

Créer `scripts/cron.js` :

```javascript
require('dotenv').config();
const axios = require('axios');

async function syncRecentOrders() {
  try {
    const response = await axios.post(`${process.env.RAILWAY_STATIC_URL}/api/sync-orders`, {
      limit: 5
    });
    
    console.log('✅ Synchronisation automatique réussie:', response.data);
  } catch (error) {
    console.error('❌ Erreur synchronisation automatique:', error.message);
  }
}

syncRecentOrders();
```

## 📊 Étape 9 : Monitoring et maintenance

### 9.1 Surveillance des logs

Railway fournit des logs en temps réel :
- Aller dans votre projet
- Cliquer sur votre service
- Onglet **Deployments** > Voir les logs

### 9.2 Surveillance des erreurs

L'application log automatiquement :
- Les connexions aux APIs
- Les synchronisations réussies/échouées
- Les erreurs de validation
- Les statistiques de performance

### 9.3 Redémarrage automatique

Railway redémarre automatiquement l'application en cas d'erreur grâce à la configuration dans `railway.json`.

## 💰 Coûts Railway

- **Plan gratuit** : $5 de crédit par mois (suffisant pour cette app)
- **Plan Hobby** : $5/mois pour usage illimité
- **Plan Pro** : $20/mois pour production avancée

## 🔧 Dépannage

### Problèmes courants

1. **Erreur de connexion Google Sheets**
   - Vérifier que le Service Account a accès au tableau
   - Vérifier le format JSON des credentials

2. **Erreur Shopify API**
   - Vérifier le token d'accès
   - Vérifier les permissions de l'application

3. **Application ne démarre pas**
   - Vérifier les logs Railway
   - Vérifier que toutes les variables d'environnement sont définies

4. **Synchronisation ne fonctionne pas**
   - Tester manuellement avec l'endpoint `/api/test-connection`
   - Vérifier les logs de synchronisation

## 📞 Support

- **Railway Docs** : [docs.railway.app](https://docs.railway.app)
- **Railway Discord** : [discord.gg/railway](https://discord.gg/railway)
- **Logs Railway** : Toujours disponibles dans le dashboard

## 🎉 Félicitations !

Votre application Shopify Google Sheets Sync est maintenant déployée sur Railway et fonctionne 24/7 ! 

L'application va automatiquement :
- ✅ Synchroniser les nouvelles commandes
- ✅ Maintenir l'ordre chronologique
- ✅ Gérer les erreurs automatiquement
- ✅ Redémarrer en cas de problème
