import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response("ANTHROPIC_API_KEY is not configured", { status: 500 });
  }

  const client = new Anthropic({ apiKey });

  const body = await req.json();
  const { sprints } = body as { sprints: SprintContext[] };

  if (!sprints || sprints.length === 0) {
    return new Response("No sprint data provided", { status: 400 });
  }
  if (!Array.isArray(sprints) || sprints.length > 10) {
    return new Response("Invalid sprints payload", { status: 400 });
  }

  const sprintSummary = buildSprintSummary(sprints);

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      system: `You are an experienced Agile coach helping a scrum team reflect on their sprint performance.
Analyze the sprint data provided and give concise, actionable retrospective advice.
Focus on patterns, bottlenecks, and opportunities for improvement.
Structure your response with 2-3 key observations and 2-3 concrete action items.
Be specific and reference actual numbers from the data. Keep the tone positive and constructive.
Use markdown for formatting (bold for key points, bullet lists for items).`,
      messages: [
        {
          role: "user",
          content: `Here is the sprint performance data for the last ${sprints.length} sprint(s):\n\n${sprintSummary}\n\nPlease provide retrospective advice based on this data.`,
        },
      ],
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
        } catch (err) {
          console.error("[retro-advice] stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[retro-advice] handler error:", message);
    return new Response(message, { status: 500 });
  }
}

interface StoryContext {
  title: string;
  storyPoints: number;
  status: string;
  category: string;
  devHours?: number;
  testHours?: number;
}

interface SprintContext {
  name: string;
  startDate: string;
  endDate: string;
  capacity: number;
  plannedPoints: number;
  stories: StoryContext[];
}

function buildSprintSummary(sprints: SprintContext[]): string {
  return sprints
    .map((sprint) => {
      const done = sprint.stories.filter((s) => s.status === "done");
      const inProgress = sprint.stories.filter((s) => s.status === "in_progress");
      const notDone = sprint.stories.filter(
        (s) => s.status !== "done" && s.status !== "in_progress"
      );

      const delivered = done.reduce((a, s) => a + s.storyPoints, 0);
      const efficiency =
        sprint.capacity > 0
          ? Math.round((delivered / sprint.capacity) * 100)
          : 0;

      const byCategory = groupBy(sprint.stories, (s) => s.category || "user_story");
      const categoryBreakdown = Object.entries(byCategory)
        .map(([cat, stories]) => {
          const sp = stories.reduce((a, s) => a + s.storyPoints, 0);
          const doneCount = stories.filter((s) => s.status === "done").length;
          return `  - ${formatCategory(cat)}: ${stories.length} stories (${sp} SP), ${doneCount} done`;
        })
        .join("\n");

      const avgDevHours =
        done.filter((s) => s.devHours != null).length > 0
          ? Math.round(
              done.filter((s) => s.devHours != null).reduce((a, s) => a + (s.devHours ?? 0), 0) /
                done.filter((s) => s.devHours != null).length
            )
          : null;
      const avgTestHours =
        done.filter((s) => s.testHours != null).length > 0
          ? Math.round(
              done.filter((s) => s.testHours != null).reduce((a, s) => a + (s.testHours ?? 0), 0) /
                done.filter((s) => s.testHours != null).length
            )
          : null;

      const lines = [
        `## ${sprint.name}`,
        `Period: ${sprint.startDate} to ${sprint.endDate}`,
        `Capacity: ${sprint.capacity} SP | Planned: ${sprint.plannedPoints || "N/A"} SP | Delivered: ${delivered} SP | Efficiency: ${efficiency}%`,
        `Stories: ${done.length} done, ${inProgress.length} in progress, ${notDone.length} not started/other`,
        ``,
        `Category breakdown:`,
        categoryBreakdown,
      ];

      if (avgDevHours !== null) lines.push(`Avg dev time per story: ${avgDevHours}h`);
      if (avgTestHours !== null) lines.push(`Avg test time per story: ${avgTestHours}h`);

      if (notDone.length > 0) {
        lines.push(`\nIncomplete stories:`);
        notDone.slice(0, 5).forEach((s) => {
          lines.push(`  - "${s.title}" (${s.storyPoints} SP, ${formatCategory(s.category)})`);
        });
      }

      return lines.join("\n");
    })
    .join("\n\n---\n\n");
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}

function formatCategory(cat: string): string {
  const labels: Record<string, string> = {
    user_story: "User Story",
    bug: "Bug",
    mco: "MCO",
    best_effort: "Best-effort",
    tech_lead: "Tech Lead",
  };
  return labels[cat] ?? cat;
}
