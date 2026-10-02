import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diceCollection } from '../../client/src/customizeCollection.js';
import { encodeDiceCustomization, DEFAULT_DICE_CUSTOMIZATION } from '../../client/src/diceCustomization.js';
const user={id:1,email:'example@example.invalid',display_name:'Example',diceTheme:'first-flame'};
test('collection never infers Mythic ownership from an equipped theme or title',()=>{
const items=diceCollection({items:[],equipped:{},ownedDiceThemes:[]},[],{...user,relicOwner:true});
assert.equal(items.filter(i=>i.rarity==='mythic').length,0);assert.equal(items.filter(i=>i.rarity==='starter').length,12);
});
test('collection lists exact earned dice and saved designs without duplicating equipped custom dice',()=>{
const theme=encodeDiceCustomization(DEFAULT_DICE_CUSTOMIZATION);const preset={id:7,name:'Mine',theme};
const items=diceCollection({items:[],equipped:{},ownedDiceThemes:['prismatic-echo']},[preset],{...user,diceTheme:theme});
assert.deepEqual(items.filter(i=>i.rarity==='mythic').map(i=>i.theme),['prismatic-echo']);assert.equal(items.filter(i=>i.rarity==='custom').length,1);assert.equal(items.find(i=>i.id==='preset-7')?.preset?.id,7);
});
test('deleting an equipped preset leaves the current custom appearance discoverable',()=>{
const theme=encodeDiceCustomization(DEFAULT_DICE_CUSTOMIZATION);const items=diceCollection(null,[],{...user,diceTheme:theme});assert.equal(items.find(i=>i.id==='current-custom')?.theme,theme);
});
