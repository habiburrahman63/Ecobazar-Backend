const User = require("../models/userSchema");

let getController = async (req, res) => {
  let userData = await User.find({});

  res.send({
    message: "All User Data ",
    userData,
  });
};

let singleUserController = async (req, res) => {
  const { id } = req.params;
  let userData = await User.findById(id);

  res.send({
    message: `${userData.email}, Data`,
    userData,
  });
};
let deleteController = async (req, res) => {
  const { id } = req.params;
  let userData = await User.findByIdAndDelete(id);

  res.send({
    message: "Deleted",
  });
};

let updateController = async (req, res) => {
  const { id } = req.params;
  let userData = await User.findByIdAndUpdate({ _id: id }, req.body, {
    new: true,
  });

  res.send({
    message: "User Updated",
  });
};

module.exports = {
  getController,
  singleUserController,
  deleteController,
  updateController,
  updateController,
};
