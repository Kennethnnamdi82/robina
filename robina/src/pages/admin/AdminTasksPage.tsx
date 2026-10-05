import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, ExternalLink, XCircle } from "lucide-react";
import { toast } from "sonner";
import { shortenWallet } from "@/types/game";
import { adminApi } from "@/services/api";

type TaskCategory =
  | "custom"
  | "x_follow"
  | "x_like"
  | "x_retweet"
  | "x_comment"
  | "x_post"
  | "telegram_join"
  | "discord_join";

type TaskType =
  | "default"
  | "daily"
  | "temporary_engagement"
  | "campaign"
  | "event_community";

type DefinitionStatus = "active" | "inactive" | "archived";

interface BackendTask {
  _id: string;
  wallet: string;
  taskId: string;
  status: "pending" | "complete" | "rejected";
  reward: number;
  proof?: string;
  reviewRequired?: boolean;
  createdAt?: string;
}

interface TaskDefinition {
  _id?: string;
  id: string;
  title: string;
  description?: string;
  category?: TaskCategory;
  taskType?: TaskType;
  reward?: number;
  rewardPoints?: number;
  actionUrl?: string;
  expiresAt?: string | null;
  createdAt?: string;
  status?: DefinitionStatus;
  published?: boolean;
}

const CATEGORY_OPTIONS: Array<{ value: TaskCategory; label: string }> = [
  { value: "custom", label: "Custom Task" },
  { value: "x_follow", label: "X Follow" },
  { value: "x_like", label: "X Like" },
  { value: "x_retweet", label: "X Repost" },
  { value: "x_comment", label: "X Comment" },
  { value: "x_post", label: "Post About BaseDrop on X" },
  { value: "telegram_join", label: "Join Telegram" },
  { value: "discord_join", label: "Join Discord" },
];

const TASK_TYPE_OPTIONS: Array<{ value: TaskType; label: string }> = [
  { value: "temporary_engagement", label: "Temporary Engagement" },
  { value: "campaign", label: "Campaign" },
  { value: "event_community", label: "Event / Community" },
  { value: "daily", label: "Daily" },
  { value: "default", label: "Default" },
];

const STATUS_OPTIONS: Array<{ value: DefinitionStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "archived", label: "Archived" },
];

const ACTION_CATEGORIES = new Set<TaskCategory>([
  "x_follow",
  "x_like",
  "x_retweet",
  "x_comment",
  "telegram_join",
  "discord_join",
]);

function toDatetimeLocalInput(v?: string | null) {
  if (!v) return "";
  const d = new Date(v);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function fromDatetimeLocalInput(v: string) {
  if (!v) return null;
  return new Date(v).toISOString();
}

const EMPTY_FORM = {
  id: "",
  title: "",
  description: "",
  category: "custom" as TaskCategory,
  taskType: "temporary_engagement" as TaskType,
  rewardPoints: 5,
  actionUrl: "",
  expiresAt: "",
  status: "active" as DefinitionStatus,
};

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<BackendTask[]>([]);
  const [definitions, setDefinitions] = useState<TaskDefinition[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "complete" | "rejected">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editing, setEditing] = useState<Record<string, typeof EMPTY_FORM>>({});

  const load = useCallback(async () => {
    try {
      const data = (await adminApi.tasks(filter === "all" ? "" : filter)) as {
        tasks: BackendTask[];
        definitions: TaskDefinition[];
      };
      setTasks(data.tasks || []);
      setDefinitions(data.definitions || []);
    } catch (e) {
      toast.error((e as Error).message || "Failed to load tasks");
    } finally {
      setHasLoadedOnce(true);
    }
  }, [filter]);

  useEffect(() => {
    load();
    const interval = window.setInterval(() => load(), 4000);
    const onFocus = () => load();
    const onVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load]);

  const pendingReviewTasks = useMemo(
    () => tasks.filter((t) => t.status === "pending" && t.reviewRequired !== false),
    [tasks],
  );

  async function createDefinition() {
    if (!form.id.trim() || !form.title.trim()) {
      toast.error("Task id and title are required");
      return;
    }
    if (ACTION_CATEGORIES.has(form.category) && !form.actionUrl.trim()) {
      toast.error("Action URL is required for social tasks");
      return;
    }
    try {
      await adminApi.createTaskDefinition({
        id: form.id.trim().toLowerCase(),
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        taskType: form.taskType,
        rewardPoints: Number(form.rewardPoints) || 0,
        actionUrl: form.actionUrl.trim() || undefined,
        expiresAt: form.category === "x_post" ? null : fromDatetimeLocalInput(form.expiresAt),
        status: form.status,
      });
      toast.success("Task created");
      setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      toast.error((e as Error).message || "Failed to create task");
    }
  }

  async function reviewTask(id: string, decision: "approve" | "reject") {
    setBusy(id);
    try {
      await adminApi.reviewTask(id, decision);
      toast.success(decision === "approve" ? "Submission approved" : "Submission rejected");
      await load();
    } catch (e) {
      toast.error((e as Error).message || "Review action failed");
    } finally {
      setBusy(null);
    }
  }

  function beginEdit(def: TaskDefinition) {
    setEditing((prev) => ({
      ...prev,
      [def.id]: {
        id: def.id,
        title: def.title,
        description: def.description || "",
        category: (def.category || "custom") as TaskCategory,
        taskType: (def.taskType || "temporary_engagement") as TaskType,
        rewardPoints: Number(def.rewardPoints ?? def.reward ?? 0),
        actionUrl: def.actionUrl || "",
        expiresAt: toDatetimeLocalInput(def.expiresAt),
        status: (def.status || (def.published === false ? "inactive" : "active")) as DefinitionStatus,
      },
    }));
  }

  function cancelEdit(id: string) {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function saveEdit(taskId: string) {
    const draft = editing[taskId];
    if (!draft) return;
    if (!draft.title.trim()) {
      toast.error("Task title is required");
      return;
    }
    if (ACTION_CATEGORIES.has(draft.category) && !draft.actionUrl.trim()) {
      toast.error("Action URL is required for social tasks");
      return;
    }
    try {
      await adminApi.updateTaskDefinition(taskId, {
        title: draft.title.trim(),
        description: draft.description.trim(),
        category: draft.category,
        taskType: draft.taskType,
        rewardPoints: Number(draft.rewardPoints) || 0,
        actionUrl: draft.actionUrl.trim() || undefined,
        expiresAt: draft.category === "x_post" ? null : fromDatetimeLocalInput(draft.expiresAt),
        status: draft.status,
      });
      toast.success("Task updated");
      cancelEdit(taskId);
      await load();
    } catch (e) {
      toast.error((e as Error).message || "Failed to save task");
    }
  }

  async function deleteDefinition(taskId: string) {
    try {
      await adminApi.deleteTaskDefinition(taskId);
      toast.success("Task deleted");
      await load();
    } catch (e) {
      toast.error((e as Error).message || "Failed to delete task");
    }
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="glass-card rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Create Task</p>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-accent/20 text-accent">
            Pending Reviews: {pendingReviewTasks.length}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            value={form.id}
            onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
            placeholder="task_id"
            className="px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs"
          />
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Task title"
            className="px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs"
          />
          <input
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Description"
            className="px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs"
          />
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as TaskCategory }))}
            className="px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={form.taskType}
            onChange={(e) => setForm((f) => ({ ...f, taskType: e.target.value as TaskType }))}
            className="px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs"
          >
            {TASK_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            value={form.rewardPoints}
            onChange={(e) => setForm((f) => ({ ...f, rewardPoints: Number(e.target.value) }))}
            placeholder="Reward points"
            className="px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs"
          />
          <input
            value={form.actionUrl}
            onChange={(e) => setForm((f) => ({ ...f, actionUrl: e.target.value }))}
            placeholder="Action URL"
            className="px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs"
          />
          <input
            type="datetime-local"
            value={form.expiresAt}
            onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
            disabled={form.category === "x_post"}
            className="px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs disabled:opacity-50"
          />
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as DefinitionStatus }))}
            className="px-3 py-2 rounded-lg bg-secondary/50 border border-border text-xs"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={createDefinition}
          className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-xs font-semibold"
        >
          Create Task
        </button>
      </div>

      <div className="glass-card rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold">Task Definitions</p>
        {definitions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No task definitions created yet.</p>
        ) : (
          definitions.map((def) => {
            const draft = editing[def.id];
            const rewardPoints = Number(def.rewardPoints ?? def.reward ?? 0);
            const status = def.status || (def.published === false ? "inactive" : "active");
            return (
              <div key={def.id} className="rounded-lg bg-secondary/20 p-3 space-y-2">
                {draft ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      value={draft.title}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [def.id]: { ...draft, title: e.target.value } }))
                      }
                      className="px-2 py-1.5 rounded-md bg-secondary/50 border border-border text-xs"
                    />
                    <input
                      value={draft.description}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [def.id]: { ...draft, description: e.target.value } }))
                      }
                      className="px-2 py-1.5 rounded-md bg-secondary/50 border border-border text-xs"
                    />
                    <select
                      value={draft.category}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [def.id]: { ...draft, category: e.target.value as TaskCategory } }))
                      }
                      className="px-2 py-1.5 rounded-md bg-secondary/50 border border-border text-xs"
                    >
                      {CATEGORY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={draft.actionUrl}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [def.id]: { ...draft, actionUrl: e.target.value } }))
                      }
                      className="px-2 py-1.5 rounded-md bg-secondary/50 border border-border text-xs"
                    />
                    <input
                      type="number"
                      min={0}
                      value={draft.rewardPoints}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [def.id]: { ...draft, rewardPoints: Number(e.target.value) },
                        }))
                      }
                      className="px-2 py-1.5 rounded-md bg-secondary/50 border border-border text-xs"
                    />
                    <input
                      type="datetime-local"
                      value={draft.expiresAt}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [def.id]: { ...draft, expiresAt: e.target.value } }))
                      }
                      disabled={draft.category === "x_post"}
                      className="px-2 py-1.5 rounded-md bg-secondary/50 border border-border text-xs disabled:opacity-50"
                    />
                    <select
                      value={draft.taskType}
                      onChange={(e) =>
                        setEditing((prev) => ({ ...prev, [def.id]: { ...draft, taskType: e.target.value as TaskType } }))
                      }
                      className="px-2 py-1.5 rounded-md bg-secondary/50 border border-border text-xs"
                    >
                      {TASK_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={draft.status}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [def.id]: { ...draft, status: e.target.value as DefinitionStatus },
                        }))
                      }
                      className="px-2 py-1.5 rounded-md bg-secondary/50 border border-border text-xs"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(def.id)}
                        className="px-2 py-1 rounded-md text-[11px] border border-green-500/40 text-green-400"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => cancelEdit(def.id)}
                        className="px-2 py-1 rounded-md text-[11px] border border-border"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold">
                          {def.title} <span className="text-muted-foreground">({def.id})</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {(def.taskType || "temporary_engagement").replaceAll("_", " ")} •{" "}
                          {(def.category || "custom").replaceAll("_", " ")} • +{rewardPoints} BD
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Status: {status}
                          {def.expiresAt ? ` • Expires: ${new Date(def.expiresAt).toLocaleString()}` : " • No expiry"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => beginEdit(def)}
                          className="px-2 py-1 rounded-md text-[11px] border border-border"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteDefinition(def.id)}
                          className="px-2 py-1 rounded-md text-[11px] border border-destructive/40 text-destructive"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {def.actionUrl ? (
                      <a
                        href={def.actionUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-accent inline-flex items-center gap-1 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {def.actionUrl}
                      </a>
                    ) : null}
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="space-y-3">
        <div className="flex gap-2">
          {(["all", "pending", "complete", "rejected"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize ${
                filter === f
                  ? "gradient-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {hasLoadedOnce && tasks.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-center text-xs text-muted-foreground">
            No submissions yet.
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task._id} className="glass-card rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{task.taskId}</p>
                  <p className="text-[10px] text-muted-foreground">{shortenWallet(task.wallet)}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    task.status === "pending"
                      ? "bg-accent/20 text-accent"
                      : task.status === "complete"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-destructive/20 text-destructive"
                  }`}
                >
                  {task.status}
                </span>
              </div>

              {task.proof ? (
                <div className="bg-secondary/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground mb-1">Submitted Link</p>
                  {task.proof.startsWith("http") ? (
                    <a
                      href={task.proof}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-accent inline-flex items-center gap-1 hover:underline break-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {task.proof}
                    </a>
                  ) : (
                    <p className="text-xs break-all">{task.proof}</p>
                  )}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-[10px] text-muted-foreground">
                  {task.createdAt ? new Date(task.createdAt).toLocaleString() : "-"} • +{task.reward} BD
                </p>
                {task.status === "pending" && task.reviewRequired !== false ? (
                  <div className="flex gap-2">
                    <button
                      disabled={busy === task._id}
                      onClick={() => reviewTask(task._id, "approve")}
                      className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Approve
                    </button>
                    <button
                      disabled={busy === task._id}
                      onClick={() => reviewTask(task._id, "reject")}
                      className="px-3 py-1.5 rounded-lg bg-destructive/20 text-destructive text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
                    >
                      <XCircle className="w-3 h-3" />
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
