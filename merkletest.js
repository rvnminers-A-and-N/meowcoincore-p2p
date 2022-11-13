'use strict';
/* eslint-env es6 */
let Pool = require('meowcoincore-p2p').Pool;
let BloomFilter = require('meowcoincore-p2p').BloomFilter;
let NetworksData = require('meowcoincore-lib').Networks;
let Messages = require('meowcoincore-p2p').Messages;

let network = 'livenet';  // Network can be livenet or testnet
let txs = []; // Here we store the transactions
let filteredBlocks = []; // Here we store the merkleblocks

// Date that we are loocking for
let data = {
  code: 'c8bfdd596435dfcb1387c82567f20e0689436f4e',  // RTaf4sVfX4X2CQFR2s6fatrq92LBo48RjR in hex fromat
  format: 'hex',
};

// Instantciate and connect a node Pool
let pool = new Pool({network: NetworksData[network]});
pool.connect();

// Create a filter and a meowcoin message with the filter
let filter = BloomFilter.create(1000, 0.1).insert(Buffer.from(data.code, data.format));
let filterLoad = new Messages({network: NetworksData[network]}).FilterLoad(filter);

// Create a meowcoin message for require a merkleblock
let blockHashRequested = '000000000002fbc104e2ab07f7fe04c83be0578fdbc59b23e0e51e977cdaa584';
let getDataForFilteredBlock = new Messages({network: NetworksData[network]}).GetData.forFilteredBlock(blockHashRequested);

// Transactions and merkleblock are sent in different messages
pool.on('peertx', function(peer, message) {
  txs.push({
    peer: peer,
    message: message,
  });

  console.log('Recived from: ', peer.host);
  console.log('The transaction: ', message);
});

pool.on('peermerkleblock', function(peer, message) {
  filteredBlocks.push({
    peer: peer,
    message: message,
  });

  console.log('Recived from: ', peer.host);
  console.log('The merkleBlock: ', message);
});

// Wait for pool to connect
setTimeout(function(){
  pool.sendMessage(filterLoad);
  pool.sendMessage(getDataForFilteredBlock);
}, 5000);
