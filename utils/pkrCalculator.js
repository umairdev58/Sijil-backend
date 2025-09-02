/**
 * Simple utility to calculate PKR amounts from AED with proper rounding
 */

/**
 * Calculate PKR amount from AED using conversion rate
 * @param {number} amountAED - Amount in AED
 * @param {number} conversionRate - PKR to AED conversion rate
 * @returns {number} Amount in PKR (rounded to whole number)
 */
const calculatePKR = (amountAED, conversionRate) => {
  if (!amountAED || !conversionRate || conversionRate <= 0) {
    return 0;
  }
  
  // Calculate PKR: AED * conversion_rate
  const amountPKR = amountAED * conversionRate;
  
  // Round to whole number (PKR typically doesn't have decimals)
  return Math.round(amountPKR);
};

/**
 * Calculate AED amount from PKR using conversion rate
 * @param {number} amountPKR - Amount in PKR
 * @param {number} conversionRate - PKR to AED conversion rate
 * @returns {number} Amount in AED (rounded to 2 decimal places)
 */
const calculateAED = (amountPKR, conversionRate) => {
  if (!amountPKR || !conversionRate || conversionRate <= 0) {
    return 0;
  }
  
  // Calculate AED: PKR / conversion_rate
  const amountAED = amountPKR / conversionRate;
  
  // Round to 2 decimal places (AED standard)
  return Math.round(amountAED * 100) / 100;
};

module.exports = {
  calculatePKR,
  calculateAED
};
