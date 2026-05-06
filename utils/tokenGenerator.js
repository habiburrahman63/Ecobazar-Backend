const jwt = require("jsonwebtoken");

const tokenGenerator = (data, secret, expire) => {
  let token = jwt.sign(data, secret, { expiresIn: expire });
  return token;
};

module.exports = { tokenGenerator };
