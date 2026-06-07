import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  checkAcrostic,
  fallbackPoem,
  promptCoversRequirements,
} from "@/lib/acrostic";
import { layer5Goal } from "@/lib/puzzles";

export const runtime = "nodejs";

interface OracleResponse {
  success: boolean;
  output: string;
  message: string;
  mode: "live" | "offline";
}

export async function POST(req: NextRequest) {
  let prompt = "";
  try {
    const body = await req.json();
    prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  } catch {
    return NextResponse.json(
      { success: false, output: "", message: "درخواست نامعتبر است.", mode: "offline" },
      { status: 400 }
    );
  }

  if (!prompt) {
    return NextResponse.json(
      { success: false, output: "", message: "پرامپت خالی است.", mode: "offline" } satisfies OracleResponse,
      { status: 400 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // حالت آفلاین: بدون کلید API
  if (!apiKey) {
    const cover = promptCoversRequirements(prompt);
    if (cover.ok) {
      return NextResponse.json({
        success: true,
        output: fallbackPoem,
        message:
          "(حالت آفلاین) پرامپت تو شرط‌های لازم را داشت؛ هاتف شعر را تولید کرد.",
        mode: "offline",
      } satisfies OracleResponse);
    }
    return NextResponse.json({
      success: false,
      output: "",
      message:
        "(حالت آفلاین) پرامپت تو این موارد را پوشش نداده: " +
        cover.missing.join("؛ ") +
        ".",
      mode: "offline",
    } satisfies OracleResponse);
  }

  // حالت زنده: فراخوانی Claude API
  try {
    const client = new Anthropic({ apiKey });
    const system =
      "تو «هاتف» هستی، یک هوش مصنوعی شاعر. تنها بر اساس دستور کاربر شعری فارسی تولید کن. " +
      "فقط متن شعر را بازگردان، بدون توضیح یا مقدمه. هر مصرع را در یک خط جدا بنویس.";

    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 700,
      system,
      messages: [{ role: "user", content: prompt }],
    });

    const output = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    const check = checkAcrostic(output);
    return NextResponse.json({
      success: check.ok,
      output,
      message: check.ok
        ? "هاتف دقیقاً همان چیزی را که خواستی تولید کرد. درها باز می‌شوند..."
        : check.reason ??
          `خروجی شرط آکروستیک «${layer5Goal.acrostic}» را برآورده نکرد. پرامپتت را دقیق‌تر کن.`,
      mode: "live",
    } satisfies OracleResponse);
  } catch (err) {
    const detail =
      err instanceof Anthropic.APIError
        ? `${err.status ?? ""} ${err.message}`.trim()
        : "خطای ناشناخته";
    return NextResponse.json(
      {
        success: false,
        output: "",
        message: "خطا در ارتباط با هاتف: " + detail,
        mode: "live",
      } satisfies OracleResponse,
      { status: 502 }
    );
  }
}
