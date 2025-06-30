const Chef = require('../models/Chef');

class RegisterController {
  async registerChef(req, res) {
    try {
      const { name, email, password, phone, address, restaurantName, profilePicture } = req.body;

      const existingChef = await Chef.findOne({ email });
      if (existingChef) {
        return res.status(400).json({ message: 'Chef already exists' });
      }

      const newChef = new Chef({
        name,
        email,
        password,
        phone,
        address,
        restaurantName,
        profilePicture
      });

      await newChef.save();

      res.status(201).json({ message: 'Chef registered successfully', chef: newChef });
    } catch (error) {
      console.error('Error registering chef:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
}

module.exports = new RegisterController();