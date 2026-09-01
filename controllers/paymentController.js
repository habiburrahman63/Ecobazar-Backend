const axios = require("axios");
const Cart = require("../models/cartModel");
const Order = require("../models/orderModel");

const paymentController = async (req, res) => {
  const {
    userId,
    cus_name,
    cus_email,
    cus_add1,
    cus_add2,
    cus_city,
    cus_state,
    cus_postcode,
    cus_phone,
  } = req.body;

  try {
    const cart = await Cart.find({ user: userId }).populate("product");
    // console.log(cart);

    let totalPrice = 0;

    let pro = [];

    cart.map((item) => {
      pro.push({
        title: item.product.title,
        price: item.product.price,
        sku: item.product.sku,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
      });

      totalPrice += item.totalPrice;
    });

    // res.send({
    //   product: pro,
    //   totalPrice: totalPrice,
    // });

    const response = await axios.post(
      "https://sandbox.aamarpay.com/jsonpost.php",
      {
        store_id: "aamarpaytest",
        tran_id: Date.now().toString(),
        success_url: "http://localhost:3000/payment/success",
        fail_url: "http://localhost:3000/payment/fail",
        cancel_url: "http://localhost:3000/payment/cancel",
        amount: totalPrice,
        currency: "BDT",
        signature_key: "dbb74894e82415a2f7ff0ec3a97e4183",
        desc: "Merchant Registration Payment",
        cus_name: cus_name,
        cus_email: cus_email,
        cus_add1: cus_add1,
        cus_add2: cus_add2,
        cus_city: cus_city,
        cus_state: cus_state,
        cus_postcode: cus_postcode,
        cus_country: "Bangladesh",
        cus_phone: cus_phone,
        type: "json",
      },
    );

    const order = new Order({
      user: userId,
      products: pro,
      totalPrice: totalPrice,
      tranid: Date.now().toString(),
    });

    await order.save();

    return res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Payment request failed.",
      error: error.response?.data || error.message,
    });
  }
};

<<<<<<< HEAD
const getOrderController = async (req, res) => {
  try {
    const { userid } = req.params;

    let data = await Order.find({ user: userid });

    if (!data || data.length === 0) {
      return res.send({
        success: false,
        message: "No orders found for this user",
      });
    }

    res.send({
      success: true,
      message: "Orders retrieved successfully",
      data: data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

module.exports = { paymentController, getOrderController };
=======
module.exports = { paymentController };
>>>>>>> f295fac397011a3dad7269137fd9af5c12ea2604
