import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAuth} from '../src/auth.js';
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const token='a'.repeat(64),user={id:'one',name:'Name',email:'private@example.test'};
const response=(value,status=200)=>new Response(JSON.stringify(value),{status});
test('persistent auth survives a new instance, accepts no expiry and stores no profile/password',async()=>{
 const storage=memory(),legacyStorage=memory();let revoked=false;
 const fetch=async url=>url.endsWith('/login')?response({token,expiresAt:null,user}):url.endsWith('/logout')?(revoked=true,response({ok:true})):revoked?response({error:'Revoked'},401):response({user,expiresAt:null});
 const options={id:'long-auth',baseUrl:'https://api.example.test',persistence:'persistent',storage,legacyStorage,fetch};
 await createAuth(options).login({email:user.email,password:'A private password'});
 assert.deepEqual(JSON.parse(storage.getItem('long-auth:auth')),{token,expiresAt:null});
 const reopened=createAuth(options);assert.equal(reopened.getToken(),token);await reopened.restore();assert.equal(reopened.state.get().user.id,user.id);
 await reopened.logout();assert.equal(storage.getItem('long-auth:auth'),null);assert.equal(legacyStorage.getItem('long-auth:auth'),null);assert.equal(createAuth(options).getToken(),null);
});
test('legacy tab sessions migrate once and server expiry changes are persisted',async()=>{
 const storage=memory(),legacyStorage=memory();legacyStorage.setItem('long-auth:auth',JSON.stringify({token,expiresAt:'2099-01-01'}));
 const auth=createAuth({id:'long-auth',baseUrl:'https://api.example.test',persistence:'persistent',storage,legacyStorage,fetch:async()=>response({user,expiresAt:null})});
 assert.equal(auth.getToken(),token);assert.equal(legacyStorage.getItem('long-auth:auth'),null);await auth.restore();assert.equal(JSON.parse(storage.getItem('long-auth:auth')).expiresAt,null);
});
test('revoked permanent sessions clear persistence and missing expiry never becomes permanent',async()=>{
 const storage=memory();storage.setItem('long-auth:auth',JSON.stringify({token,expiresAt:null}));
 const auth=createAuth({id:'long-auth',baseUrl:'https://api.example.test',persistence:'persistent',storage,fetch:async()=>response({error:'Revoked'},401)});await assert.rejects(auth.restore());assert.equal(storage.getItem('long-auth:auth'),null);assert.equal(auth.state.get().authenticated,false);
 for(const expiresAt of [undefined,'invalid','2001-01-01']){storage.setItem('bad-auth:auth',JSON.stringify({token,expiresAt}));assert.equal(createAuth({id:'bad-auth',baseUrl:'https://api.example.test',storage}).getToken(),null);}
});
