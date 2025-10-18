# Shopify Google Sheets Sync

Application Node.js pour synchroniser automatiquement les commandes Shopify vers un tableau Google Sheets.

## 🚀 Fonctionnalités

- **Synchronisation automatique** des commandes Shopify vers Google Sheets
- **Gestion chronologique intelligente** des commandes multiples par client
- **Mapping intelligent** des articles selon une notation spécifique
- **Support pour la mise à jour** des commandes existantes
- **API REST complète** pour la gestion des synchronisations
- **Validation de la structure** du tableau Google Sheets
- **Gestion d'erreurs robuste** avec retry automatique
- **Insertion chronologique** : les nouvelles commandes sont placées au bon endroit temporel

## 📊 Colonnes synchronisées

| Colonne Google Sheets | Source Shopify API | Description |
|----------------------|-------------------|-------------|
| Name | shipping_address.first_name + last_name | Nom de livraison |
| Numéro de commande | order.name | Numéro de commande |
| Suivi de commande | fulfillment.tracking_number | Numéro de suivi |
| ITEMS GIFT | line_items (mappé) | Articles avec notation simplifiée |

## 🎯 Notation des articles

L'application mappe automatiquement les articles Shopify vers une notation simplifiée :

| Produit Shopify | Notation Google Sheets |
|----------------|----------------------|
| Pack 3 débardeurs blancs | 1 DB BLANC |
| Pack 3 débardeurs noirs | 1 DB NOIR |
| Pack 2 thermals gaufrés blancs | 1 TH BLANC |
| Pack 2 thermals gaufrés noirs | 1 TH NOIR |

## ⏰ Gestion chronologique

L'application gère intelligemment les commandes multiples pour un même client :

- **Recherche automatique** : L'application vérifie si un client a déjà des commandes
- **Tri chronologique** : Les commandes sont triées par numéro de commande (plus récentes en bas)
- **Insertion intelligente** : Les nouvelles commandes sont insérées à la bonne position chronologique
- **Préservation de l'ordre** : L'ordre chronologique est maintenu même avec des insertions

### Exemple de gestion chronologique

Si "Franck Cathus" a déjà les commandes :
- Ligne 5: #TCO10842 (ancienne)
- Ligne 8: #TCO11834 (récente)

Et qu'une nouvelle commande #TCO12000 arrive :
- Elle sera insérée à la ligne 9 (après la plus récente)
- L'ordre chronologique sera préservé

## 🛠️ Installation

### Option 1 : Installation locale

1. **Cloner le projet**
   ```bash
   git clone <repository-url>
   cd shopify-google-sheets-sync
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```


3. **Configuration Google Sheets API**
   - Aller sur [Google Cloud Console](https://console.cloud.google.com/)
   - Créer un nouveau projet ou sélectionner un projet existant
   - Activer l'API Google Sheets
   - Créer des identifiants de service (Service Account)
   - Télécharger le fichier JSON des identifiants
   - **Placer le fichier dans le dossier du projet et le renommer `credentials.json`**

4. **Configuration du tableau Google Sheets**
   - Créer un nouveau tableau Google Sheets
   - Configurer les en-têtes dans la première ligne :
     ```
     Name | Ig Link | Contenus | Numéro de commande | Suivi de commande | Done | Tiktok Link | ITEMS GIFT
     ```
   - Partager le tableau avec l'adresse email du Service Account (trouvée dans credentials.json)

5. **Configuration des variables d'environnement**
   ```bash
   cp env.example .env
   ```
   
   Éditer le fichier `.env` :
   ```env
   # Shopify Configuration
   SHOPIFY_SHOP_DOMAIN=your-shop.myshopify.com
   SHOPIFY_ACCESS_TOKEN=your-access-token
   
   # Google Sheets Configuration
   GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id
   
   # Application Configuration
   PORT=3000
   NODE_ENV=development
   ```

## 🔑 Configuration Shopify

### Créer une application privée Shopify

1. Aller dans l'admin Shopify de votre boutique
2. Aller dans **Apps** > **Develop apps**
3. Cliquer sur **Create an app**
4. Donner un nom à l'application (ex: "Google Sheets Sync")
5. Dans **Configuration**, activer les permissions suivantes :
   - `read_orders`
   - `read_customers`
   - `read_products`
6. Installer l'application et copier l'**Admin API access token**

### Obtenir le Spreadsheet ID Google Sheets

1. Ouvrir votre tableau Google Sheets
2. L'URL ressemble à : `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
3. Copier la partie `SPREADSHEET_ID`

## 🚀 Utilisation

### Démarrer l'application

```bash
# Mode développement
npm run dev

# Mode production
npm start
```

L'API sera disponible sur `http://localhost:3000`

### Scripts de test disponibles

```bash
# Tester la connexion aux APIs
npm run test-connection

# Tester la logique chronologique
npm run test-chronological
```

### Endpoints disponibles

#### Test de connexion
```bash
GET /api/test-connection
```

#### Récupérer les commandes
```bash
GET /api/orders?limit=10&status=any
```

#### Synchroniser les commandes
```bash
# Synchroniser les 10 dernières commandes
POST /api/sync-orders
{
  "limit": 10
}

# Synchroniser des commandes spécifiques
POST /api/sync-orders
{
  "orderIds": ["#TCO10842", "#TCO10867"]
}
```

#### Analyser les commandes d'un client
```bash
GET /api/analyze-customer/Franck%20Cathus
```

### Exemples d'utilisation avec curl

```bash
# Test de connexion
curl http://localhost:3000/api/test-connection

# Récupérer les commandes
curl http://localhost:3000/api/orders?limit=5

# Synchroniser les commandes
curl -X POST http://localhost:3000/api/sync-orders \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'

# Analyser les commandes d'un client
curl http://localhost:3000/api/analyze-customer/Franck%20Cathus
```

## 🔄 Synchronisation automatique

L'application supporte la synchronisation automatique via webhooks Shopify :

### Configuration des webhooks

1. **Dans l'admin Shopify** :
   - Aller dans **Settings** > **Notifications**
   - Créer un webhook pour **Order creation**
   - URL : `https://votre-app-railway.up.railway.app/api/webhook/order-created`
   - Format : **JSON**

2. **Webhooks disponibles** :
   - `POST /api/webhook/order-created` : Nouvelles commandes
   - `POST /api/webhook/order-updated` : Mises à jour de commandes

### Avantages de la synchronisation automatique

- ✅ **Temps réel** : Synchronisation immédiate des nouvelles commandes
- ✅ **Chronologique** : Insertion automatique à la bonne position
- ✅ **Fiable** : Retry automatique en cas d'erreur
- ✅ **24/7** : Fonctionne en continu sur Railway

## 📝 Logs et monitoring

L'application génère des logs détaillés pour :
- Les connexions aux APIs
- Les synchronisations de commandes
- Les webhooks reçus
- Les erreurs et exceptions
- Les statistiques de synchronisation

## 🔧 Développement

### Structure du projet

```
├── server.js                 # Point d'entrée principal
├── services/
│   ├── shopifyService.js     # Service d'intégration Shopify
│   ├── googleSheetsService.js # Service d'intégration Google Sheets
│   └── orderSyncService.js   # Service de synchronisation
├── package.json
├── env.example
└── README.md
```

### Ajouter de nouveaux types d'articles

Pour ajouter de nouveaux types d'articles, modifier la méthode `formatItemsGift` dans `shopifyService.js` :

```javascript
// Ajouter un nouveau mapping
if (productTitle.includes('nouveau-produit')) {
  itemCode = 'NP'; // Nouveau Produit
  if (productTitle.includes('blanc')) {
    color = 'BLANC';
  }
}
```

## 🐛 Dépannage

### Erreurs communes

1. **"Configuration Shopify manquante"**
   - Vérifier les variables `SHOPIFY_SHOP_DOMAIN` et `SHOPIFY_ACCESS_TOKEN`

2. **"Fichier de credentials Google non trouvé"**
   - Vérifier que le fichier `credentials.json` existe
   - Vérifier la variable `GOOGLE_SHEETS_CREDENTIALS_FILE`

3. **"Structure du tableau invalide"**
   - Vérifier que les en-têtes du tableau correspondent exactement
   - Vérifier que le tableau est partagé avec le Service Account

4. **"Erreur 429 Too Many Requests"**
   - L'application gère automatiquement les erreurs 429 avec retry
   - Attendre quelques minutes avant de relancer

## 📄 Licence

MIT

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.
