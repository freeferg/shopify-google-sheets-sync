#!/bin/bash

echo "🚀 Script de déploiement Railway - Shopify Google Sheets Sync"
echo "============================================================"

# Vérifier si Railway CLI est installé
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI n'est pas installé"
    echo "📦 Installation de Railway CLI..."
    npm install -g @railway/cli
fi

# Se connecter à Railway
echo "🔐 Connexion à Railway..."
railway login

# Initialiser le projet si nécessaire
if [ ! -f "railway.json" ]; then
    echo "📝 Initialisation du projet Railway..."
    railway init
fi

# Vérifier les variables d'environnement
echo "⚙️ Vérification des variables d'environnement..."

required_vars=("SHOPIFY_SHOP_DOMAIN" "SHOPIFY_ACCESS_TOKEN" "GOOGLE_SHEETS_SPREADSHEET_ID" "GOOGLE_SHEETS_CREDENTIALS")

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Variable manquante: $var"
        echo "📝 Veuillez définir cette variable dans Railway Dashboard"
        echo "   ou l'ajouter à votre fichier .env"
        exit 1
    else
        echo "✅ $var définie"
    fi
done

# Déployer sur Railway
echo "🚂 Déploiement sur Railway..."
railway up

# Attendre que le déploiement soit terminé
echo "⏳ Attente du déploiement..."
sleep 10

# Obtenir l'URL du déploiement
echo "🔗 Récupération de l'URL du déploiement..."
RAILWAY_URL=$(railway domain)

if [ -n "$RAILWAY_URL" ]; then
    echo "✅ Déploiement réussi!"
    echo "🌐 URL de l'application: https://$RAILWAY_URL"
    echo ""
    echo "🧪 Tests à effectuer:"
    echo "1. Test de connexion:"
    echo "   curl https://$RAILWAY_URL/api/test-connection"
    echo ""
    echo "2. Synchronisation de test:"
    echo "   curl -X POST https://$RAILWAY_URL/api/sync-orders \\"
    echo "     -H \"Content-Type: application/json\" \\"
    echo "     -d '{\"limit\": 1}'"
    echo ""
    echo "3. Webhook Shopify (URL à configurer):"
    echo "   https://$RAILWAY_URL/api/webhook/order-created"
    echo ""
    echo "📋 Configuration des webhooks Shopify:"
    echo "1. Aller dans l'admin Shopify > Settings > Notifications"
    echo "2. Créer un webhook pour 'Order creation'"
    echo "3. URL: https://$RAILWAY_URL/api/webhook/order-created"
    echo "4. Format: JSON"
else
    echo "❌ Erreur lors du déploiement"
    echo "📋 Vérifiez les logs avec: railway logs"
fi

echo ""
echo "🎉 Script terminé!"
echo "📊 Pour voir les logs en temps réel: railway logs"
echo "🔧 Pour gérer les variables: railway variables"
