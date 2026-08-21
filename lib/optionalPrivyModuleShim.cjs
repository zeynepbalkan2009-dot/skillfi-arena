"use strict";

const noop = function optionalPrivyModuleShim() {
  return undefined;
};

module.exports = new Proxy(noop, {
  get(_target, prop) {
    if (prop === "__esModule") return true;
    if (prop === "default") return module.exports;
    return noop;
  },
  apply() {
    return undefined;
  },
  construct() {
    return {};
  },
});
