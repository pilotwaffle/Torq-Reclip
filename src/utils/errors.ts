export function formatYtDlpError(raw: string): { title: string; body: string } {
  const lowerRaw = raw.toLowerCase();

  if (lowerRaw.includes("sign in to confirm you're not a bot") || lowerRaw.includes("cookies")) {
    return {
      title: "YouTube is blocking this request",
      body: "YouTube flagged this download as automated. Try again, use a different link, or sign in with cookies if running locally.",
    };
  }

  if (lowerRaw.includes("video unavailable") || lowerRaw.includes("private video")) {
    return {
      title: "Video unavailable",
      body: "This video is private, removed, or region-locked.",
    };
  }

  if (lowerRaw.includes("http error 429")) {
    return {
      title: "Rate limited",
      body: "Too many requests. Wait a moment and try again.",
    };
  }

  // Fallback: get the first line and remove URLs
  let firstLine = raw.split('\n')[0].trim();
  // Strip URLs using a simple regex
  firstLine = firstLine.replace(/https?:\/\/[^\s]+/g, '').trim();

  return {
    title: "Something went wrong",
    body: firstLine || "An unknown error occurred.",
  };
}
