export type EmbedParams = {
  videoId?: string;
  userId?: string;
  courseId?: string;
  moduleId?: string;
};

const QUERY_KEYS = ["videoid", "userid", "courseid", "moduleid"] as const;

type QueryKey = (typeof QUERY_KEYS)[number];

export const parseEmbedParams = (query: string): EmbedParams => {
  const params: EmbedParams = {};
  const normalizedQuery = query.startsWith("?") ? query.slice(1) : query;
  const pattern = new RegExp(`(?:^|&)?(${QUERY_KEYS.join("|")})=`, "gi");
  const matches = [...normalizedQuery.matchAll(pattern)];

  matches.forEach((match, index) => {
    const key = match[1]?.toLowerCase() as QueryKey | undefined;
    if (!key) {
      return;
    }
    const start = (match.index ?? 0) + match[0].length;
    const end =
      index + 1 < matches.length ? matches[index + 1].index ?? normalizedQuery.length : normalizedQuery.length;
    const rawValue = normalizedQuery.slice(start, end).replace(/^&/, "").replace(/&$/, "");
    const value = rawValue ? decodeURIComponent(rawValue) : undefined;
    if (!value) {
      return;
    }
    if (key === "videoid") {
      params.videoId = value;
    }
    if (key === "userid") {
      params.userId = value;
    }
    if (key === "courseid") {
      params.courseId = value;
    }
    if (key === "moduleid") {
      params.moduleId = value;
    }
  });

  return params;
};

export const getEmbedParams = (): EmbedParams => {
  if (typeof window === "undefined") {
    return {};
  }
  return parseEmbedParams(window.location.search);
};
