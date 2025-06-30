// routes/routes.js (Atualizado)
const routes = require('express').Router();
const RegisterController = require('../controllers/RegisterController');
const LoginController = require('../controllers/LoginController');
const MenuItemController = require('../controllers/MenuItemController'); 
const PlanController = require('../controllers/PlanController');
const OrderController = require('../controllers/OrderController'); // Novo: Importar OrderController
const QRCode = require('qrcode');
const Chef = require('../models/Chef'); 
const MenuItem = require('../models/MenuItem'); // Garanta que MenuItem seja importado para itens de menu público
const Order = require('../models/Order'); // Garanta que Order seja importado

const checkSubscription = async (req, res, next) => {
  let chefId = req.params.chefId || req.body.chefId;

  // Para rotas como update/delete menuItem, onde chefId pode não estar diretamente nos params/body
  // Você pode precisar buscar o MenuItem primeiro para obter seu chefId associado
  if (!chefId && req.params.itemId) {
    try {
      const item = await MenuItem.findById(req.params.itemId);
      if (item) {
        chefId = item.chef;
      }
    } catch (error) {
      console.error('Erro ao buscar MenuItem para verificação de assinatura:', error);
      return res.status(500).json({ message: 'Erro do servidor durante a verificação de assinatura.', error: error.message });
    }
  }
  // Para rotas de pedido que podem precisar do chefId do próprio pedido
  if (!chefId && req.params.orderId) {
    try {
      const order = await Order.findById(req.params.orderId);
      if (order) {
        chefId = order.chefId;
      }
    } catch (error) {
      console.error('Erro ao buscar Pedido para verificação de assinatura:', error);
      return res.status(500).json({ message: 'Erro do servidor durante a verificação de assinatura.', error: error.message });
    }
  }


  if (!chefId) {
    return res.status(401).json({ message: 'Autenticação necessária: ID do Chef não fornecido.' });
  }

  try {
    const chef = await Chef.findById(chefId);
    if (!chef) {
      return res.status(404).json({ message: 'Chef não encontrado.' });
    }

    // Verifica se o plano está ativo e não expirou
    if (!chef.planoAtivo || (chef.dataExpiracaoPlano && chef.dataExpiracaoPlano < new Date())) {
   
      // Se o plano expirou, podemos opcionalmente desativá-lo aqui
      if (chef.planoAtivo && chef.dataExpiracaoPlano && chef.dataExpiracaoPlano < new Date()) {
        chef.planoAtivo = false;
        await chef.save();
      }
      return res.status(403).json({ message: 'Seu plano não está ativo ou expirou. Por favor, assine para ter acesso completo.' });
    }
    req.chef = chef; // Anexa o objeto chef à requisição para uso posterior
    next();
  } catch (error) {
    console.error('Erro no middleware checkSubscription:', error);
    res.status(500).json({ message: 'Erro do servidor durante a verificação de assinatura.', error: error.message });
  }
};

// Rotas de Autenticação
routes.post('/beAChef', RegisterController.registerChef);
routes.post('/loginChef', LoginController.loginChef);

// Webhook do Mercado Pago (Acessível sem assinatura)
routes.post('/mercadopago/webhook', PlanController.handleMercadoPagoWebhook);

// Rotas de Criação de Plano de Assinatura (Acessível sem assinatura)
routes.post('/planMensal', PlanController.criarPlanoMensal);
routes.post('/planAnual', PlanController.criarPlanoAnual);

// Rotas de Informações do Chef (Acessível sem assinatura para que possam ver o status do plano, atualizar perfil, etc.)
routes.get('/chefs/:chefId', async (req, res) => {
  try {
    const chef = await Chef.findById(req.params.chefId).select('-password');
    if (!chef) {
      return res.status(404).json({ message: 'Chef não encontrado.' });
    }
    res.status(200).json(chef);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar chef', error: error.message });
  }
});

routes.put('/chefs/:chefId', async (req, res) => {
  try {
    const { email, password, ...updateData } = req.body;
    const chef = await Chef.findByIdAndUpdate(req.params.chefId, updateData, { new: true }).select('-password');
    if (!chef) {
      return res.status(404).json({ message: 'Chef não encontrado.' });
    }
    res.status(200).json({ message: 'Informações do chef atualizadas com sucesso!', chef });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar chef', error: error.message });
  }
});

// Rotas de Itens de Cardápio (Protegidas por assinatura)
routes.post('/chefs/:chefId/menuItems', checkSubscription, MenuItemController.createMenuItem); 
routes.get('/chefs/:chefId/menuItems', checkSubscription, MenuItemController.getMenuItemsByChef); 
routes.get('/menuItems/:itemId', checkSubscription, MenuItemController.getMenuItemById); 
routes.put('/menuItems/:itemId', checkSubscription, MenuItemController.updateMenuItem); 
routes.delete('/menuItems/:itemId', checkSubscription, MenuItemController.deleteMenuItem);

// Rotas de Pedidos (Lado do administrador, protegidas por assinatura para visualização/atualização de pedidos)
routes.get('/chefs/:chefId/orders', checkSubscription, OrderController.getOrdersByChef);
routes.put('/orders/:orderId', checkSubscription, OrderController.updateOrder);
routes.delete('/orders/:orderId', checkSubscription, OrderController.deleteOrder);


// Rota para Geração de QR Code (Acessível sem assinatura, pois o QR aponta para o menu público)
routes.post('/generate-qr', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ message: 'URL é obrigatória para gerar o QR Code.' });
  }
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(url);
    res.json({ qrCodeUrl: qrCodeDataUrl });
  } catch (error) {
    console.error('Erro ao gerar QR Code:', error);
    res.status(500).json({ message: 'Erro ao gerar QR Code', error: error.message });
  }
});

// Rotas de Cardápio Público (Acessíveis sem assinatura, mas verificam o status do plano do chef)

// Rota para obter detalhes do chef/restaurante para o cardápio público
routes.get('/public/menu/:chefId', async (req, res) => {
  try {
    const chef = await Chef.findById(req.params.chefId).select('-password'); // Exclui informações sensíveis
    if (!chef) {
      return res.status(404).json({ message: 'Chef ou restaurante não encontrado.' });
    }

    // Verifica se o plano do chef está ativo e não expirou
    if (!chef.planoAtivo || (chef.dataExpiracaoPlano && chef.dataExpiracaoPlano < new Date())) {
      // Se o plano expirou, opcionalmente desative-o aqui
      if (chef.planoAtivo && chef.dataExpiracaoPlano && chef.dataExpiracaoPlano < new Date()) {
        chef.planoAtivo = false;
        await chef.save();
      }
      return res.status(403).json({ message: 'O cardápio deste estabelecimento está inativo no momento. Por favor, tente novamente mais tarde.' });
    }

    // Retorna apenas informações públicas necessárias
    res.status(200).json({
      _id: chef._id,
      restaurantName: chef.restaurantName,
      address: chef.address,
      phone: chef.phone,
      profilePicture: chef.profilePicture,
      // Adicione outros campos públicos como mensagem de boas-vindas, redes sociais se existirem no modelo Chef
    });

  } catch (error) {
    console.error('Erro ao buscar dados do chef para cardápio público:', error);
    res.status(500).json({ message: 'Erro ao buscar dados do estabelecimento para cardápio público', error: error.message });
  }
});

// Rota para obter itens de cardápio para o cardápio público
routes.get('/public/menu/:chefId/items', async (req, res) => {
  try {
    const chef = await Chef.findById(req.params.chefId);
    if (!chef) {
      return res.status(404).json({ message: 'Chef ou restaurante não encontrado.' });
    }

    // Crucialmente, verifique o status do plano *antes* de retornar os itens do cardápio
    if (!chef.planoAtivo || (chef.dataExpiracaoPlano && chef.dataExpiracaoPlano < new Date())) {
      return res.status(403).json({ message: 'O cardápio deste estabelecimento está inativo no momento. Por favor, tente novamente mais tarde.' });
    }

    const menuItems = await MenuItem.find({ chef: req.params.chefId, isAvailable: true }); 
    res.status(200).json({ menuItems });
  } catch (error) {
    console.error('Erro ao buscar itens de cardápio para cardápio público:', error);
    res.status(500).json({ message: 'Erro ao buscar itens de cardápio para cardápio público', error: error.message });
  }
});

// Rota para clientes fazerem um pedido (NÃO protegida por assinatura)
routes.post('/public/orders', OrderController.createOrder); // Novo: Rota pública para criar pedidos


module.exports = routes;