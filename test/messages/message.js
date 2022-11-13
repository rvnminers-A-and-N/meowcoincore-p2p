'use strict';

var should = require('chai').should();
var P2P = require('../../');
var Message = P2P.Messages.Message;
var Networks = require('meowcoincore-lib').Networks;

describe('Message', function() {

  describe('@constructor', function() {
    it('construct with magic number and command', function() {
      var message = new Message({
        network: {
          networkMagic: 0x5241564e
        },
        command: 'command'
      });
      should.exist(message);
      message.command.should.equal('command');
      message.network.networkMagic.should.equal(0x5241564e);
    });
  });

  describe('#toBuffer', function() {
    it('serialize to a buffer', function() {
      var message = new Message({
        command: 'command',
        network: Networks.defaultNetwork
      });
      message.getPayload = function() {
        return Buffer.concat([]);
      };
      var buffer = message.toBuffer();
      var expectedBuffer = Buffer.from('5241564e636f6d6d616e640000000000000000005df6e0e2', 'hex');
      buffer.should.deep.equal(expectedBuffer);
    });
  });

});
