import { describe, it, expect } from 'vitest';
import { deletionUpdate, isDeleted, KEPT_ON_DELETE } from './identityDelete';
import Listener from '../../models/listener.schema';

// The schema is the input on purpose: these tests are really asking "does
// deleting an identity still delete all of it", and the only honest source
// for "all of it" is the model.
const schemaPaths = Object.keys(Listener.schema.paths);

describe('deletionUpdate', () => {
  it('covers every path the schema has', () => {
    const update = deletionUpdate(schemaPaths);
    const decided = new Set([...KEPT_ON_DELETE, ...Object.keys(update.$unset)]);
    const missed = schemaPaths.map((p) => p.split('.')[0]).filter((p) => !decided.has(p));
    // A field added to Listener later is deleted by existing, rather than
    // surviving a deletion until somebody remembers to list it here.
    expect(missed).toEqual([]);
  });

  it('keeps the rid and the public key, and nothing else worth keeping', () => {
    const { $unset } = deletionUpdate(schemaPaths);
    // These two are what stop a deletion here from corrupting inboxes
    // elsewhere: messages this identity sent to other rooms are verified
    // against this key, fetched by this rid.
    expect($unset.rid).toBeUndefined();
    expect($unset.pbKey).toBeUndefined();
  });

  it('unsets the things a room is made of', () => {
    const { $unset } = deletionUpdate(schemaPaths);
    for (const field of ['title', 'webhookUrl', 'messages']) {
      expect($unset, field).toHaveProperty(field);
    }
  });

  it('unsets settings and anything bought, when the schema has them', () => {
    // Named conditionally because the open-source line ships a smaller
    // Listener: it has no shop and no accounts, and this file is shared.
    const { $unset } = deletionUpdate(schemaPaths);
    const tops = new Set(schemaPaths.map((p) => p.split('.')[0]));
    for (const field of [
      'voiceEnabled',
      'paused',
      'imagesEnabled',
      'maxMessageLength',
      'ownerAccountId',
      'donosEnabled',
      'payoutMethods',
      'cosmeticsUnlocked',
      'cosmeticsActive',
      'fontHeading'
    ]) {
      if (tops.has(field)) expect($unset, field).toHaveProperty(field);
    }
  });

  it('collapses a subdocument path to its top level', () => {
    const { $unset } = deletionUpdate(['payoutMethods.provider', 'payoutMethods.accountNo']);
    expect($unset).toEqual({ payoutMethods: '' });
  });

  it('stamps the tombstone', () => {
    const now = new Date('2026-09-18T12:00:00.000Z');
    expect(deletionUpdate(schemaPaths, now).$set).toEqual({ deletedAt: now });
  });
});

describe('isDeleted', () => {
  it('reads the tombstone and tolerates everything else', () => {
    expect(isDeleted({ deletedAt: new Date() })).toBe(true);
    expect(isDeleted({ deletedAt: null })).toBe(false);
    expect(isDeleted({})).toBe(false);
    expect(isDeleted(null)).toBe(false);
    expect(isDeleted(undefined)).toBe(false);
  });
});
