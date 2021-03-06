/**
 * @summary Commit all objects currently in the import buffer.
 *
 * Importing a product consists of the following steps:
 *
 * * Upsert the parent product, so it surely exists in the system.
 * * Pull the variant from non-matching parent products.
 * * Push the variant if it doesn't exist.
 * * Update the variant.
 */
Import = function () {
  let contexts = {};
  let query = {};
  let update = {};
  contexts.product = ReactionCore.Schemas.Product.newContext();
  contexts.variant = ReactionCore.Schemas.ProductVariant.newContext();
  while (Import._tags.length > 0) {
    var tag = Import._tags.pop();
    // Upsert tags.
    ReactionCore.Collections.Tags.update(tag.key, { isTopLevel: true }, { upsert: true, validate: false });
  }
  while (Import._products.length > 0) {
    var product = Import._products.pop();
    // Upsert products.
    ReactionCore.Schemas.Product.clean(product.value, {});
    contexts.product.validate(product.value);
    ReactionCore.Collections.Products.update(product.key, {
      $set: product.value
    }, { upsert: true, validate: false });
  }
  while (Import._variants.length > 0) {
    var variant = Import._variants.pop();
    //ReactionCore.Schemas.ProductVariant.clean(Import._variants[i].value, {});
    //contexts.variant.validate(Import._variants[i].value, {});
    // Remove variants with the same key from other parents.
    ReactionCore.Collections.Products.update({
      'variants': { $elemMatch: variant.key },
      $nor: [ variant.parent ]
    }, {
      $pull: { 'variants': { $elemMatch: variant.key } }
    });
    // Make sure the variant exists.
    query = { $nor: [ { 'variants': { $elemMatch: variant.key } } ] };
    for (let key of Object.keys(variant.parent)) {
      query[key] = variant.parent[key];
    }
    ReactionCore.Collections.Products.update(query, {
      $push: { 'variants': variant.key }
    }, { validate: false });
    // Upsert the variant. This currently overwrites the old variant.
    query = { 'variants': { $elemMatch: variant.key } };
    for (let key of Object.keys(variant.parent)) {
      query[key] = variant.parent[key];
    }
    update = {};
    for (let key of Object.keys(variant.value)) {
      update['variants.$.' + key] = variant.value[key];
    }
    ReactionCore.Collections.Products.update(query, {
      $set: update
    }, { validate: false });
  }
}

Import._variants = [];
Import._products = [];
Import._relations = [];
Import._tags = [];
Import._orders = [];

/**
 * @summary Store a product in the import buffer.
 * @param {Object} key A key to look up the product
 * @param {Object} product The product data to be updated
 * @param {Object} parent A key to identify the parent product
 *
 * When processing the import buffer, the product and the parent will be
 * inserted if needed.
 */
Import.product = function (key, product, parent) {
  if (parent) {
    Import._variants.push({ key: key, value: product || {}, parent: parent });
  } else {
    Import._products.push({ key: key, value: product || {} });
  }
}

Import.tag = function (key, tag) {
  Import._tags.push({ key: key, value: tag || {} });
}

Import.image = function (key, image, links) {}

Import.relation = function (key, relation) {}
