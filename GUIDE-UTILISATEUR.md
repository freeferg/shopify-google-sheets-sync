# 📝 Guide Utilisateur - Shopify Google Sheets Sync

## 🎯 Comment ça marche ?

L'application surveille automatiquement votre Google Sheets et remplit les informations Shopify quand vous ajoutez un nom.

### ✅ Processus simple en 3 étapes :

1. **Ajoutez le NOM** dans Google Sheets (colonne D)
2. **Attendez 30 secondes** (l'application surveille le fichier)
3. **Les informations sont remplies automatiquement** :
   - Numéro de commande (colonne G)
   - Numéro de suivi avec lien cliquable (colonne H)
   - Items gift formatés (colonne L)

---

## 📋 Colonnes Google Sheets

| Colonne | Nom | Description |
|---------|-----|-------------|
| **D** | Name | **À REMPLIR MANUELLEMENT** - Nom du client (shipping/customer/billing) |
| **G** | Numéro de commande | Rempli automatiquement (#TCOxxxxx) |
| **H** | Suivi de commande | Rempli automatiquement (avec lien cliquable) |
| **L** | ITEMS GIFT | Rempli automatiquement (format: "1 DB BLANC + 2 TH NOIR") |

---

## ⚠️ IMPORTANT - Correspondance EXACTE uniquement

L'application cherche une **correspondance EXACTE** du nom dans Shopify :

### ✅ Exemples qui fonctionnent :
- Vous entrez : `Lindsay Lohan`
- Shopify a : `Lindsay Lohan` (shipping name) ✅

### ❌ Exemples qui NE fonctionnent PAS :
- Vous entrez : `Lindsay Lohan`
- Shopify a : `Lohan Hinsinger` ❌ (pas de match exact)

### 🔍 Ordre de recherche :
1. **Nom client** (customer name)
2. **Nom d'expédition** (shipping name)
3. **Nom de facturation** (billing name)

---

## 🕒 Délai de traitement

- L'application surveille Google Sheets **toutes les 30 secondes**
- Maximum **1 minute** pour voir les informations apparaître
- Si rien n'apparaît après 2 minutes, vérifiez les logs Railway

---

## 🐛 Dépannage

### Problème : Les informations ne se remplissent pas

**Vérifications** :
1. Le nom est-il bien dans la colonne **D** ?
2. Y a-t-il des espaces en trop avant/après le nom ?
3. Le nom correspond-il EXACTEMENT à un nom dans Shopify ?

**Solution** :
- Consultez les logs Railway pour voir les détails
- Endpoint de test : `https://votre-app.up.railway.app/api/test-search/Nom%20Client`

### Problème : Mauvaise commande trouvée

**Cause** : Le nom correspond à plusieurs commandes dans Shopify

**Solution** :
- Vérifiez que le nom est **exactement** le même que dans Shopify
- L'application prendra la commande avec le meilleur match (customer → shipping → billing)

---

## 🔗 Liens utiles

- **Application** : https://shopify-google-sheets-sync-production.up.railway.app
- **Statut de surveillance** : https://shopify-google-sheets-sync-production.up.railway.app/api/watching-status
- **Test de recherche** : https://shopify-google-sheets-sync-production.up.railway.app/api/test-search/NomClient

---

## ⚙️ Commandes avancées

### Retraiter toutes les lignes
```bash
POST /api/update-all-rows-with-orders
```
Retraite toutes les lignes qui ont un nom mais des informations manquantes.

### Forcer le retraitement
```bash
POST /api/force-reprocess
```
Redémarre la surveillance et efface l'historique des lignes traitées.

---

## 📞 Support

Pour toute question ou problème :
1. Consultez les logs Railway
2. Utilisez l'endpoint de test pour vérifier les correspondances
3. Vérifiez que le nom est EXACTEMENT le même que dans Shopify

---

**Version : 2.0.0**  
**Mode : Manual Entry - Auto Fill**  
**Webhooks : Désactivés**

