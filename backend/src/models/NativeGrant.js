import mongoose from 'mongoose';
const schema=new mongoose.Schema({
  digest:{type:String,required:true,unique:true},challenge:{type:String,required:true},
  wallet:{type:String,required:true},sessionVersion:{type:Number,required:true},
  expiresAt:{type:Date,required:true,index:{expires:0}},
},{timestamps:true});
export const NativeGrant=mongoose.models.NativeGrant||mongoose.model('NativeGrant',schema);
