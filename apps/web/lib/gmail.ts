import { google } from "googleapis";
import { prisma } from "./prisma";

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!
  );
}

// Seeds gmailHistoryId from the current Gmail profile so the poller knows
// where to start. If Pub/Sub is configured, also registers a push watch.
export async function setupGmailWatch(
  userId: string,
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const auth = makeOAuth2Client();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth });

  // Always seed historyId from the current profile (needed for polling)
  const profile = await gmail.users.getProfile({ userId: "me" });
  const historyId = String(profile.data.historyId ?? "");

  const update: { gmailHistoryId: string; gmailWatchExpiry?: Date } = { gmailHistoryId: historyId };

  // Optionally register a Pub/Sub push watch if the topic is configured
  const topic = process.env.GOOGLE_PUBSUB_TOPIC;
  if (topic) {
    try {
      const res = await gmail.users.watch({
        userId: "me",
        requestBody: { topicName: topic, labelIds: ["INBOX"] },
      });
      update.gmailWatchExpiry = new Date(Number(res.data.expiration));
      console.log(`[gmail] Pub/Sub watch registered for user ${userId}`);
    } catch (err) {
      console.warn("[gmail] Pub/Sub watch failed (polling will still work):", err);
    }
  }

  await prisma.googleCredential.update({ where: { userId }, data: update });
  console.log(`[gmail] Initialized historyId=${historyId} for user ${userId}`);
}

export async function getNewMessageIds(
  accessToken: string,
  refreshToken: string,
  startHistoryId: string
): Promise<string[]> {
  const auth = makeOAuth2Client();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.history.list({
    userId: "me",
    startHistoryId,
    historyTypes: ["messageAdded"],
    labelId: "INBOX",
  });

  const ids: string[] = [];
  for (const record of res.data.history ?? []) {
    for (const added of record.messagesAdded ?? []) {
      if (added.message?.id) ids.push(added.message.id);
    }
  }
  return ids;
}

export interface ParsedMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  body: string;
  messageIdHeader: string;
  references: string;
}

export async function getMessage(
  accessToken: string,
  refreshToken: string,
  messageId: string,
  userEmail: string
): Promise<ParsedMessage | null> {
  const auth = makeOAuth2Client();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const msg = res.data;
  const headers = msg.payload?.headers ?? [];
  const get = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

  const from = get("From");

  // Skip messages sent by the user themselves
  if (from.includes(userEmail)) return null;

  return {
    id: messageId,
    threadId: msg.threadId ?? messageId,
    from,
    subject: get("Subject"),
    body: extractBody(msg.payload),
    messageIdHeader: get("Message-ID"),
    references: get("References"),
  };
}

function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }
  return "";
}

// Gmail label background colors (must be from Gmail's supported palette)
export const GMAIL_COLORS: Record<string, { backgroundColor: string; textColor: string }> = {
  blue:   { backgroundColor: "#4986e7", textColor: "#ffffff" },
  purple: { backgroundColor: "#a479e2", textColor: "#ffffff" },
  green:  { backgroundColor: "#16a766", textColor: "#ffffff" },
  teal:   { backgroundColor: "#2da2bb", textColor: "#ffffff" },
  yellow: { backgroundColor: "#f2c960", textColor: "#1d1d1d" },
  orange: { backgroundColor: "#ff7537", textColor: "#ffffff" },
  red:    { backgroundColor: "#cc3a21", textColor: "#ffffff" },
  gray:   { backgroundColor: "#999999", textColor: "#ffffff" },
};

export async function createGmailLabel(
  accessToken: string,
  refreshToken: string,
  name: string,
  colorKey: string
): Promise<string | null> {
  const auth = makeOAuth2Client();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth });

  const color = GMAIL_COLORS[colorKey] ?? GMAIL_COLORS.gray;
  try {
    const res = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
        color,
      },
    });
    return res.data.id ?? null;
  } catch (err) {
    console.error("[gmail] createGmailLabel failed:", err);
    return null;
  }
}

export async function deleteGmailLabel(
  accessToken: string,
  refreshToken: string,
  gmailLabelId: string
): Promise<void> {
  const auth = makeOAuth2Client();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth });
  try {
    await gmail.users.labels.delete({ userId: "me", id: gmailLabelId });
  } catch (err) {
    console.warn("[gmail] deleteGmailLabel failed (label may already be gone):", err);
  }
}

export async function applyGmailLabels(
  accessToken: string,
  refreshToken: string,
  messageId: string,
  gmailLabelIds: string[]
): Promise<void> {
  if (!gmailLabelIds.length) return;
  const auth = makeOAuth2Client();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  const gmail = google.gmail({ version: "v1", auth });
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { addLabelIds: gmailLabelIds },
  });
}

export async function createDraft(
  accessToken: string,
  refreshToken: string,
  opts: {
    from: string;
    to: string;
    subject: string;
    body: string;
    threadId: string;
    inReplyTo: string;
    references: string;
  }
): Promise<void> {
  const auth = makeOAuth2Client();
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const gmail = google.gmail({ version: "v1", auth });

  const subject = opts.subject.toLowerCase().startsWith("re:")
    ? opts.subject
    : `Re: ${opts.subject}`;

  const refs = [opts.references, opts.inReplyTo].filter(Boolean).join(" ");

  // RFC 2822 date format
  const date = new Date().toUTCString().replace("GMT", "+0000");

  const mime = [
    `MIME-Version: 1.0`,
    `Date: ${date}`,
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${opts.inReplyTo}`,
    `References: ${refs}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    opts.body,
  ].join("\r\n");

  const raw = Buffer.from(mime).toString("base64url");

  await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw, threadId: opts.threadId } },
  });
}
