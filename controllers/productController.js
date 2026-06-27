const { emptyfieldValidation } = require("../utils/validation");
const Product = require("../models/porductModel");

// const createProductController = async (req, res) => {
//   const { title, price, category } = req.body;
//   emptyfieldValidation(res, title, price, category);

//   //   title exists ase anki

//   let sku = `${Date.now()}-${new Date().getFullYear()}`;

//   //   sku exists ase naki

//   let product = new Product({
//     ...req.body,
//     sku: sku,
//   });
//   await product.save();
//   res.json({
//     success: true,
//     message: "Product Created",
//   });
// };

const createProductController = async (req, res) => {
  try {
    const { title, price, category } = req.body;
    const existingProduct = await Product.findOne({ title });
    if (existingProduct) {
      return res.json({
        success: false,
        message: "Product with this title already exists",
      });
    }
    // const productTitle = await Product.findOne({ title: title });
    // console.log(productTitle);
    // if (!productTitle) {
    //   return res.json({
    //     success: false,
    //     message: "Product Title Not Found",
    //   });
    // }

    emptyfieldValidation(res, title, price, category);

    let sku = `${Date.now()}-${new Date().getFullYear()}`;

    let product = new Product({
      ...req.body,
      sku: sku,
    });

    await product.save();
    res.json({
      success: true,
      message: "Product Created",
      product,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
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
    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct) {
      return res.json({ success: false, message: "Product not found" });
    }
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
      { new: true },
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
