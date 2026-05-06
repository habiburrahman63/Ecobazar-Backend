const jwt = require("jsonwebtoken");

const secureMiddleWare = (req, res, next) => {
  let token = req.headers.authorization;

  jwt.verify(token, "shhhhh", function (err, decoded) {
    if (err) {
      res.send({ message: "Unauthorized" });
    } else {
      next();
    }
  });
};

//   akhane ki async await bosbe   Aita homeWork chilo
//   let data = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

module.exports = secureMiddleWare;
