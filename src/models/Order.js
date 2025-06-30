// models/Order.js
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  chefId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chef',
    required: true,
  },
  items: [{
    menuItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    itemName: String,
    unitPrice: Number,
    quantity: Number,
    observations: String,
    // Se você quiser implementar opções para itens de cardápio como no exemplo,
    // você adicionaria uma estrutura similar aqui:
    // selectedOptions: [{
    //   optionName: String,
    //   selection: String,
    //   extraPrice: { type: Number, default: 0 }
    // }]
  }],
  total: {
    type: Number,
    required: true,
  },
  clientName: {
    type: String,
    required: true,
  },
  clientPhone: {
    type: String,
    required: true,
  },
  clientAddress: String, // Opcional, dependendo das suas necessidades
  observations: String,
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'canceled', 'delivered'], // Use inglês para consistência
    default: 'pending',
  },
  orderDate: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Order', orderSchema);