const objectId = (value, helpers) => {
  // UUID v4 regex pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  if (!uuidPattern.test(value)) {
    return helpers.message('Invalid id format');
  }
  
  return value;
};

module.exports = {
  objectId,
}; 