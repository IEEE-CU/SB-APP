const axios = require("axios");
const cheerio = require("cheerio");
const Opportunity = require("../models/Opportunity");
const sources = require("../config/opportunitySources");

const REQUEST_TIMEOUT_MS = 15000;
const MAX_ITEMS_PER_SOCIETY = 25;
const MIN_TITLE_LENGTH = 8;
const MAX_TITLE_LENGTH = 160;

const KEYWORDS = [
  "award",
  "scholarship",
  "grant",
  "fellowship",
  "prize",
  "funding",
];

function looksLikeOpportunity(text) {
  const t = text.toLowerCase();
  return (
    t.length >= MIN_TITLE_LENGTH &&
    t.length <= MAX_TITLE_LENGTH &&
    KEYWORDS.some((kw) => t.includes(kw))
  );
}

function resolveUrl(href, base) {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

const isBareUrl = (text) => /^(https?:\/\/|www\.)/i.test(text.trim());

/**
 * Some sites (e.g. ieeefoundation.org) link out using the raw URL as the
 * anchor's visible text instead of a human title. Derive something readable
 * from the last path segment instead of showing the URL verbatim.
 */
function humanizeUrl(url) {
  try {
    const { pathname } = new URL(url);
    const slug = pathname.split("/").filter(Boolean).pop() || "";
    const words = slug
      .replace(/\.(html?|php|aspx?)$/i, "")
      .split(/[-_]+/)
      .filter(Boolean);
    if (words.length === 0) return null;
    return words.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
  } catch {
    return null;
  }
}

/**
 * Best-effort scrape: looks for anchor tags whose visible text reads like an
 * award/scholarship/grant listing. Structure of these sites is not standardized,
 * so this is a heuristic, not a precise parser per site.
 */
async function scrapeSociety(source) {
  const { society, url } = source;
  const found = new Map();

  try {
    const { data: html } = await axios.get(url, {
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; IEEE-SB-APP-Bot/1.0; +https://github.com/IEEE-CU/SB-APP)",
      },
    });

    const $ = cheerio.load(html);

    $("a[href]").each((_, el) => {
      if (found.size >= MAX_ITEMS_PER_SOCIETY) return;

      let text = $(el).text().replace(/\s+/g, " ").trim();
      if (!looksLikeOpportunity(text)) return;

      const href = $(el).attr("href");
      const link = resolveUrl(href, url);
      if (!link) return;

      if (isBareUrl(text)) {
        text = humanizeUrl(link) || text;
      }

      if (!found.has(link)) {
        found.set(link, text);
      }
    });

    return {
      society,
      sourceUrl: url,
      items: Array.from(found, ([link, title]) => ({ title, link })),
      ok: true,
    };
  } catch (error) {
    return {
      society,
      sourceUrl: url,
      items: [],
      ok: false,
      error: error.message,
    };
  }
}

async function scrapeAllSocieties() {
  const results = [];

  for (const source of sources) {
    // Sequential, not parallel, to stay polite to external sites.
    // eslint-disable-next-line no-await-in-loop
    const result = await scrapeSociety(source);
    results.push(result);

    if (result.ok && result.items.length > 0) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.all(
        result.items.map((item) =>
          Opportunity.findOneAndUpdate(
            { society: result.society, link: item.link },
            {
              society: result.society,
              title: item.title,
              link: item.link,
              sourceUrl: result.sourceUrl,
              scrapedAt: new Date(),
            },
            { upsert: true, new: true },
          ),
        ),
      );
    }
  }

  return results;
}

module.exports = { scrapeAllSocieties, scrapeSociety };
