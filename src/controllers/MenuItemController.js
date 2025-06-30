const MenuItem = require('../models/MenuItem');
const Chef = require('../models/Chef');

class MenuItemController {

  async createMenuItem(req, res) {
    try {
      const { chefId, name, description, price, category, imageUrl } = req.body;

      const chefExists = await Chef.findById(chefId);
      if (!chefExists) {
        return res.status(404).json({ message: 'Chef não encontrado.' });
      }

      const newItem = new MenuItem({
        chef: chefId,
        name,
        description,
        price,
        category,
        imageUrl,
      });

      await newItem.save();
      res.status(201).json({ message: 'Item do cardápio criado com sucesso', item: newItem });
    } catch (error) {
      console.error('Erro ao criar item do cardápio:', error);
      res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
    }
  }

  async getMenuItemsByChef(req, res) {
    try {
      const { chefId } = req.params; 

      const menuItems = await MenuItem.find({ chef: chefId });

      if (menuItems.length === 0) {
        return res.status(404).json({ message: 'Nenhum item de cardápio encontrado para este chef.' });
      }

      res.status(200).json({ menuItems });
    } catch (error) {
      console.error('Erro ao buscar itens do cardápio:', error);
      res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
    }
  }

  async getMenuItemById(req, res) {
    try {
      const { itemId } = req.params;

      const item = await MenuItem.findById(itemId);

      if (!item) {
        return res.status(404).json({ message: 'Item do cardápio não encontrado.' });
      }

      res.status(200).json({ item });
    } catch (error) {
      console.error('Erro ao buscar item do cardápio por ID:', error);
      res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
    }
  }

  async updateMenuItem(req, res) {
    try {
      const { itemId } = req.params;
      const updates = req.body; 

      const updatedItem = await MenuItem.findByIdAndUpdate(itemId, updates, { new: true });

      if (!updatedItem) {
        return res.status(404).json({ message: 'Item do cardápio não encontrado.' });
      }

      res.status(200).json({ message: 'Item do cardápio atualizado com sucesso', item: updatedItem });
    } catch (error) {
      console.error('Erro ao atualizar item do cardápio:', error);
      res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
    }
  }

  async deleteMenuItem(req, res) {
    try {
      const { itemId } = req.params;

      const deletedItem = await MenuItem.findByIdAndDelete(itemId);

      if (!deletedItem) {
        return res.status(404).json({ message: 'Item do cardápio não encontrado.' });
      }

      res.status(200).json({ message: 'Item do cardápio deletado com sucesso.' });
    } catch (error) {
      console.error('Erro ao deletar item do cardápio:', error);
      res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
    }
  }
}

module.exports = new MenuItemController();