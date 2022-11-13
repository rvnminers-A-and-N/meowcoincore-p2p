'use strict';

var chai = require('chai');

/* eslint-disable no-unused-vars */
var should = chai.should();
var sinon = require('sinon');

var meowcoincore = require('meowcoincore-lib');
var _ = meowcoincore.deps._;
var Random = meowcoincore.crypto.Random;
var BN = meowcoincore.crypto.BN;
var BufferUtil = meowcoincore.util.buffer;
var p2p = require('..');
var Peer = p2p.Peer;
var Pool = p2p.Pool;
var Networks = meowcoincore.Networks;
var Messages = p2p.Messages;
var Inventory = p2p.Inventory;
var Block = meowcoincore.Block;
var Transaction = meowcoincore.Transaction;

// config
var network = process.env.NETWORK === 'testnet' ? Networks.testnet : Networks.livenet;
var messages = new Messages({
  network: network
});
var blockHash = {
  'livenet': '000000000001b004a3abc383ed81fdb2ce6d6f72f34a8888a80e325724ea8f4f',
  'testnet': '000000015e649acb3b2abbf8ecbea831af5852ee7ef1a031b32492af64f743ac'
};
var stopBlock = {
  'livenet': '0000000000013c3233f58924530cee2140bcf2fec695988e18ce0aeb7a9b51c8',
  'testnet': '0000000cc829f9a78613d0d9eb8c49be322242391a1c8b305a4ad26f46feee55'
};
var txHash = {
  'livenet': '8f104a0c9745eb0161f54bca2cea753ac79191308c803c4fcfd8813e749de66a',
  'testnet': 'd43a65843bce4fc59492bce49d77898e6d95a75eaed0e8f630062430936d3481'
};

// These tests require a running meowcoind instance
describe('Integration with ' + network.name + ' meowcoind', function() {

  this.timeout(15000);
  var opts = {
    host: 'localhost',
    network: network.name
  };
  it('handshakes', function(cb) {
    var peer = new Peer(opts);
    peer.once('version', function(m) {
      m.version.should.be.above(70000);
      m.services.toString().should.equal('1');
      Math.abs(new Date() - m.timestamp).should.be.below(10000); // less than 10 seconds of time difference
      m.nonce.length.should.equal(8);
      m.startHeight.should.be.above(300000);
      cb();
    });
    peer.once('verack', function(m) {
      should.exist(m);
      m.command.should.equal('verack');
    });
    peer.connect();
  });
  var connect = function(cb) {
    var peer = new Peer(opts);
    peer.once('ready', function() {
      cb(peer);
    });
    peer.once('error', function(err) {
      should.not.exist(err);
    });
    peer.connect();
  };
  it('connects', function(cb) {
    connect(function(peer) {
      peer.version.should.be.above(70000);
      _.isString(peer.subversion).should.equal(true);
      _.isNumber(peer.bestHeight).should.equal(true);
      cb();
    });
  });
  it('handles inv', function(cb) {
    // assumes there will be at least one transaction/block
    // in the next few seconds
    connect(function(peer) {
      peer.once('inv', function(message) {
        message.inventory[0].hash.length.should.equal(32);
        cb();
      });
    });
  });
  it('handles addr', function(cb) {
    connect(function(peer) {
      peer.once('addr', function(message) {
        message.addresses.forEach(function(address) {
          (address.time instanceof Date).should.equal(true);
          should.exist(address.ip);
          (address.services instanceof BN).should.equal(true);
        });
        cb();
      });
      var message = messages.GetAddr();
      peer.sendMessage(message);
    });
  });
  it('requests inv detailed info', function(cb) {
    connect(function(peer) {
      peer.once('block', function(message) {
        should.exist(message.block);
        cb();
      });
      peer.once('tx', function(message) {
        should.exist(message.transaction);
        cb();
      });
      peer.once('inv', function(message) {
        var get = messages.GetData(message.inventory);
        peer.sendMessage(get);
      });
    });
  });
  it('sends tx inv and receives getdata for that tx', function(cb) {
    connect(function(peer) {
      var type = Inventory.TYPE.TX;
      var inv = [{
        type: type,
        hash: Buffer.from(Random.getRandomBuffer(32)) // needs to be random for repeatability
      }];
      peer.once('getdata', function(message) {
        message.inventory[0].should.deep.equal(inv[0]);
        cb();
      });
      var message = messages.Inventory(inv);
      message.inventory[0].hash.length.should.equal(32);
      peer.sendMessage(message);
    });
  });
  it('requests block data', function(cb) {
    connect(function(peer) {
      peer.once('block', function(message) {
        (message.block instanceof Block).should.equal(true);
        cb();
      });
      var message = messages.GetData.forBlock(blockHash[network.name]);
      peer.sendMessage(message);
    });
  });
  var fakeHash = 'e2dfb8afe1575bfacae1a0b4afc49af7ddda69285857267bae0e22be15f74a3a';
  it('handles request tx data not found', function(cb) {
    connect(function(peer) {
      var expected = messages.NotFound.forTransaction(fakeHash);
      peer.once('notfound', function(message) {
        message.command.should.equal('notfound');
        message.inventory[0].type.should.equal(Inventory.TYPE.TX);
        var expectedHash = expected.inventory[0].hash.toString('hex');
        message.inventory[0].hash.toString('hex').should.equal(expectedHash);
        cb();
      });
      var message = messages.GetData.forTransaction(fakeHash);
      peer.sendMessage(message);
    });
  });
  var from = [blockHash[network.name]];
  var stop = stopBlock[network.name];
  it('gets headers', function(cb) {
    connect(function(peer) {
      peer.once('headers', function(message) {
        message.command.should.equal('headers');
        message.headers.length.should.equal(3);
        cb();
      });
      var message = messages.GetHeaders({
        starts: from,
        stop: stop
      });
      peer.sendMessage(message);
    });
  });
  it('gets blocks', function(cb) {
    connect(function(peer) {
      peer.once('inv', function(message) {
        message.command.should.equal('inv');
        if (message.inventory.length === 2) {
          message.inventory[0].type.should.equal(Inventory.TYPE.BLOCK);
          message.inventory[1].type.should.equal(Inventory.TYPE.BLOCK);
          cb();
        }
      });
      var message = messages.GetBlocks({
        starts: from,
        stop: stop
      });
      peer.sendMessage(message);
    });
  });
  var testInvGetData = function(expected, message, cb) {
    connect(function(peer) {
      peer.once('getdata', function(message) {
        message.command.should.equal('getdata');
        message.inventory[0].type.should.equal(expected.inventory[0].type);
        var expectedHash = expected.inventory[0].hash.toString('hex');
        message.inventory[0].hash.toString('hex').should.equal(expectedHash);
        cb();
      });
      peer.sendMessage(message);
    });
  };
  it('sends block inv and receives getdata', function(cb) {
    var randomHash = Buffer.from(Random.getRandomBuffer(32)); // slow buffer
    var expected = messages.GetData.forBlock(randomHash);
    var message = messages.Inventory.forBlock(randomHash);
    testInvGetData(expected, message, cb);
  });
  it('sends tx inv and receives getdata', function(cb) {
    var randomHash = Buffer.from(Random.getRandomBuffer(32)); // slow buffer
    var expected = messages.GetData.forTransaction(randomHash);
    var message = messages.Inventory.forTransaction(randomHash);
    testInvGetData(expected, message, cb);
  });
});
