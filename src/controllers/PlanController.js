const { MercadoPagoConfig, PreApprovalPlan, PreApproval } = require('mercadopago');
const Chef = require('../models/Chef'); // Importe o modelo Chef
const moment = require('moment'); // Para manipulação de datas

const client = new MercadoPagoConfig({
    accessToken: 'APP_USR-6217831891381690-063010-8e8d815a9a6373fe83d0193753946d23-1840600103',
    options: {
        timeout: 5000
    }
});

const preApprovalPlan = new PreApprovalPlan(client);
const preApproval = new PreApproval(client);

async function criarPlanoMensal(req, res) {
    const { emailChef } = req.body;

    try {
        const response = await preApprovalPlan.create({
            body: {
                reason: "Assinatura Mensal de Serviço",
                auto_recurring: {
                    frequency: 1,
                    frequency_type: "months",
                    transaction_amount: 59.90,
                    currency_id: "BRL"
                },
                back_url: "https://www.seusite.com.br/sucesso-assinatura",
                external_reference: `plano_mensal_premium_${emailChef}`, // Adicione o email para referência
                status: "active"
            }
        });

        return res.send(response.init_point);
    } catch (error) {
        console.error("Erro ao criar plano mensal:", error.message || error);
        return res.status(500).send("Erro ao criar plano mensal.");
    }
}

async function criarPlanoAnual(req, res) {
    const { emailChef } = req.body;

    try {
        const response = await preApprovalPlan.create({
            body: {
                reason: "Assinatura Anual de Serviço",
                auto_recurring: {
                    frequency: 12,
                    frequency_type: "months",
                    transaction_amount: 599,
                    currency_id: "BRL"
                },
                back_url: "https://www.seusite.com.br/sucesso-assinatura-anual",
                external_reference: `plano_anual_premium_${emailChef}`, // Adicione o email para referência
                status: "active"
            }
        });

        return res.send(response.init_point);
    } catch (error) {
        console.error("Erro ao criar plano anual:", error.message || error);
        return res.status(500).send("Erro ao criar plano anual.");
    }
}

async function handleMercadoPagoWebhook(req, res) {
    const { type, data } = req.body;

    console.log("Webhook recebido:", type, data);

    try {
        // Validação da assinatura do webhook (altamente recomendável para segurança)
        // O Mercado Pago envia um header 'x-signature' que você deve validar.
        // Consulte a documentação do Mercado Pago para a implementação completa da validação da assinatura.

        if (type === 'preapproval') {
            const preapprovalId = data.id;

            // Busca os detalhes da pré-aprovação para obter o external_reference
            const preapprovalDetails = await preApproval.get({ id: preapprovalId });
            const externalReference = preapprovalDetails.external_reference;
            const status = preapprovalDetails.status;

            // Extrai o email do chef do external_reference (se você o incluiu)
            const emailChefMatch = externalReference.match(/_(plano_mensal_premium|plano_anual_premium)_(.+)/);
            const emailChef = emailChefMatch ? emailChefMatch[2] : null;

            if (!emailChef) {
                console.warn("Email do chef não encontrado no external_reference:", externalReference);
                return res.status(400).send("Email do chef não encontrado.");
            }

            const chef = await Chef.findOne({ email: emailChef });

            if (!chef) {
                console.warn("Chef não encontrado para o email:", emailChef);
                return res.status(404).send("Chef não encontrado.");
            }

            if (status === 'authorized') { // Ou o status que indica pagamento bem-sucedido para assinaturas
                chef.planoAtivo = true;

                // Define a data de expiração com base no plano
                if (externalReference.includes('plano_mensal_premium')) {
                    chef.dataExpiracaoPlano = moment().add(1, 'months').toDate();
                } else if (externalReference.includes('plano_anual_premium')) {
                    chef.dataExpiracaoPlano = moment().add(12, 'months').toDate();
                }

                await chef.save();
                console.log(`Plano ativado para o chef ${chef.email}. Data de expiração: ${chef.dataExpiracaoPlano}`);
            } else if (status === 'cancelled' || status === 'paused' || status === 'pending') {
                // Lidar com outros status de pré-aprovação, como cancelamento, pausa ou pendente
                chef.planoAtivo = false;
                chef.dataExpiracaoPlano = null; // Ou defina como a data de cancelamento se aplicável
                await chef.save();
                console.log(`Plano do chef ${chef.email} atualizado para ${status}.`);
            }
        } else if (type === 'payment') {
            // Este tipo de notificação é para pagamentos únicos, não para pré-aprovações de assinatura.
            // No entanto, pode ser útil para depuração ou para lidar com pagamentos iniciais de planos.
            const paymentId = data.id;
            const paymentDetails = await client.payments.get({ id: paymentId });
            const paymentStatus = paymentDetails.status;
            const externalReference = paymentDetails.external_reference; // Se você estiver passando essa info no pagamento

            // Exemplo: se o pagamento é parte da ativação inicial de uma assinatura
            if (paymentStatus === 'approved' && externalReference && externalReference.startsWith('plano_')) {
                const emailChefMatch = externalReference.match(/_(plano_mensal_premium|plano_anual_premium)_(.+)/);
                const emailChef = emailChefMatch ? emailChefMatch[2] : null;

                if (emailChef) {
                    const chef = await Chef.findOne({ email: emailChef });
                    if (chef && !chef.planoAtivo) {
                        chef.planoAtivo = true;
                        if (externalReference.includes('plano_mensal_premium')) {
                            chef.dataExpiracaoPlano = moment().add(1, 'months').toDate();
                        } else if (externalReference.includes('plano_anual_premium')) {
                            chef.dataExpiracaoPlano = moment().add(12, 'months').toDate();
                        }
                        await chef.save();
                        console.log(`Plano ativado via pagamento aprovado para o chef ${chef.email}. Data de expiração: ${chef.dataExpiracaoPlano}`);
                    }
                }
            }
        }

        return res.status(200).send('Webhook recebido com sucesso.');
    } catch (error) {
        console.error("Erro ao processar webhook do Mercado Pago:", error.message || error);
        return res.status(500).send("Erro interno ao processar webhook.");
    }
}


// Função para verificar e desativar planos expirados (pode ser executada por um cron job)
async function verificarPlanosExpirados() {
    try {
        const chefsExpirados = await Chef.find({
            planoAtivo: true,
            dataExpiracaoPlano: { $lte: new Date() } // Encontra chefs com plano ativo e data de expiração passada
        });

        for (const chef of chefsExpirados) {
            chef.planoAtivo = false;
            chef.dataExpiracaoPlano = null; // Ou mantenha a data de expiração para histórico
            await chef.save();
            console.log(`Plano do chef ${chef.email} desativado por expiração.`);
        }
    } catch (error) {
        console.error("Erro ao verificar planos expirados:", error.message || error);
    }
}

module.exports = {
    criarPlanoMensal,
    criarPlanoAnual,
    handleMercadoPagoWebhook,
    verificarPlanosExpirados
};