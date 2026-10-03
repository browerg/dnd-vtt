import assert from 'node:assert/strict';
import { test } from 'node:test';
import { COSMETICS, isCacheExclusive, equipAllowed } from './shopCatalog.js';
import { CACHE_COST, CACHE_REWARDS } from './vividCacheStore.js';

test('all purchasable cosmetics follow the rarity economy; only Mythics require spins', () => {
 const prices = {starter:0, uncommon:100, rare:250, epic:500, legendary:1000};
 assert.equal(CACHE_COST,250);
 for (const item of COSMETICS) {
  if(item.rarity === 'mythic') {
   assert.equal(isCacheExclusive(item),true,item.id);
   assert.equal(equipAllowed(item,true,false),false,item.id);
   assert.equal(equipAllowed({...item,price:0},true,false),false,'free price cannot bypass Mythic ownership');
   assert.equal(equipAllowed(item,false,true),true,item.id);
   assert.ok(CACHE_REWARDS.some(reward=>reward.unlockIds.includes(item.id)),`${item.id} must be obtainable from a spin`);
  } else {
   assert.equal(item.price,prices[item.rarity],item.id);
   assert.equal(isCacheExclusive(item),false,item.id);
  }
 }
});
