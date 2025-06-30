// index.js (Atualizado)
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const routes = require('./routes/routes');
const connectToDb = require('./db/ConnectToDb'); 
const QRCode = require('qrcode');
const cron = require('node-cron');
const app = express();
const PlanController = require('./controllers/PlanController'); // Garanta que isso seja importado corretamente
const OrderController = require('./controllers/OrderController'); // Novo: Importar OrderController

connectToDb();

app.use(cors());
app.use(bodyParser.json());
app.use(express.json({
  limit: '50mb'        // aumenta o teto de 100kb (default) para 50MB
}));
app.use('/api', routes);

// Job cron para verificar planos expirados diariamente à meia-noite
cron.schedule('0 0 * * *', () => {
    console.log('Executando verificação de planos expirados...');
    PlanController.verificarPlanosExpirados();
});

const port = process.env.PORT || 3000; 

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});