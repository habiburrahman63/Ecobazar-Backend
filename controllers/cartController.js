const Cart = require("../models/cartModel");
const Product = require("../models/porductModel");

/**
 * Calculates effective unit price taking active discounts into consideration
 */
const getEffectivePrice = (product) => {
  if (!product) return 0;
  const price = Number(product.price) || 0;
  const discount = Number(product.discount) || 0;

  if (product.discountType === "flat") {
    return Math.max(0, price - discount);
  }
  if (product.discountType === "percent" || product.discountType === "percentage") {
    return Math.max(0, Math.round(price - (price * discount) / 100));
  }
  return price;
};

const createCartControleer = async (req, res) => {
  try {
    const { proId, userId, quantity = 1 } = req.body;
    const effectiveUserId = userId || (req.user && req.user._id);

    if (!proId || !effectiveUserId) {
      return res.status(400).json({
        success: false,
        message: "Product ID and User ID are required",
      });
    }

    const product = await Product.findById(proId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.stock <= 0) {
      return res.status(400).json({
        success: false,
        message: "This product is currently out of stock",
      });
    }

    const unitPrice = getEffectivePrice(product);
    const addQty = Math.max(1, Number(quantity) || 1);

    const existingCartItem = await Cart.findOne({
      product: proId,
      user: effectiveUserId,
    });

    if (existingCartItem) {
      const newQty = existingCartItem.quantity + addQty;
      if (newQty > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more than available stock (${product.stock})`,
        });
      }
      existingCartItem.quantity = newQty;
      existingCartItem.totalPrice = newQty * unitPrice;
      await existingCartItem.save();
    } else {
      if (addQty > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more than available stock (${product.stock})`,
        });
      }
      const cart = new Cart({
        product: proId,
        quantity: addQty,
        totalPrice: addQty * unitPrice,
        user: effectiveUserId,
      });
      await cart.save();
    }

    return res.status(200).json({
      success: true,
      message: "Product added to cart successfully",
    });
  } catch (error) {
    console.error("Add to cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to add product to cart",
      error: error.message,
    });
  }
};

const increDecreControleer = async (req, res) => {
  try {
    const { id } = req.params;
    const { type, userId } = req.body;
    const effectiveUserId = userId || (req.user && req.user._id);

    // Look up either by Cart item _id or by Product _id + User
    let cartItem = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      cartItem = await Cart.findById(id).populate("product");
    }
    if (!cartItem && effectiveUserId) {
      cartItem = await Cart.findOne({
        product: id,
        user: effectiveUserId,
      }).populate("product");
    }

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    const product = cartItem.product;
    if (!product) {
      await Cart.findByIdAndDelete(cartItem._id);
      return res.status(404).json({
        success: false,
        message: "Associated product no longer exists",
      });
    }

    const unitPrice = getEffectivePrice(product);

    if (type === "plus" || type === "increment") {
      if (cartItem.quantity >= product.stock) {
        return res.status(400).json({
          success: false,
          message: `Stock limit reached (${product.stock} available)`,
        });
      }
      cartItem.quantity += 1;
      cartItem.totalPrice = cartItem.quantity * unitPrice;
      await cartItem.save();
    } else {
      if (cartItem.quantity <= 1) {
        await Cart.findByIdAndDelete(cartItem._id);
        return res.status(200).json({
          success: true,
          message: "Item removed from cart",
        });
      }
      cartItem.quantity -= 1;
      cartItem.totalPrice = cartItem.quantity * unitPrice;
      await cartItem.save();
    }

    return res.status(200).json({
      success: true,
      message: "Cart updated successfully",
      cartItem,
    });
  } catch (error) {
    console.error("Cart quantity update error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update cart",
      error: error.message,
    });
  }
};

const cartDeleteControleer = async (req, res) => {
  try {
    const { id } = req.params;
    const effectiveUserId =
      req.query.userId || req.body?.userId || (req.user && req.user._id);

    let deleted = null;
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      if (effectiveUserId) {
        deleted = await Cart.findOneAndDelete({ _id: id, user: effectiveUserId });
      } else {
        deleted = await Cart.findByIdAndDelete(id);
      }
    }

    if (!deleted && effectiveUserId) {
      // Check if ID is a product ID and delete for THIS user
      deleted = await Cart.findOneAndDelete({
        product: id,
        user: effectiveUserId,
      });
    } else if (!deleted) {
      deleted = await Cart.findOneAndDelete({ product: id });
    }

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Item not found in cart",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Cart item removed successfully",
    });
  } catch (error) {
    console.error("Delete cart item error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove cart item",
      error: error.message,
    });
  }
};

const clearCartControleer = async (req, res) => {
  try {
    const userId = req.params.userid || (req.user && req.user._id);
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID required",
      });
    }

    await Cart.deleteMany({ user: userId });
    return res.status(200).json({
      success: true,
      message: "Cart cleared successfully",
    });
  } catch (error) {
    console.error("Clear cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to clear cart",
      error: error.message,
    });
  }
};

const getUserCartData = async (effectiveUserId) => {
  const rawCart = await Cart.find({ user: effectiveUserId })
    .populate("product")
    .lean();

  const validItems = [];
  let totalPrice = 0;

  for (const item of rawCart) {
    if (!item.product) {
      await Cart.findByIdAndDelete(item._id);
      continue;
    }

    const effectivePrice = getEffectivePrice(item.product);
    const computedTotal = item.quantity * effectivePrice;
    totalPrice += computedTotal;

    validItems.push({
      _id: item._id,
      productId: item.product._id,
      title: item.product.title,
      price: effectivePrice,
      originalPrice: item.product.price,
      stock: item.product.stock,
      quantity: item.quantity,
      totalPrice: computedTotal,
      image:
        item.product.images?.find((img) => img.isMain)?.url ||
        item.product.images?.[0]?.url ||
        "",
      product: item.product,
    });
  }

  return { cart: validItems, totalPrice };
};

const getCartControleer = async (req, res) => {
  try {
    const { userid } = req.params;
    const effectiveUserId = userid || (req.user && req.user._id);

    if (!effectiveUserId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const { cart, totalPrice } = await getUserCartData(effectiveUserId);

    return res.status(200).json({
      success: true,
      cart,
      totalPrice,
    });
  } catch (error) {
    console.error("Get cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve cart items",
      error: error.message,
    });
  }
};

const mergeCartControleer = async (req, res) => {
  try {
    const { userId, items } = req.body;
    const effectiveUserId = userId || (req.user && req.user._id);

    if (!effectiveUserId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required to merge cart",
      });
    }

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const proId = item.productId || item.proId || item._id;
        const addQty = Math.max(1, Number(item.quantity) || 1);

        if (!proId || !String(proId).match(/^[0-9a-fA-F]{24}$/)) {
          continue;
        }

        const product = await Product.findById(proId);
        if (!product || product.stock <= 0) {
          continue;
        }

        const unitPrice = getEffectivePrice(product);

        const existingCartItem = await Cart.findOne({
          product: proId,
          user: effectiveUserId,
        });

        if (existingCartItem) {
          const newQty = Math.min(
            existingCartItem.quantity + addQty,
            product.stock
          );
          existingCartItem.quantity = newQty;
          existingCartItem.totalPrice = newQty * unitPrice;
          await existingCartItem.save();
        } else {
          const finalQty = Math.min(addQty, product.stock);
          const cart = new Cart({
            product: proId,
            quantity: finalQty,
            totalPrice: finalQty * unitPrice,
            user: effectiveUserId,
          });
          await cart.save();
        }
      }
    }

    const { cart, totalPrice } = await getUserCartData(effectiveUserId);

    return res.status(200).json({
      success: true,
      message: "Cart merged successfully",
      cart,
      totalPrice,
    });
  } catch (error) {
    console.error("Merge cart error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to merge cart",
      error: error.message,
    });
  }
};

module.exports = {
  createCartControleer,
  increDecreControleer,
  cartDeleteControleer,
  clearCartControleer,
  getCartControleer,
  mergeCartControleer,
};
