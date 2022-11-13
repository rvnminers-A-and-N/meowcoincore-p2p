'use strict';

var spec = {
  name: 'P2P',
  message: 'Internal Error on meowcoincore-p2p Module {0}'
};

module.exports = require('meowcoincore-lib').errors.extend(spec);
