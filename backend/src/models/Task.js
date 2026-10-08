import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    wallet: { type: String, required: true, lowercase: true, index: true },
    taskId: { type: String, required: true },
    taskKey: { type: String, default: null },
    status: { type: String, enum: ['pending', 'complete', 'rejected'], default: 'pending' },
    reward: { type: Number, default: 0 },
    proof: { type: String, default: '' },
    reviewRequired: { type: Boolean, default: true, index: true },
    claimReadyAt: { type: Date, default: null, index: true },
    verificationMethod: { type: String, default: "manual_review" },
  },
  { timestamps: true }
);

taskSchema.pre('validate', function syncTaskKey(next) {
  const wallet = String(this.wallet || '').toLowerCase().trim();
  const taskId = String(this.taskId || '').toLowerCase().trim();
  this.wallet = wallet;
  this.taskId = taskId;
  this.taskKey = wallet && taskId ? `${wallet}:${taskId}` : null;
  next();
});

taskSchema.index({ wallet: 1, taskId: 1 }, { unique: true });
taskSchema.index({ taskKey: 1 }, { unique: true, sparse: true });

export const Task = mongoose.model('Task', taskSchema);
