const Chef = require('../models/Chef');
const bcrypt = require('bcryptjs');

class LoginController {
    async loginChef(req, res) {
        try {
            const { email, password } = req.body;

            const chef = await Chef.findOne({ email });
            if (!chef) {
                return res.status(404).json({ message: 'Chef not found' });
            }

            const isMatch = await bcrypt.compare(password, chef.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid credentials' });
            }

            // Mova esta linha para dentro do bloco try
            const { password: _, ...chefData } = chef.toObject();
            return res.status(200).json({ message: 'Login successful', chef: chefData });

        } catch (error) {
            console.error('Error logging in chef:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }
    }
}

module.exports = new LoginController();