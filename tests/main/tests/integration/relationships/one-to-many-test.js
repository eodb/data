import { module, test } from 'qunit';

import { setupTest } from 'ember-qunit';

import Adapter from '@ember-data/adapter';
import Model, { attr, belongsTo, hasMany } from '@ember-data/model';
import JSONAPISerializer from '@ember-data/serializer/json-api';

module('integration/relationships/one_to_many_test - OneToMany relationships', function (hooks) {
  setupTest(hooks);

  hooks.beforeEach(function () {
    const User = Model.extend({
      name: attr('string'),
      messages: hasMany('message', { async: true, inverse: 'user' }),
      accounts: hasMany('account', { async: false, inverse: 'user' }),
    });

    const Account = Model.extend({
      state: attr(),
      user: belongsTo('user', { async: false, inverse: 'accounts' }),
    });

    const Message = Model.extend({
      title: attr('string'),
      user: belongsTo('user', { async: true, inverse: 'messages' }),
    });

    const ApplicationAdapter = Adapter.extend({
      deleteRecord: () => Promise.resolve(),
    });

    this.owner.register('model:user', User);
    this.owner.register('model:message', Message);
    this.owner.register('model:account', Account);

    this.owner.register('adapter:application', ApplicationAdapter);
    this.owner.register('serializer:application', class extends JSONAPISerializer {});
  });

  /*
    Server loading tests
  */

  test('Relationship is available from the belongsTo side even if only loaded from the hasMany side - async', async function (assert) {
    let store = this.owner.lookup('service:store');

    var user, message;
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          messages: {
            data: [
              {
                id: '2',
                type: 'message',
              },
            ],
          },
        },
      },
    });
    message = store.push({
      data: {
        id: '2',
        type: 'message',
        attributes: {
          title: 'EmberFest was great',
        },
      },
    });
    await message.user.then(function (fetchedUser) {
      assert.strictEqual(fetchedUser, user, 'User relationship was set up correctly');
    });
  });

  test("Adapter's findBelongsTo must not be hit when the record is included with its owner", async function (assert) {
    let store = this.owner.lookup('service:store');
    assert.expect(1);

    this.owner.register(
      'adapter:message',
      Adapter.extend({
        findBelongsTo() {
          assert.ok(false, 'We should not call adapter.findBelongsTo since the owner is already loaded');
        },
      })
    );

    const user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          messages: {
            links: {
              self: 'users/1/relationships/messages',
              related: 'users/1/posts',
            },
            data: [
              {
                id: '2',
                type: 'message',
              },
            ],
          },
        },
      },
      included: [
        {
          id: '2',
          type: 'message',
          attributes: {
            title: 'EmberFest was great',
          },
          relationships: {
            user: {
              links: {
                self: 'messages/1/relationships/user',
                related: 'messages/1/author',
              },
            },
          },
        },
      ],
    });
    const messages = await user.messages;
    const messageUser = await messages.at(0).user;
    assert.strictEqual(messageUser, user, 'User relationship was set up correctly');
  });

  test('Relationship is available from the belongsTo side even if only loaded from the hasMany side - sync', function (assert) {
    let store = this.owner.lookup('service:store');

    var account, user;
    account = store.push({
      data: {
        id: '2',
        type: 'account',
        attributes: {
          state: 'lonely',
        },
      },
    });
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          accounts: {
            data: [
              {
                id: '2',
                type: 'account',
              },
            ],
          },
        },
      },
    });
    assert.strictEqual(account.user, user, 'User relationship was set up correctly');
  });

  test('Relationship is available from the hasMany side even if only loaded from the belongsTo side - async', async function (assert) {
    let store = this.owner.lookup('service:store');

    var user, message;
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
      },
    });
    message = store.push({
      data: {
        id: '2',
        type: 'message',
        attributes: {
          title: 'EmberFest was great',
        },
        relationships: {
          user: {
            data: {
              id: '1',
              type: 'user',
            },
          },
        },
      },
    });
    await user.messages.then(function (fetchedMessages) {
      assert.strictEqual(fetchedMessages.at(0), message, 'Messages relationship was set up correctly');
    });
  });

  test('Relationship is available from the hasMany side even if only loaded from the belongsTo side - sync', function (assert) {
    let store = this.owner.lookup('service:store');

    var user, account;
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
      },
    });
    account = store.push({
      data: {
        id: '2',
        type: 'account',
        attributes: {
          state: 'lonely',
        },
        relationships: {
          user: {
            data: {
              id: '1',
              type: 'user',
            },
          },
        },
      },
    });
    assert.strictEqual(user.accounts.at(0), account, 'Accounts relationship was set up correctly');
  });

  test('Fetching a belongsTo that is set to null removes the record from a relationship - async', async function (assert) {
    let store = this.owner.lookup('service:store');

    const user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          messages: {
            data: [
              {
                id: '1',
                type: 'message',
              },
              {
                id: '2',
                type: 'message',
              },
            ],
          },
        },
      },
    });
    store.push({
      data: [
        {
          id: '1',
          type: 'message',
          attributes: {
            title: 'EmberFest was great',
          },
          relationships: {
            user: {
              data: {
                id: '1',
                type: 'user',
              },
            },
          },
        },
        {
          id: '2',
          type: 'message',
          attributes: {
            title: 'EmberConf will be better',
          },
          relationships: {
            user: {
              data: null,
            },
          },
        },
      ],
    });
    await user.messages.then(function (fetchedMessages) {
      assert.strictEqual(fetchedMessages.length, 1, 'Messages relationship was set up correctly');
    });
  });

  test('Fetching a belongsTo that is set to null removes the record from a relationship - sync', function (assert) {
    let store = this.owner.lookup('service:store');

    var user;
    store.push({
      data: {
        id: '2',
        type: 'account',
        attributes: {
          state: 'lonely',
        },
      },
    });

    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          accounts: {
            data: [
              {
                id: '2',
                type: 'account',
              },
            ],
          },
        },
      },
    });

    store.push({
      data: {
        id: '2',
        type: 'account',
        attributes: {
          state: 'lonely',
        },
        relationships: {
          user: {
            data: null,
          },
        },
      },
    });

    assert.strictEqual(user.accounts.at(0), undefined, 'Account was sucesfully removed');
  });

  test('Fetching a belongsTo that is not defined does not remove the record from a relationship - async', async function (assert) {
    let store = this.owner.lookup('service:store');

    var user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          messages: {
            data: [
              {
                id: '1',
                type: 'message',
              },
              {
                id: '2',
                type: 'message',
              },
            ],
          },
        },
      },
    });
    store.push({
      data: [
        {
          id: '1',
          type: 'message',
          attributes: {
            title: 'EmberFest was great',
          },
          relationships: {
            user: {
              data: {
                id: '1',
                type: 'user',
              },
            },
          },
        },
        {
          id: '2',
          type: 'message',
          attributes: {
            title: 'EmberConf will be better',
          },
        },
      ],
    });
    await user.messages.then(function (fetchedMessages) {
      assert.strictEqual(fetchedMessages.length, 2, 'Messages relationship was set up correctly');
    });
  });

  test('Fetching a belongsTo that is not defined does not remove the record from a relationship - sync', function (assert) {
    let store = this.owner.lookup('service:store');

    var account, user;
    account = store.push({
      data: {
        id: '2',
        type: 'account',
        attributes: {
          state: 'lonely',
        },
      },
    });
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          accounts: {
            data: [
              {
                id: '2',
                type: 'account',
              },
            ],
          },
        },
      },
    });
    account = store.push({
      data: {
        id: '2',
        type: 'account',
        attributes: {
          state: 'lonely',
        },
      },
    });

    assert.strictEqual(user.accounts.at(0), account, 'Account was sucesfully removed');
  });

  test("Fetching the hasMany that doesn't contain the belongsTo, sets the belongsTo to null - async", async function (assert) {
    let store = this.owner.lookup('service:store');

    let user, message, message2;
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          messages: {
            data: [
              {
                id: '1',
                type: 'message',
              },
            ],
          },
        },
      },
    });
    message = store.push({
      data: {
        id: '1',
        type: 'message',
        attributes: {
          title: 'EmberFest was great',
        },
        relationships: {
          user: {
            data: {
              id: '1',
              type: 'user',
            },
          },
        },
      },
    });
    message2 = store.push({
      data: {
        id: '2',
        type: 'message',
        attributes: {
          title: 'EmberConf is gonna be better',
        },
      },
    });
    store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          messages: {
            data: [
              {
                id: '2',
                type: 'message',
              },
            ],
          },
        },
      },
    });
    await message.user.then(function (fetchedUser) {
      assert.strictEqual(fetchedUser, null, 'User was removed correctly');
    });

    await message2.user.then(function (fetchedUser) {
      assert.strictEqual(fetchedUser, user, 'User was set on the second message');
    });
  });

  test("Fetching the hasMany that doesn't contain the belongsTo, sets the belongsTo to null - sync", function (assert) {
    let store = this.owner.lookup('service:store');

    let account1;
    let account2;
    let user;

    // tell the store user:1 has account:1
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          accounts: {
            data: [{ id: '1', type: 'account' }],
          },
        },
      },
    });

    // tell the store account:1 has user:1
    account1 = store.push({
      data: {
        id: '1',
        type: 'account',
        attributes: {
          state: 'great',
        },
        relationships: {
          user: {
            data: { id: '1', type: 'user' },
          },
        },
      },
    });

    // tell the store account:2 has no user
    account2 = store.push({
      data: {
        id: '2',
        type: 'account',
        attributes: {
          state: 'awesome',
        },
      },
    });

    // tell the store user:1 has account:2 and not account:1
    store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          accounts: {
            data: [{ id: '2', type: 'account' }],
          },
        },
      },
    });

    assert.strictEqual(account1.user, null, 'User was removed correctly');
    assert.strictEqual(account2.user, user, 'User was added correctly');
  });

  test('Fetching the hasMany side where the hasMany is undefined does not change the belongsTo side - async', async function (assert) {
    let store = this.owner.lookup('service:store');

    var message, user;
    store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          messages: {
            data: [
              {
                id: '1',
                type: 'message',
              },
            ],
          },
        },
      },
    });
    message = store.push({
      data: {
        id: '1',
        type: 'message',
        attributes: {
          title: 'EmberFest was great',
        },
        relationships: {
          user: {
            data: {
              id: '1',
              type: 'user',
            },
          },
        },
      },
    });
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
      },
    });

    await message.user.then(function (fetchedUser) {
      assert.strictEqual(fetchedUser, user, 'User was not removed');
    });
  });

  test('Fetching the hasMany side where the hasMany is undefined does not change the belongsTo side - sync', function (assert) {
    let store = this.owner.lookup('service:store');

    var account, user;
    store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          accounts: {
            data: [
              {
                id: '1',
                type: 'account',
              },
            ],
          },
        },
      },
    });
    account = store.push({
      data: {
        id: '1',
        type: 'account',
        attributes: {
          state: 'great',
        },
        relationships: {
          user: {
            data: {
              id: '1',
              type: 'user',
            },
          },
        },
      },
    });
    store.push({
      data: {
        id: '2',
        type: 'account',
        attributes: {
          state: 'awesome',
        },
      },
    });
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
      },
    });

    assert.strictEqual(account.user, user, 'User was not removed');
  });

  /*
    Local edits
  */

  test('Pushing to the hasMany reflects the change on the belongsTo side - async', async function (assert) {
    let store = this.owner.lookup('service:store');

    let user, message2;
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          messages: {
            data: [
              {
                id: '1',
                type: 'message',
              },
            ],
          },
        },
      },
    });
    store.push({
      data: {
        id: '1',
        type: 'message',
        attributes: {
          title: 'EmberFest was great',
        },
      },
    });
    message2 = store.push({
      data: {
        id: '2',
        type: 'message',
        attributes: {
          title: 'EmberFest was great',
        },
      },
    });

    await user.messages.then(async function (fetchedMessages) {
      fetchedMessages.push(message2);
      await message2.user.then(function (fetchedUser) {
        assert.strictEqual(fetchedUser, user, 'user got set correctly');
      });
    });
  });

  test('Pushing to the hasMany reflects the change on the belongsTo side - sync', function (assert) {
    let store = this.owner.lookup('service:store');

    var user, account2;
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          accounts: {
            data: [
              {
                id: '1',
                type: 'account',
              },
            ],
          },
        },
      },
    });
    store.push({
      data: {
        id: '1',
        type: 'account',
        attributes: {
          state: 'great',
        },
        relationships: {
          user: {
            data: {
              id: '1',
              type: 'user',
            },
          },
        },
      },
    });

    account2 = store.push({
      data: {
        id: '2',
        type: 'account',
        attributes: {
          state: 'awesome',
        },
      },
    });
    user.accounts.push(account2);

    assert.strictEqual(account2.user, user, 'user got set correctly');
  });

  test('Removing from the hasMany side reflects the change on the belongsTo side - async', async function (assert) {
    let store = this.owner.lookup('service:store');

    let user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          messages: {
            data: [
              {
                id: '1',
                type: 'message',
              },
            ],
          },
        },
      },
    });
    let message = store.push({
      data: {
        id: '1',
        type: 'message',
        attributes: {
          title: 'EmberFest was great',
        },
      },
    });

    const fetchedMessages = await user.messages;
    fetchedMessages.splice(fetchedMessages.indexOf(message), 1);
    const fetchedUser = await message.user;
    assert.strictEqual(fetchedUser, null, 'user got removed correctly');
  });

  test('Removing from the hasMany side reflects the change on the belongsTo side - sync', function (assert) {
    let store = this.owner.lookup('service:store');
    let user = store.push({
      data: {
        id: '1',
        type: 'user',
        attirbutes: {
          name: 'Stanley',
        },
        relationships: {
          accounts: {
            data: [
              {
                id: '1',
                type: 'account',
              },
            ],
          },
        },
      },
    });
    let account = store.push({
      data: {
        id: '1',
        type: 'account',
        attirbutes: {
          state: 'great',
        },
        relationships: {
          user: {
            data: {
              id: '1',
              type: 'user',
            },
          },
        },
      },
    });
    user.accounts.splice(user.accounts.indexOf(account), 1);

    assert.strictEqual(account.user, null, 'user got removed correctly');
  });

  test('Pushing to the hasMany side keeps the oneToMany invariant on the belongsTo side - async', async function (assert) {
    assert.expect(2);

    let store = this.owner.lookup('service:store');

    var user, user2, message;
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          messages: {
            data: [
              {
                id: '1',
                type: 'message',
              },
            ],
          },
        },
      },
    });
    user2 = store.push({
      data: {
        id: '2',
        type: 'user',
        attributes: {
          name: 'Tomhuda',
        },
      },
    });
    message = store.push({
      data: {
        id: '1',
        type: 'message',
        attributes: {
          title: 'EmberFest was great',
        },
      },
    });

    await user2.messages.then(async function (fetchedMessages) {
      fetchedMessages.push(message);

      let p1 = message.user.then(function (fetchedUser) {
        assert.strictEqual(fetchedUser, user2, 'user got set correctly');
      });

      let p2 = user.messages.then(function (newFetchedMessages) {
        assert.strictEqual(newFetchedMessages.length, 0, 'message got removed from the old messages hasMany');
      });

      await Promise.allSettled([p1, p2]);
    });
  });

  test('Pushing to the hasMany side keeps the oneToMany invariant - sync', function (assert) {
    let store = this.owner.lookup('service:store');

    var user, user2, account;
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          accounts: {
            data: [
              {
                id: '1',
                type: 'account',
              },
            ],
          },
        },
      },
    });
    user2 = store.push({
      data: {
        id: '2',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
      },
    });
    account = store.push({
      data: {
        id: '1',
        type: 'account',
        attributes: {
          state: 'great',
        },
      },
    });
    user2.accounts.push(account);
    assert.strictEqual(account.user, user2, 'user got set correctly');
    assert.strictEqual(user.accounts.length, 0, 'the account got removed correctly');
    assert.strictEqual(user2.accounts.length, 1, 'the account got pushed correctly');
  });

  test('Setting the belongsTo side keeps the oneToMany invariant on the hasMany- async', async function (assert) {
    assert.expect(2);

    let store = this.owner.lookup('service:store');

    var user, user2, message;
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          messages: {
            data: [
              {
                id: '1',
                type: 'message',
              },
            ],
          },
        },
      },
    });
    user2 = store.push({
      data: {
        id: '2',
        type: 'user',
        attributes: {
          name: 'Tomhuda',
        },
      },
    });
    message = store.push({
      data: {
        id: '1',
        type: 'message',
        attributes: {
          title: 'EmberFest was great',
        },
        relationships: {
          user: {
            data: {
              id: '1',
              type: 'user',
            },
          },
        },
      },
    });
    message.set('user', user2);

    await user.messages.then(function (fetchedMessages) {
      assert.strictEqual(fetchedMessages.length, 0, 'message got removed from the first user correctly');
    });
    await user2.messages.then(function (fetchedMessages) {
      assert.strictEqual(fetchedMessages.length, 1, 'message got added to the second user correctly');
    });
  });

  test('Setting the belongsTo side keeps the oneToMany invariant on the hasMany- sync', function (assert) {
    let store = this.owner.lookup('service:store');

    var user, user2, account;
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          accounts: {
            data: [
              {
                id: '1',
                type: 'account',
              },
            ],
          },
        },
      },
    });
    user2 = store.push({
      data: {
        id: '2',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
      },
    });
    account = store.push({
      data: {
        id: '1',
        type: 'account',
        attributes: {
          state: 'great',
        },
        relationships: {
          user: {
            data: {
              id: '1',
              type: 'user',
            },
          },
        },
      },
    });
    account.set('user', user2);
    assert.strictEqual(account.user, user2, 'user got set correctly');
    assert.strictEqual(user.accounts.length, 0, 'the account got removed correctly');
    assert.strictEqual(user2.accounts.length, 1, 'the account got pushed correctly');
  });

  test('Setting the belongsTo side to null removes the record from the hasMany side - async', async function (assert) {
    assert.expect(2);

    let store = this.owner.lookup('service:store');

    var user, message;
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          messages: {
            data: [
              {
                id: '1',
                type: 'message',
              },
            ],
          },
        },
      },
    });
    message = store.push({
      data: {
        id: '1',
        type: 'message',
        attributes: {
          title: 'EmberFest was great',
        },
        relationships: {
          user: {
            data: {
              id: '1',
              type: 'user',
            },
          },
        },
      },
    });
    message.set('user', null);

    await user.messages.then(function (fetchedMessages) {
      assert.strictEqual(fetchedMessages.length, 0, 'message got removed from the  user correctly');
    });
    await message.user.then(function (fetchedUser) {
      assert.strictEqual(fetchedUser, null, 'user got set to null correctly');
    });
  });

  test('Setting the belongsTo side to null removes the record from the hasMany side - sync', function (assert) {
    let store = this.owner.lookup('service:store');

    var user, account;
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          accounts: {
            data: [
              {
                id: '1',
                type: 'account',
              },
            ],
          },
        },
      },
    });
    account = store.push({
      data: {
        id: '1',
        type: 'account',
        attributes: {
          state: 'great',
        },
        relationships: {
          user: {
            data: {
              id: '1',
              type: 'user',
            },
          },
        },
      },
    });
    account.set('user', null);

    assert.strictEqual(account.user, null, 'user got set to null correctly');

    assert.strictEqual(user.accounts.length, 0, 'the account got removed correctly');
  });

  /*
  Rollback attributes from deleted state
  */

  test('Rollbacking attributes of a deleted record works correctly when the hasMany side has been deleted - async', async function (assert) {
    let store = this.owner.lookup('service:store');

    var user, message;
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          messages: {
            data: [
              {
                id: '2',
                type: 'message',
              },
            ],
          },
        },
      },
    });
    message = store.push({
      data: {
        id: '2',
        type: 'message',
        attributes: {
          title: 'EmberFest was great',
        },
      },
    });

    message.deleteRecord();
    message.rollbackAttributes();

    await message.user.then(function (fetchedUser) {
      assert.strictEqual(fetchedUser, user, 'Message still has the user');
    });
    await user.messages.then(function (fetchedMessages) {
      assert.strictEqual(fetchedMessages.at(0), message, 'User has the message');
    });
  });

  test('Rollbacking attributes of a deleted record works correctly when the hasMany side has been deleted - sync', function (assert) {
    let store = this.owner.lookup('service:store');

    var account, user;
    account = store.push({
      data: {
        id: '2',
        type: 'account',
        attributes: {
          state: 'lonely',
        },
      },
    });
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          accounts: {
            data: [
              {
                id: '2',
                type: 'account',
              },
            ],
          },
        },
      },
    });
    account.deleteRecord();
    account.rollbackAttributes();
    assert.strictEqual(user.accounts.length, 1, 'Accounts are rolled back');
    assert.strictEqual(account.user, user, 'Account still has the user');
  });

  test('Rollbacking attributes of deleted record works correctly when the belongsTo side has been deleted - async', async function (assert) {
    let store = this.owner.lookup('service:store');

    var user, message;
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          messages: {
            data: [
              {
                id: '2',
                type: 'message',
              },
            ],
          },
        },
      },
    });
    message = store.push({
      data: {
        id: '2',
        type: 'message',
        attributes: {
          title: 'EmberFest was great',
        },
      },
    });
    user.deleteRecord();
    user.rollbackAttributes();
    await message.user.then(function (fetchedUser) {
      assert.strictEqual(fetchedUser, user, 'Message has the user again');
    });
    await user.messages.then(function (fetchedMessages) {
      assert.strictEqual(fetchedMessages.length, 1, 'User still has the messages');
    });
  });

  test('Rollbacking attributes of a deleted record works correctly when the belongsTo side has been deleted - sync', function (assert) {
    let store = this.owner.lookup('service:store');

    var account, user;
    account = store.push({
      data: {
        id: '2',
        type: 'account',
        attributes: {
          state: 'lonely',
        },
      },
    });
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
        relationships: {
          accounts: {
            data: [
              {
                id: '2',
                type: 'account',
              },
            ],
          },
        },
      },
    });
    user.deleteRecord();
    user.rollbackAttributes();
    assert.strictEqual(user.accounts.length, 1, 'User still has the accounts');
    assert.strictEqual(account.user, user, 'Account has the user again');
  });

  /*
  Rollback attributes from created state
  */

  test('Rollbacking attributes of a created record works correctly when the hasMany side has been created - async', async function (assert) {
    let store = this.owner.lookup('service:store');
    let user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
      },
    });
    let message = store.createRecord('message', {
      user: user,
    });

    message.rollbackAttributes();

    let fetchedUser = await message.user;
    assert.strictEqual(fetchedUser, null, 'Message does not have the user anymore');
    let fetchedMessages = await user.messages;

    assert.strictEqual(fetchedMessages.length, 0, 'User does not have the message anymore');
    assert.strictEqual(fetchedMessages.at(0), undefined, "User message can't be accessed");
  });

  test('Rollbacking attributes of a created record works correctly when the hasMany side has been created - sync', function (assert) {
    let store = this.owner.lookup('service:store');

    var user, account;
    user = store.push({
      data: {
        id: '1',
        type: 'user',
        attributes: {
          name: 'Stanley',
        },
      },
    });
    account = store.createRecord('account', {
      user: user,
    });
    account.rollbackAttributes();
    assert.strictEqual(user.accounts.length, 0, 'Accounts are rolled back');
    assert.strictEqual(account.user, null, 'Account does not have the user anymore');
  });

  test('Rollbacking attributes of a created record works correctly when the belongsTo side has been created - async', async function (assert) {
    let store = this.owner.lookup('service:store');
    let message = store.push({
      data: {
        id: '2',
        type: 'message',
        attributes: {
          title: 'EmberFest was great',
        },
      },
    });
    let user = store.createRecord('user');
    let messages = await user.messages;
    messages.push(message);
    user.rollbackAttributes();
    let fetchedUser = await message.user;
    assert.strictEqual(fetchedUser, null, 'Message does not have the user anymore');

    let fetchedMessages = await user.messages;
    assert.strictEqual(fetchedMessages.length, 0, 'User does not have the message anymore');
    assert.strictEqual(fetchedMessages.at(0), undefined, "User message can't be accessed");
  });

  test('Rollbacking attributes of a created record works correctly when the belongsTo side has been created - sync', function (assert) {
    let store = this.owner.lookup('service:store');

    var account, user;
    account = store.push({
      data: {
        id: '2',
        type: 'account',
        attributes: {
          state: 'lonely',
        },
      },
    });
    user = store.createRecord('user');
    user.accounts.push(account);
    user.rollbackAttributes();
    assert.strictEqual(user.accounts.length, 0, 'User does not have the account anymore');
    assert.strictEqual(account.user, null, 'Account does not have the user anymore');
  });
});
