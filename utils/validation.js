const hasEmptyField = (...fields) => {
  for (const field of fields) {
    if (field === undefined || field === null || (typeof field === "string" && field.trim() === "")) {
      return true;
    }
  }
  return false;
};

const emptyfieldValidation = (res, ...fields) => {
  if (hasEmptyField(...fields)) {
    res.status(400).json({ success: false, message: "Please fill all required fields." });
    return true; // indicates an error was sent
  }
  return false;
};

module.exports = { hasEmptyField, emptyfieldValidation };
