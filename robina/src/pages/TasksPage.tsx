import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  CheckCircle,
  Clock3,
  ExternalLink,
  Gift,
  Loader2,
  MessageCircle,
  PenLine,
  Repeat2,
  Send,
  Twitter,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useGame } from "@/context/GameContext";
import { tasksApi, type ApiTaskSubmission } from "@/services/api";
import { HAS_BACKEND } from "@/lib/backend";

type TaskType = "default" | "daily" | "temporary_engagement" | "campaign" | "event_community";

type TaskDefinition = {
  id: string;
  title: string;
  description?: string;
  reward: number;
  rewardPoints?: number;
  category?: string;
  actionUrl?: string;
  taskType?: TaskType;
  createdAt?: string;
  expiresAt?: string | null;
  status?: "active" | "inactive" | "archived";
};

type TaskRecord = Pick<
  ApiTaskSubmission,
  "taskId" | "status" | "reviewRequired" | "claimReadyAt" | "verificationMethod"
>;

const ICON_MAP: Record<string, ReactNode> = {
  x_follow: <Twitter className="w-5 h-5" />,
  x_like: <MessageCircle className="w-5 h-5" />,
  x_retweet: <Repeat2 className="w-5 h-5" />,
  x_comment: <MessageCircle className="w-5 h-5" />,
  x_post: <Send className="w-5 h-5" />,
  telegram_join: <MessageCircle className="w-5 h-5" />,
  discord_join: <MessageCircle className="w-5 h-5" />,
  custom: <PenLine className="w-5 h-5" />,
};

function normalizeUrlInput(raw: string): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/i.test(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function isDailyPostTask(task: TaskDefinition) {
  return (task.category || "custom") === "x_post";
}

function formatCategory(category?: string) {
  return (category || "custom").replaceAll("_", " ");
}

function getApiErrorStatus(err: unknown): number | undefined {
  return (err as { status?: number })?.status;
}

function getApiErrorMessage(err: unknown): string {
  return String((err as Error)?.message || "");
}

export default function TasksPage() {
  const { user, refreshUser } = useGame();
  const [definitions, setDefinitions] = useState<TaskDefinition[]>([]);
  const [taskStateById, setTaskStateById] = useState<Record<string, TaskRecord>>({});
  const [links, setLinks] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  async function startTaskOnBackend(taskId: string) {
    try {
      return await tasksApi.start(taskId);
    } catch (startErr) {
      const startMsg = getApiErrorMessage(startErr);
      const startStatus = getApiErrorStatus(startErr);
      const shouldFallback =
        startStatus === 404 ||
        startMsg === "http_404" ||
        startMsg === "invalid_json_response" ||
        startMsg === "auto_claim_not_supported" ||
        startMsg === "use_auto_claim_flow";
      if (!shouldFallback) throw startErr;
      return tasksApi.startAuto(taskId);
    }
  }

  async function claimTaskOnBackend(taskId: string) {
    try {
      return await tasksApi.claim(taskId);
    } catch (claimErr) {
      const claimMsg = getApiErrorMessage(claimErr);
      const claimStatus = getApiErrorStatus(claimErr);
      const shouldFallback =
        claimStatus === 404 ||
        claimMsg === "http_404" ||
        claimMsg === "invalid_json_response" ||
        claimMsg === "auto_claim_not_supported";
      if (!shouldFallback) throw claimErr;
      return tasksApi.claimAuto(taskId);
    }
  }

  async function loadTasks({ silent = false }: { silent?: boolean } = {}) {
    if (!HAS_BACKEND) return;
    if (!silent) setLoading(true);
    try {
      const [catalogueResult, mineResult] = await Promise.allSettled([
        tasksApi.catalogue(),
        tasksApi.mine(),
      ]);

      if (catalogueResult.status === "fulfilled") {
        const catalogue = catalogueResult.value?.tasks;
        if (Array.isArray(catalogue)) setDefinitions(catalogue);
      }

      if (mineResult.status === "fulfilled") {
        const mine = mineResult.value?.tasks;
        const latestByTask: Record<string, TaskRecord> = {};
        for (const task of mine || []) {
          if (!latestByTask[task.taskId]) {
            latestByTask[task.taskId] = {
              taskId: task.taskId,
              status: task.status,
              reviewRequired: task.reviewRequired,
              claimReadyAt: task.claimReadyAt ?? null,
              verificationMethod: task.verificationMethod,
            };
          }
        }
        setTaskStateById((prev) =>
          Object.keys(latestByTask).length > 0 ? latestByTask : prev,
        );
      }
    } catch {
      // Keep previous UI state on transient sync failures.
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
    const interval = window.setInterval(() => loadTasks({ silent: true }), 4000);
    const onFocus = () => loadTasks({ silent: true });
    const onVisibility = () => {
      if (document.visibilityState === "visible") loadTasks({ silent: true });
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const tasks = useMemo(
    () =>
      definitions.map((task) => {
        const completed = taskStateById[task.id]?.status === "complete";
        return { ...task, completed };
      }),
    [definitions, taskStateById],
  );

  async function handleDailyPostSubmit(task: TaskDefinition) {
    const normalized = normalizeUrlInput(links[task.id] || "");
    if (!normalized) {
      toast.error("Please submit a valid X/Twitter post link");
      return;
    }

    setPending((prev) => ({ ...prev, [task.id]: true }));
    try {
      await tasksApi.submit(task.id, normalized);
      toast.success("Submitted. Waiting for admin approval.");
      setLinks((prev) => ({ ...prev, [task.id]: "" }));
      await loadTasks({ silent: true });
    } catch (e) {
      const msg = getApiErrorMessage(e);
      if (msg === "already_pending") toast.message("Task already pending admin review");
      else if (msg === "already_completed") toast.message("Task already completed");
      else if (msg === "invalid_x_post_link") toast.error("Please submit a valid X/Twitter post link");
      else if (msg === "proof_required") toast.error("Proof link is required");
      else toast.error("Task submission failed");
      await loadTasks({ silent: true });
    } finally {
      setPending((prev) => ({ ...prev, [task.id]: false }));
    }
  }

  async function handleStartTask(task: TaskDefinition) {
    setPending((prev) => ({ ...prev, [task.id]: true }));
    const previousRecord = taskStateById[task.id];

    setTaskStateById((prev) => ({
      ...prev,
      [task.id]: {
        taskId: task.id,
        status: "pending",
        reviewRequired: false,
        claimReadyAt: null,
        verificationMethod: "instant_claim",
      },
    }));

    try {
      const response = await startTaskOnBackend(task.id);
      setTaskStateById((prev) => ({
        ...prev,
        [task.id]: {
          taskId: task.id,
          status: "pending",
          reviewRequired: false,
          claimReadyAt: response?.task?.claimReadyAt ?? null,
          verificationMethod: response?.task?.verificationMethod || "instant_claim",
        },
      }));

      if (task.actionUrl) {
        window.open(task.actionUrl, "_blank", "noopener,noreferrer");
      }
      toast.success("Task opened. Claim is now unlocked.");
      await loadTasks({ silent: true });
    } catch (e) {
      const msg = getApiErrorMessage(e);
      const keepUnlocked =
        msg !== "already_completed" &&
        msg !== "unknown_task" &&
        msg !== "use_daily_post_flow" &&
        msg !== "manual_review_required";

      if (!keepUnlocked) {
        setTaskStateById((prev) => {
          const next = { ...prev };
          if (previousRecord) next[task.id] = previousRecord;
          else delete next[task.id];
          return next;
        });
      } else if (task.actionUrl) {
        window.open(task.actionUrl, "_blank", "noopener,noreferrer");
      }

      if (msg === "already_completed") toast.message("Task already completed");
      else if (msg === "unknown_task") toast.error("Task expired or unavailable.");
      else if (msg === "use_daily_post_flow") toast.error("This task requires X link submission for admin review.");
      else toast.message("Task opened. Claim unlocked.");

      await loadTasks({ silent: true });
    } finally {
      setPending((prev) => ({ ...prev, [task.id]: false }));
    }
  }

  async function handleClaimTask(task: TaskDefinition) {
    setPending((prev) => ({ ...prev, [task.id]: true }));
    try {
      await claimTaskOnBackend(task.id);
      setTaskStateById((prev) => ({
        ...prev,
        [task.id]: {
          ...(prev[task.id] || { taskId: task.id, reviewRequired: false }),
          taskId: task.id,
          status: "complete",
        },
      }));
      await refreshUser();
      toast.success("BD reward claimed");
      await loadTasks({ silent: true });
    } catch (e) {
      const msg = getApiErrorMessage(e);
      if (msg === "already_completed") {
        toast.message("Task already completed");
      } else if (msg === "task_not_started") {
        try {
          await startTaskOnBackend(task.id);
          await claimTaskOnBackend(task.id);
          setTaskStateById((prev) => ({
            ...prev,
            [task.id]: {
              ...(prev[task.id] || { taskId: task.id, reviewRequired: false }),
              taskId: task.id,
              status: "complete",
            },
          }));
          await refreshUser();
          toast.success("BD reward claimed");
        } catch {
          toast.message("Open task completed. Please tap Claim again.");
        }
      } else {
        toast.error("Claim failed");
      }
      await loadTasks({ silent: true });
    } finally {
      setPending((prev) => ({ ...prev, [task.id]: false }));
    }
  }

  return (
    <div className="px-4 pt-6 pb-24 max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="glass-card rounded-3xl p-6 space-y-2 relative overflow-hidden">
        <div className="absolute inset-0 gradient-primary opacity-10 pointer-events-none" />
        <div className="relative z-10 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Complete admin-published tasks to earn BD points.
          </p>
        </div>
        {loading ? (
          <div className="relative z-10 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/60 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Syncing tasks
          </div>
        ) : null}
      </div>

      {tasks.length === 0 && !loading ? (
        <div className="glass-card rounded-3xl p-10 text-center space-y-2">
          <p className="text-base font-semibold">No active tasks available</p>
          <p className="text-sm text-muted-foreground">New tasks will appear here automatically.</p>
        </div>
      ) : null}

      <div className="space-y-4">
        {tasks.map((task, index) => {
          const record = taskStateById[task.id];
          const status = record?.status;
          const completed = Boolean((task as TaskDefinition & { completed?: boolean }).completed);
          const isDailyPost = isDailyPostTask(task);
          const pendingAction = pending[task.id];
          const reward = Number(task.rewardPoints ?? task.reward ?? 0);
          const icon = ICON_MAP[task.category || "custom"] || ICON_MAP.custom;
          const claimUnlocked = Boolean(!completed && !isDailyPost && status === "pending");

          return (
            <div
              key={task.id}
              className="glass-card rounded-3xl p-5 md:p-6 space-y-5"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-2xl grid place-items-center ${
                    completed ? "bg-green-500/20 text-green-400" : "bg-accent/10 text-accent"
                  }`}
                >
                  {completed ? <CheckCircle className="w-5 h-5" /> : icon}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base md:text-lg font-semibold leading-tight">{task.title}</h2>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/15 text-accent">
                      <Gift className="w-3.5 h-3.5" />
                      +{reward} BD
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {task.description || "Complete this task to earn BD points."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/70 text-foreground/80 capitalize">
                  {formatCategory(task.category)}
                </span>
                {task.expiresAt ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/70 text-foreground/80">
                    <Clock3 className="w-3.5 h-3.5" />
                    Expires {new Date(task.expiresAt).toLocaleString()}
                  </span>
                ) : null}
              </div>

              {!completed && !isDailyPost && !claimUnlocked ? (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleStartTask(task)}
                    disabled={pendingAction}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                  >
                    {pendingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
                    Open Task
                  </button>
                  {task.actionUrl ? (
                    <a
                      href={task.actionUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Preview link
                    </a>
                  ) : null}
                </div>
              ) : null}

              {!completed && !isDailyPost && claimUnlocked ? (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => handleClaimTask(task)}
                    disabled={pendingAction}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                  >
                    {pendingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Claim BD
                  </button>
                  <span className="text-sm text-muted-foreground">Claim is unlocked for this task.</span>
                </div>
              ) : null}

              {!completed && isDailyPost && status !== "pending" ? (
                <div className="space-y-3">
                  <input
                    type="url"
                    placeholder="Paste your X post link..."
                    value={links[task.id] || ""}
                    onChange={(e) => setLinks((prev) => ({ ...prev, [task.id]: e.target.value }))}
                    className="w-full bg-secondary/50 border border-border/60 rounded-xl px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <button
                    onClick={() => handleDailyPostSubmit(task)}
                    disabled={pendingAction}
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold disabled:opacity-50"
                  >
                    {pendingAction ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit Link
                  </button>
                </div>
              ) : null}

              {!completed && isDailyPost && status === "pending" ? (
                <p className="text-sm text-accent flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Pending admin review
                </p>
              ) : null}

              {!completed && status === "rejected" ? (
                <p className="text-sm text-destructive flex items-center gap-2">
                  <XCircle className="w-4 h-4" />
                  Rejected. You can submit again.
                </p>
              ) : null}

              {completed ? (
                <p className="text-sm text-green-400 flex items-center gap-2 font-medium">
                  <CheckCircle className="w-4 h-4" />
                  Completed
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {loading && tasks.length > 0 ? (
        <div className="text-xs text-muted-foreground text-center pb-2">Updating task status...</div>
      ) : null}
    </div>
  );
}
