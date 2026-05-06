const emptyfieldValidation = (res, ...field) => {
  console.log(field.includes(undefined));
  if (field.includes(undefined) || field.includes("")) {
    return res.send({ message: "please fill all the filed" });
  }
};

module.exports = { emptyfieldValidation };
