const User = require("../models/userSchema");

const getControleer = async (req, res) => {
  try {
    const userData = await User.find({ isDelete: false })
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "All User Data",
      userData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error.message,
    });
  }
};

<<<<<<< HEAD
const getAllDeleteUserControleer = async (req, res) => {
  try {
    const userData = await User.find({ isDelete: true })
      .select("-password")
      .sort({ updatedAt: -1 })
      .lean();
=======
let singleUserController = async (req, res) => {
  const { id } = req.params;
  let userData = await User.findById(id).select("-password");
>>>>>>> 5708bdfbc5eac234b7169acedca8e68d50203f37

    return res.status(200).json({
      success: true,
      message: "All Deleted User Data",
      userData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch deleted users",
      error: error.message,
    });
  }
};

const getSearchData = async (req, res) => {
  try {
    const { name } = req.body;
    const query = name ? name.trim() : "";

    const userData = await User.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { email: { $regex: query, $options: "i" } },
      ],
      isDelete: false,
    })
      .select("-password")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Search User Data",
      userData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Search failed",
      error: error.message,
    });
  }
};

const singleUserControleer = async (req, res) => {
  try {
    const { id } = req.params;
    const userData = await User.findById(id).select("-password").lean();

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `${userData.email} Data`,
      userData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user",
      error: error.message,
    });
  }
};

const deleteControleer = async (req, res) => {
  try {
    const { id } = req.params;
    const userData = await User.findByIdAndUpdate(
      id,
      { isDelete: true },
      { new: true }
    ).select("-password");

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User deactivated successfully",
      data: userData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete user",
      error: error.message,
    });
  }
};

const updateControleer = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };
    delete updates.password; // Do not allow password update via general update route

    const userData = await User.findByIdAndUpdate(id, updates, {
      new: true,
    }).select("-password");

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: userData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update user",
      error: error.message,
    });
  }
};

module.exports = {
  getControleer,
  singleUserControleer,
  deleteControleer,
  updateControleer,
  getAllDeleteUserControleer,
  getSearchData,
};
