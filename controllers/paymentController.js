const axios = require("axios");
const Cart = require("../models/cartModel");
const Order = require("../models/orderModel");
<<<<<<< HEAD
const Product = require("../models/porductModel");
const User = require("../models/userSchema");

// AamarPay Configuration
const getAamarPayConfig = () => {
  const storeId = process.env.AAMARPAY_STORE_ID || "aamarpaytest";
  const signatureKey =
    process.env.AAMARPAY_SIGNATURE_KEY || "dbb74894e82415a2f7ff0ec3a97e4183";
  const isSandbox = process.env.AAMARPAY_IS_SANDBOX !== "false";

  const initUrl = isSandbox
    ? "https://sandbox.aamarpay.com/jsonpost.php"
    : "https://secure.aamarpay.com/jsonpost.php";

  const verifyUrl = isSandbox
    ? "https://sandbox.aamarpay.com/api/v1/trxcheck/request.php"
    : "https://secure.aamarpay.com/api/v1/trxcheck/request.php";

  const backendUrl = (process.env.BACKEND_URL || "http://localhost:5000")
    .trim()
    .replace(/\/+$/, "");
  const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173")
    .trim()
    .replace(/\/+$/, "");

  return { storeId, signatureKey, isSandbox, initUrl, verifyUrl, backendUrl, frontendUrl };
};

/**
 * Deducts product stock when an order is finalized/paid
 */
const deductStock = async (products) => {
  for (const item of products) {
    if (item.product) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: -Math.abs(item.quantity) },
      });
    }
  }
};

/**
 * Initiates payment or creates Cash-on-Delivery order
 */
const paymentControleer = async (req, res) => {
  try {
    const {
      userId,
      paymentMethod = "aamarpay",
      shippingAddress = {},
      cus_name,
      cus_email,
      cus_phone,
      cus_add1,
      cus_city,
      cus_postcode,
    } = req.body;

    const effectiveUserId = userId || (req.user && req.user._id);

    if (!effectiveUserId) {
      return res.status(401).json({
        success: false,
        message: "User ID is required to place an order.",
      });
    }

    const cart = await Cart.find({ user: effectiveUserId }).populate("product");

    if (!cart || cart.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Your cart is empty. Please add products before placing an order.",
      });
    }

    // Verify stock and calculate order items
    let totalPrice = 0;
    const orderProducts = [];

    for (const item of cart) {
      if (!item.product) continue;

      if (item.quantity > item.product.stock) {
        return res.status(400).json({
          success: false,
          message: `Product "${item.product.title}" has only ${item.product.stock} items left in stock.`,
        });
      }

      orderProducts.push({
        product: item.product._id,
=======

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
>>>>>>> 5708bdfbc5eac234b7169acedca8e68d50203f37
        title: item.product.title,
        price: item.product.price,
        sku: item.product.sku,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
<<<<<<< HEAD
        image:
          item.product.images?.find((img) => img.isMain)?.url ||
          item.product.images?.[0]?.url ||
          "",
      });

      totalPrice += item.totalPrice;
    }

    if (orderProducts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid products found in cart.",
      });
    }

    const resolvedAddress = {
      fullName: shippingAddress.fullName || cus_name || req.user?.name || "Valued Customer",
      phone: shippingAddress.phone || cus_phone || req.user?.phone || "01700000000",
      address: shippingAddress.address || cus_add1 || "Bangladesh",
      city: shippingAddress.city || cus_city || "Dhaka",
      postalCode: shippingAddress.postalCode || cus_postcode || "1200",
      notes: shippingAddress.notes || "",
    };

    // 1. CASH ON DELIVERY FLOW
    if (paymentMethod === "cod") {
      const tranId = `COD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const order = new Order({
        user: effectiveUserId,
        products: orderProducts,
        totalPrice: totalPrice,
        paymentMethod: "cod",
        paymentStatus: "unpaid",
        status: "pending",
        shippingAddress: resolvedAddress,
        tranid: tranId,
      });

      await order.save();
      await deductStock(orderProducts);
      await Cart.deleteMany({ user: effectiveUserId });

      return res.status(201).json({
        success: true,
        paymentMethod: "cod",
        message: "Order placed successfully with Cash on Delivery.",
        orderId: order._id,
        tranId: tranId,
        redirectUrl: `/order-success?orderId=${order._id}&tranId=${tranId}`,
      });
    }

    // 2. AAMARPAY ONLINE PAYMENT FLOW
    const { storeId, signatureKey, initUrl, backendUrl } = getAamarPayConfig();
    const tranId = `ECO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const order = new Order({
      user: effectiveUserId,
      products: orderProducts,
      totalPrice: totalPrice,
      paymentMethod: paymentMethod || "aamarpay",
      paymentStatus: "unpaid",
      status: "pending",
      shippingAddress: resolvedAddress,
      tranid: tranId,
=======
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
>>>>>>> 5708bdfbc5eac234b7169acedca8e68d50203f37
    });

    await order.save();

<<<<<<< HEAD
    const customerEmail =
      cus_email || req.user?.email || "customer@ecobazar.com";

    const aamarPayPayload = {
      store_id: storeId,
      signature_key: signatureKey,
      tran_id: tranId,
      amount: totalPrice,
      currency: "BDT",
      desc: `Ecobazar Order #${tranId}`,
      cus_name: resolvedAddress.fullName,
      cus_email: customerEmail,
      cus_phone: resolvedAddress.phone,
      cus_add1: resolvedAddress.address,
      cus_add2: "",
      cus_city: resolvedAddress.city,
      cus_state: resolvedAddress.city,
      cus_postcode: resolvedAddress.postalCode,
      cus_country: "Bangladesh",
      success_url: `${backendUrl}/payment/success`,
      fail_url: `${backendUrl}/payment/fail`,
      cancel_url: `${backendUrl}/payment/cancel`,
      type: "json",
    };

    const aamarPayRes = await axios.post(initUrl, aamarPayPayload);

    if (aamarPayRes.data && aamarPayRes.data.payment_url) {
      return res.status(200).json({
        success: true,
        paymentMethod: "aamarpay",
        paymentUrl: aamarPayRes.data.payment_url,
        orderId: order._id,
        tranId: tranId,
      });
    }

    // If AamarPay returned an error
    return res.status(400).json({
      success: false,
      message: "Could not initiate AamarPay payment gateway.",
      gatewayResponse: aamarPayRes.data,
    });
  } catch (error) {
    console.error("Payment initiation error:", error);
=======
    return res.json({
      success: true,
      data: response.data,
    });
  } catch (error) {
>>>>>>> 5708bdfbc5eac234b7169acedca8e68d50203f37
    return res.status(500).json({
      success: false,
      message: "Payment request failed.",
      error: error.response?.data || error.message,
    });
  }
};

<<<<<<< HEAD
/**
 * AamarPay Success Webhook Callback
 * AamarPay posts transaction data here. Backend verifies with AamarPay trxcheck API
 * before marking the order as paid.
 */
const paymentSuccessControleer = async (req, res) => {
  const { storeId, signatureKey, verifyUrl, frontendUrl } = getAamarPayConfig();

  try {
    const payload = req.body || {};
    const tranId = payload.mer_txnid || payload.tran_id;

    if (!tranId) {
      return res.redirect(`${frontendUrl}/order-failed?reason=missing_transaction_id`);
    }

    const order = await Order.findOne({ tranid: tranId });
    if (!order) {
      return res.redirect(`${frontendUrl}/order-failed?reason=order_not_found`);
    }

    // Idempotency: If order is already paid, redirect straight to success
    if (order.paymentStatus === "paid") {
      return res.redirect(
        `${frontendUrl}/order-success?orderId=${order._id}&tranId=${order.tranid}`
      );
    }

    // Server-to-Server Verification with AamarPay Check API
    const verifyEndpoint = `${verifyUrl}?request_id=${encodeURIComponent(
      tranId
    )}&store_id=${encodeURIComponent(storeId)}&signature_key=${encodeURIComponent(
      signatureKey
    )}&type=json`;

    let verificationData = null;
    try {
      const verifyResponse = await axios.get(verifyEndpoint);
      verificationData = verifyResponse.data;
    } catch (verifyErr) {
      console.error("AamarPay verification API error:", verifyErr.message);
    }

    const isSuccessful =
      verificationData &&
      (verificationData.pay_status === "Successful" ||
        verificationData.status_code === "2" ||
        verificationData.status_code === 2);

    // Verify Amount and Currency to prevent tampering
    const amountMatches =
      verificationData &&
      Math.abs(Number(verificationData.amount) - Number(order.totalPrice)) < 1;

    if (isSuccessful && amountMatches) {
      order.paymentStatus = "paid";
      order.status = "processing";
      order.val_id = verificationData.pg_txnid || payload.pg_txnid || "";
      order.paymentDetails = verificationData;
      await order.save();

      // Deduct product stocks
      await deductStock(order.products);

      // Clear user's cart
      await Cart.deleteMany({ user: order.user });

      return res.redirect(
        `${frontendUrl}/order-success?orderId=${order._id}&tranId=${order.tranid}`
      );
    } else {
      console.warn("Payment verification failed or amount mismatch:", {
        verificationData,
        expectedAmount: order.totalPrice,
      });

      order.paymentStatus = "failed";
      order.status = "cancelled";
      await order.save();

      return res.redirect(
        `${frontendUrl}/order-failed?orderId=${order._id}&reason=payment_verification_failed`
      );
    }
  } catch (error) {
    console.error("Payment success callback error:", error);
    return res.redirect(`${frontendUrl}/order-failed?reason=server_error`);
  }
};

/**
 * AamarPay Fail Callback
 */
const paymentFailControleer = async (req, res) => {
  const { frontendUrl } = getAamarPayConfig();
  try {
    const payload = req.body || {};
    const tranId = payload.mer_txnid || payload.tran_id;

    if (tranId) {
      const order = await Order.findOne({ tranid: tranId });
      if (order && order.paymentStatus !== "paid") {
        order.paymentStatus = "failed";
        await order.save();
        return res.redirect(
          `${frontendUrl}/order-failed?orderId=${order._id}&reason=payment_failed`
        );
      }
    }
    return res.redirect(`${frontendUrl}/order-failed?reason=payment_failed`);
  } catch (error) {
    console.error("Payment fail callback error:", error);
    return res.redirect(`${frontendUrl}/order-failed?reason=payment_failed`);
  }
};

/**
 * AamarPay Cancel Callback
 */
const paymentCancelControleer = async (req, res) => {
  const { frontendUrl } = getAamarPayConfig();
  try {
    const payload = req.body || {};
    const tranId = payload.mer_txnid || payload.tran_id;

    if (tranId) {
      const order = await Order.findOne({ tranid: tranId });
      if (order && order.paymentStatus !== "paid") {
        order.paymentStatus = "cancelled";
        await order.save();
        return res.redirect(
          `${frontendUrl}/order-failed?orderId=${order._id}&reason=payment_cancelled`
        );
      }
    }
    return res.redirect(`${frontendUrl}/order-failed?reason=payment_cancelled`);
  } catch (error) {
    console.error("Payment cancel callback error:", error);
    return res.redirect(`${frontendUrl}/order-failed?reason=payment_cancelled`);
  }
};

/**
 * Retrieve user's orders
 */
const getOrderControleer = async (req, res) => {
  try {
    const { userid } = req.params;
    const effectiveUserId = userid || (req.user && req.user._id);

    if (!effectiveUserId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const data = await Order.find({ user: effectiveUserId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Orders retrieved successfully",
      data: data || [],
    });
  } catch (error) {
    console.error("Get orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error retrieving orders",
=======
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
>>>>>>> 5708bdfbc5eac234b7169acedca8e68d50203f37
      error: error.message,
    });
  }
};

<<<<<<< HEAD
/**
 * Retrieve all orders for Admin
 */
const getAllOrdersControleer = async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate("user", "name email phone")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      orders: orders || [],
    });
  } catch (error) {
    console.error("Get all orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve all orders",
      error: error.message,
    });
  }
};

/**
 * Admin update order status
 */
const updateOrderStatusControleer = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const order = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate("user", "name email phone");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    console.error("Update order status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

/**
 * Verify specific order by transaction ID
 */
const verifyOrderControleer = async (req, res) => {
  try {
    const { tranid } = req.params;
    const order = await Order.findOne({ tranid }).populate("user", "name email");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error("Verify order error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to verify order",
      error: error.message,
    });
  }
};

module.exports = {
  paymentControleer,
  paymentSuccessControleer,
  paymentFailControleer,
  paymentCancelControleer,
  getOrderControleer,
  getAllOrdersControleer,
  updateOrderStatusControleer,
  verifyOrderControleer,
};
=======
module.exports = { paymentController, getOrderController };
=======
module.exports = { paymentController };
>>>>>>> f295fac397011a3dad7269137fd9af5c12ea2604
>>>>>>> 5708bdfbc5eac234b7169acedca8e68d50203f37
