import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { makeAuthForUser } from "../../../../lib/gmail";
import { google } from "googleapis";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;

  const [{ auth: oauthClient }, labels] = await Promise.all([
    makeAuthForUser(userId),
    prisma.label.findMany({ where: { userId, enabled: true, gmailLabelId: { not: null } } }),
  ]);

  const gmail = google.gmail({ version: "v1", auth: oauthClient });

  const listRes = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX"],
    maxResults: 30,
  });

  const ids = (listRes.data.messages ?? []).map((m) => m.id!).filter(Boolean);

  type EmailRow = {
    id: string;
    from: string;
    subject: string;
    snippet: string;
    internalDate: string | null | undefined;
    labels: { name: string; color: string }[];
  };

  const results = await Promise.allSettled(
    ids.map(async (id): Promise<EmailRow> => {
      const res = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "Date"],
      });
      const msg = res.data;
      const headers = msg.payload?.headers ?? [];
      const get = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

      const msgLabelIds = msg.labelIds ?? [];
      const appliedLabels = labels
        .filter((l) => l.gmailLabelId && msgLabelIds.includes(l.gmailLabelId))
        .map((l) => ({ name: l.name, color: l.color }));

      return {
        id,
        from: get("From"),
        subject: get("Subject") || "(no subject)",
        snippet: msg.snippet ?? "",
        internalDate: msg.internalDate,
        labels: appliedLabels,
      };
    })
  );

  const emails: EmailRow[] = results
    .filter((r): r is PromiseFulfilledResult<EmailRow> => r.status === "fulfilled")
    .map((r) => r.value);

  return NextResponse.json(emails);
}
