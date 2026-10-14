export function validatePrice(value) {
  const num = parseFloat(value);
  return !isNaN(num) && num >= 0;
}

export function validateQuantity(value) {
  const num = parseFloat(value);
  return !isNaN(num) && num > 0;
}

export function validateProductName(name) {
  return name && name.trim().length > 0;
}

export function validatePhoneNumber(phone) {
  // Basic validation - adjust for your region
  return phone && /^[0-9\s\-+()]+$/.test(phone);
}
