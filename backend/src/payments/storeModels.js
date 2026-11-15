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
  seasonId:{type:String,immutable:true},
},{timestamps:true});
for(const path of ['playerId','key','sku','version','name','cents','currency','kind','quantity','includes','environment','recoveryDeaths','recoveryUntil','seasonId']){
  orderSchema.path(path).options.immutable=true;orderSchema.path(path).immutable(true);
}
orderSchema.index({playerId:1,key:1},{unique:true});
orderSchema.index({checkoutId:1},{unique:true,sparse:true});
orderSchema.index({chargeId:1},{unique:true,sparse:true});
orderSchema.index({providerChargeId:1},{unique:true,sparse:true});
orderSchema.index({playerId:1,environment:1,seasonId:1,status:1});
export const StoreOrder=mongoose.model('StoreOrder',orderSchema);
const inventorySchema=new mongoose.Schema({
  playerId:{type:oid,ref:'User',required:true},environment:{type:String,enum:['sandbox','production'],required:true},ownedIds:{type:[String],default:[]},
  grenades:{type:Number,default:5,min:0,max:1000000,validate:Number.isSafeInteger},
  // The upsert is the once-only starter grant, never an increment on login.
  starterGrantedAt:{type:Date,default:Date.now},equippedWeapon:{type:String,default:null},version:{type:Number,default:0},
  equippedOutfit:{type:String,default:null},equippedFinish:{type:String,default:null},equippedEmote:{type:String,default:null},equippedEffect:{type:String,default:null},equippedIdentity:{type:String,default:null},
  equippedTrail:{type:String,default:null},equippedEntrance:{type:String,default:null},
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
const rewardSchema=new mongoose.Schema({id:{type:String,required:true,immutable:true},sku:{type:String,required:true,immutable:true},wins:{type:Number,required:true,min:1,max:1000,immutable:true}},{_id:false});
const seasonSchema=new mongoose.Schema({_id:String,name:{type:String,required:true},startsAt:{type:Date,required:true},endsAt:{type:Date,required:true},status:{type:String,enum:['published','closed'],required:true},free:[rewardSchema],premium:[rewardSchema]},{timestamps:true});
seasonSchema.index({status:1},{unique:true,partialFilterExpression:{status:'published'}});
for(const field of ['name','startsAt','endsAt','free','premium']){seasonSchema.path(field).options.immutable=true;seasonSchema.path(field).immutable(true);}
for(const hook of ['updateOne','updateMany','findOneAndUpdate','replaceOne','findOneAndReplace'])seasonSchema.pre(hook,function(){
  const update=this.getUpdate();
  for(const [operator,fields]of Object.entries(update??{}))for(const field of Object.keys(fields??{})){
    if(operator==='$set'&&['status','updatedAt'].includes(field)||operator==='$setOnInsert'&&field==='createdAt')continue;
    throw new Error('immutable_season_terms');
  }
});
export const StoreSeason=mongoose.model('StoreSeason',seasonSchema);
const claimSchema=new mongoose.Schema({_id:String,playerId:{type:oid,required:true},environment:{type:String,required:true},seasonId:{type:String,required:true},rewardId:String,sku:String,sourceOrderId:{type:oid,default:null},createdAt:{type:Date,default:Date.now}},{versionKey:false});
claimSchema.index({playerId:1,environment:1,seasonId:1});claimSchema.index({sourceOrderId:1});
for(const hook of ['updateOne','updateMany','findOneAndUpdate','replaceOne','findOneAndReplace','deleteOne','deleteMany','findOneAndDelete'])claimSchema.pre(hook,function(){throw new Error('immutable_season_claim');});
claimSchema.pre('save',function(){if(!this.isNew)throw new Error('immutable_season_claim');});
export const StoreSeasonClaim=mongoose.model('StoreSeasonClaim',claimSchema);
