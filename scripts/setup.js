#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function setup() {
  console.log('🚀 Configuration de l\'application Shopify Google Sheets Sync\n');
  
  const envPath = path.join(__dirname, '..', '.env');
  
  // Vérifier si .env existe déjà
  if (fs.existsSync(envPath)) {
    const overwrite = await question('Le fichier .env existe déjà. Voulez-vous le remplacer ? (y/N): ');
    if (overwrite.toLowerCase() !== 'y' && overwrite.toLowerCase() !== 'yes') {
      console.log('Configuration annulée.');
      rl.close();
      return;
    }
  }
  
  console.log('📝 Configuration des variables d\'environnement:\n');
  
  // Configuration Shopify
  console.log('🔧 Configuration Shopify:');
  const shopDomain = await question('Domaine de votre boutique Shopify (ex: mon-shop.myshopify.com): ');
  const accessToken = await question('Token d\'accès Admin API Shopify: ');
  
  // Configuration Google Sheets
  console.log('\n📊 Configuration Google Sheets:');
  const credentialsFile = await question('Chemin vers le fichier credentials.json (défaut: ./credentials.json): ') || './credentials.json';
  const spreadsheetId = await question('ID du tableau Google Sheets: ');
  
  // Configuration application
  console.log('\n⚙️ Configuration de l\'application:');
  const port = await question('Port de l\'application (défaut: 3000): ') || '3000';
  const nodeEnv = await question('Environnement (défaut: development): ') || 'development';
  
  // Créer le fichier .env
  const envContent = `# Shopify Configuration
SHOPIFY_SHOP_DOMAIN=${shopDomain}
SHOPIFY_ACCESS_TOKEN=${accessToken}

# Google Sheets Configuration
GOOGLE_SHEETS_CREDENTIALS_FILE=${credentialsFile}
GOOGLE_SHEETS_SPREADSHEET_ID=${spreadsheetId}

# Application Configuration
PORT=${port}
NODE_ENV=${nodeEnv}
`;
  
  try {
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ Fichier .env créé avec succès!');
    
    // Vérifier la structure du tableau Google Sheets
    console.log('\n📋 Vérification de la structure du tableau Google Sheets...');
    console.log('Assurez-vous que votre tableau a les en-têtes suivants dans la première ligne:');
    console.log('Name | Ig Link | Contenus | Numéro de commande | Suivi de commande | Done | Tiktok Link | ITEMS GIFT');
    
    console.log('\n🎉 Configuration terminée!');
    console.log('\nProchaines étapes:');
    console.log('1. Vérifiez que le fichier credentials.json est présent');
    console.log('2. Partagez votre tableau Google Sheets avec l\'email du Service Account');
    console.log('3. Lancez l\'application avec: npm start');
    console.log('4. Testez la connexion avec: curl http://localhost:' + port + '/api/test-connection');
    
  } catch (error) {
    console.error('❌ Erreur lors de la création du fichier .env:', error.message);
  }
  
  rl.close();
}

// Gérer l'interruption
process.on('SIGINT', () => {
  console.log('\n\nConfiguration annulée.');
  rl.close();
  process.exit(0);
});

setup().catch(console.error);
