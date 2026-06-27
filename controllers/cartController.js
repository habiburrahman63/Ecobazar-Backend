const Cart = require("../models/cartModel");
const Product = require("../models/porductModel");

const createCartController = async (req, res) => {
  const { proId, userId } = req.params;

  const existingProduct = await Product.findOne({ proId });
  if (!existingProduct) {
    return res.json({
      success: false,
      message: "Product Not Found",
    });
  }

  let cart = new Cart({
    product: id,
    quantity: 1,
    userId: userId,
  });

  await cart.save();

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
    product.quantity = product.quantity + 1;
  } else {
    product.quantity = product.quantity - 1;
  }

  await product.save();

  res.json({
    success: true,
    message: "Cart Update successfully",
  });
};

const proDeleteController = async (req, res) => {
  const { id } = req.params;

  await Cart.findByIdAndDelete(id);

  res.json({
    success: true,
    message: "Product deleted ",
  });
};

const getCartController = async (req, res) => {
  const { userid } = req.params;

  const cart = await Cart.find({ _id: userid });

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
  proDeleteController,
  getCartController,
};
