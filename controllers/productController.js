const { emptyfieldValidation } = require("../utils/validation");
const Product = require("../models/porductModel");

const createProductController = async (req, res) => {
  const { title, price, category } = req.body;
  emptyfieldValidation(res, title, price, category);

  //   title exists ase anki

  let sku = `${Date.now()}-${new Date().getFullYear()}`;

  //   sku exists ase naki

  let product = new Product({
    ...req.body,
    sku: sku,
  });
  await product.save();
  res.json({
    success: true,
    message: "Product Created",
  });
};

// all product get
const getProductController = async (req, res) => {
  try {
    let product = await Product.find({});
    res.json({
      success: true,
      product,
    });
  } catch (error) {
    res.json({
      success: false,
      message: "Server Error",
    });
  }
};
// single product get
const getSingleProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const singleProduct = await Product.findOne({ _id: id });

    res.json({
      success: true,
      singleProduct,
    });
  } catch (error) {
    res.json({
      success: false,
      message: "Server Error",
    });
  }
};

// delete product

const productDeleteController = async (req, res) => {
  try {
    const { id } = req.params;
    await Product.findByIdAndDelete({ id });

    res.json({
      success: true,
      message: "Product delete",
    });
  } catch (error) {
    res.json({
      success: false,
      message: "Server Error",
    });
  }
};

// update product get

const productUpdateController = async (req, res) => {
  try {
    const { id } = req.params;
    const productUpdate = await Product.findByIdAndUpdate(
      { _id: id },
      req.body,
    );
    res.json({
      success: true,
      message: "Product Update",
    });
  } catch (error) {
    res.json({
      success: false,
      message: "Server Error",
    });
  }
};

module.exports = {
  createProductController,
  getProductController,
  getSingleProduct,
  productDeleteController,
  productUpdateController,
};
