import mongoose from "mongoose";

const taskDefinitionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 64,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", trim: true, maxlength: 300 },
    reward: { type: Number, required: true, min: 0, default: 0 },
    rewardPoints: { type: Number, min: 0, default: 0 },
    category: {
      type: String,
      enum: [
        "custom",
        "x_follow",
        "x_like",
        "x_retweet",
        "x_comment",
        "x_post",
        "telegram_join",
        "discord_join",
      ],
      default: "custom",
    },
    actionUrl: { type: String, default: "", trim: true, maxlength: 500 },
    taskType: {
      type: String,
      enum: [
        "default",
        "daily",
        "temporary_engagement",
        "campaign",
        "event_community",
      ],
      default: "temporary_engagement",
      index: true,
    },
    expiresAt: { type: Date, default: null, index: true },
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
      index: true,
    },
    published: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

taskDefinitionSchema.pre("save", function syncDefinitionFields(next) {
  const rewardValue = Number(this.rewardPoints ?? this.reward ?? 0);
  this.reward = rewardValue;
  this.rewardPoints = rewardValue;
  if (this.status === "active" && this.published === false) this.published = true;
  if ((this.status === "inactive" || this.status === "archived") && this.published === true) {
    this.published = false;
  }
  next();
});

export const TaskDefinition = mongoose.model("TaskDefinition", taskDefinitionSchema);
