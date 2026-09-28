// Central product configuration. Replace the placeholder URLs before shipping (see PLAN.md §4).
module.exports = {
  productName: 'Layoutly',
  price: '$10',

  // Free every day in the official edition: selected components and per-site style extractions.
  // The counts reset at local midnight; the lifetime license removes the limit.
  freePerDay: {
    components: 2,
    styles: 2,
  },

  // Lemon Squeezy one-time "lifetime" product.
  checkoutUrl: 'https://layoutly.lemonsqueezy.com/buy/REPLACE_WITH_YOUR_CHECKOUT_ID',
  lemonSqueezy: {
    // Optional: when set, keys from other products are rejected.
    productId: null,
  },

  website: 'https://contactiordache-code.github.io/Layoutly/',
  supportEmail: 'contact.iordache@gmail.com',
  xUrl: 'https://x.com/alexii_9',

  defaultHotkey: 'Alt+Shift+S',
  defaultStack: 'react-tailwind',
  defaultLlm: 'chatgpt',
};
