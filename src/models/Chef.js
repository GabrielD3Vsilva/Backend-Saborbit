const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); 

const chefSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  phone: {
        type: String,
        required: true,
    },
    address: {
        type: String,
        required: true,
    },
    restaurantName: {
        type: String,
        required: true,
    },
    profilePicture: {
        type: String,
        required: false,
    },
    qrCodeUrl: { 
      type: String,
      required: false,
    },
    planoAtivo: { 
      type: Boolean,
      default: false,
    },
    dataExpiracaoPlano: { 
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    }
});

chefSchema.pre('save', async function (next) {
  if (this.isModified('password')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

module.exports = mongoose.model('Chef', chefSchema);