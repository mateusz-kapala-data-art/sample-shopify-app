// Only the delivery target is declared in shopify.extension.toml, so only it
// is exported. The Discount API's cart-lines half was removed with the template
// boilerplate — we discount shipping, nothing else.
export * from './cart_delivery_options_discounts_generate_run';
