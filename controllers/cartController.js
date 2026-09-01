const Cart = require("../models/cartModel");
const Product = require("../models/porductModel");

const createCartController = async (req, res) => {
  const { proId, userId } = req.body;

  const existingProduct = await Product.findOne({ _id: proId });
  if (!existingProduct) {
    return res.json({
      success: false,
      message: "Product Not Found",
    });
  }

  const existingProductOneCart = await Cart.findOne({
    product: proId,
    user: userId,
  });

  if (existingProductOneCart) {
    existingProductOneCart.quantity += 1;
    existingProductOneCart.totalPrice =
      existingProductOneCart.totalPrice + existingProduct.price;
    existingProductOneCart.save();
  } else {
    let cart = new Cart({
      product: proId,
      quantity: 1,
      totalPrice: existingProduct.price,
      user: userId,
    });

    await cart.save();
  }

  res.json({
    success: true,
    message: "Product added successfully",
  });
};

const increDecreController = async (req, res) => {
  const { id } = req.params;
  const { type } = req.body;

  const product = await Product.findOne({ id });

  if (type == "plus") {
    cart.quantity += 1;
    cart.totalPrice = cart.totalPrice + product.price;
    await cart.save();
  } else {
    cart.quantity -= 1;
    cart.totalPrice = cart.totalPrice - product.price;
    await cart.save();
  }

  res.json({
    success: true,
    message: "Cart Update successfully",
  });
};

// const cartDeleteController = async (req, res) => {
//   const { id } = req.params;

//   await Cart.findByIdAndDelete({ _id: id });

//   res.json({
//     success: true,
//     message: "Cart deleted ",
//   });
// };

const cartDeleteController = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Cart.findByIdAndDelete(id);

    if (!deleted) {
      return res.json({
        success: false,
        message: "Item already deleted or not found",
      });
    }

    res.json({ success: true, message: "Cart item deleted" });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

const getCartController = async (req, res) => {
  const { userid } = req.params;

  const cart = await Cart.find({ user: userid }).populate("user product");

  let totalPrice = 0;

  cart.map((item) => {
    totalPrice += item.price;
  });

  res.json({
    cart,
    totalPrice,
  });
};

module.exports = {
  createCartController,
  increDecreController,
  cartDeleteController,
  getCartController,
};
