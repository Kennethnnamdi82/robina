import mongoose from 'mongoose';
const oid = mongoose.Schema.Types.ObjectId;
const money = {type:Number,required:true,min:0,max:1000000,validate:Number.isSafeInteger};
const orderSchema = new mongoose.Schema({
  playerId:{type:oid,ref:'User',required:true,index:true}, key:{type:String,required:true,maxlength:100},
  sku:{type:String,required:true}, version:{type:Number,required:true}, name:{type:String,required:true},
  cents:money,currency:{type:String,enum:['USD'],default:'USD'},kind:{type:String,required:true},quantity:{type:Number,default:1},includes:[String],
  environment:{type:String,enum:['sandbox','production'],required:true},
  status:{type:String,enum:['initializing','pending','verification_pending','paid','fulfilled','failed','expired','cancelled','review','refund_review','refunded','disputed'],default:'initializing',index:true},
  checkoutId:{type:String},checkoutUrl:{type:String},productId:{type:String},chargeId:{type:String},providerChargeId:{type:String},
  leaseUntil:Date,expiresAt:Date,verifiedAt:Date,fulfilledAt:Date,lastCheckedAt:Date,checkoutAttemptedAt:Date,
  chargedAmount:String,chargedCurrency:String,issue:{type:String,default:null},
  recoveryDeaths:Number,recoveryUntil:Date,attempts:{type:Number,default:0},
},{timestamps:true});
for(const path of ['playerId','key','sku','version','name','cents','currency','kind','quantity','includes','environment','recoveryDeaths','recoveryUntil']){
  orderSchema.path(path).options.immutable=true;orderSchema.path(path).immutable(true);
}
orderSchema.index({playerId:1,key:1},{unique:true});
orderSchema.index({checkoutId:1},{unique:true,sparse:true});
orderSchema.index({chargeId:1},{unique:true,sparse:true});
orderSchema.index({providerChargeId:1},{unique:true,sparse:true});
export const StoreOrder=mongoose.model('StoreOrder',orderSchema);
const inventorySchema=new mongoose.Schema({
  playerId:{type:oid,ref:'User',required:true},environment:{type:String,enum:['sandbox','production'],required:true},ownedIds:{type:[String],default:[]},
  grenades:{type:Number,default:5,min:0,max:1000000,validate:Number.isSafeInteger},
  // The upsert is the once-only starter grant, never an increment on login.
  starterGrantedAt:{type:Date,default:Date.now},equippedWeapon:{type:String,default:null},version:{type:Number,default:0},
  spendingBlocked:{type:Boolean,default:false},
},{timestamps:true});
inventorySchema.index({playerId:1,environment:1},{unique:true});
export const StoreInventory=mongoose.model('StoreInventory',inventorySchema);
const ledgerSchema=new mongoose.Schema({
  key:{type:String,required:true,unique:true,immutable:true},playerId:{type:oid,required:true,immutable:true,index:true},
  orderId:{type:oid,immutable:true},kind:{type:String,enum:['grant','grenade_spent','reversal','audit'],required:true,immutable:true},
  sku:{type:String,immutable:true},quantity:{type:Number,immutable:true},cents:{type:Number,immutable:true},
  actor:{type:String,immutable:true},detail:{type:String,immutable:true},createdAt:{type:Date,default:Date.now,immutable:true},
},{versionKey:false});
for(const hook of ['updateOne','updateMany','findOneAndUpdate','replaceOne','findOneAndReplace','deleteOne','deleteMany','findOneAndDelete']){
  ledgerSchema.pre(hook,function(){throw new Error('immutable_store_ledger');});
}
ledgerSchema.pre('save',function(){if(!this.isNew)throw new Error('immutable_store_ledger');});
export const StoreLedger=mongoose.model('StoreLedger',ledgerSchema);
export const StorePurchaseLock=mongoose.model('StorePurchaseLock',new mongoose.Schema({_id:String,orderId:{type:oid,required:true}},{timestamps:true}));
export const StoreProduct=mongoose.model('StoreProduct',new mongoose.Schema({_id:String,productId:String,organizationId:String,attemptedAt:Date},{timestamps:true}));
