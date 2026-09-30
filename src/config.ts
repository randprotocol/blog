export const SITE = {
  website: "https://randprotocol.org/blog/",
  author: "Rand Protocol",
  profile: "https://randprotocol.org/",
  desc: "Engineering notes from the Rand Protocol team on building a post-quantum, fully shielded chain with a zkVM.",
  title: "Rand Protocol Blog",
  ogImage: "og.png",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 4,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true,
  editPost: {
    enabled: true,
    text: "Edit page",
    url: "https://github.com/randprotocol/blog/edit/main/",
  },
  dynamicOgImage: true,
  dir: "ltr",
  lang: "en",
  timezone: "UTC",
} as const;
