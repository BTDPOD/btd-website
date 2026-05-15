import { XMLParser } from 'fast-xml-parser';

export interface Episode {
  guid: string;
  title: string;
  description: string;
  pubDate: string;
  audioUrl: string;
  duration: string;
  image: string;
  link: string;
  slug: string;
  episodeNumber?: number;
}

const RSS_URL = 'https://feeds.transistor.fm/behind-the-door';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parseDescription(raw: string): string {
  // Strip HTML tags
  return raw.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
}

export async function fetchEpisodes(): Promise<Episode[]> {
  try {
    const response = await fetch(RSS_URL, {
      headers: { 'User-Agent': 'BTDPodcast/1.0' },
    });

    if (!response.ok) {
      console.warn(`RSS fetch failed: ${response.status}`);
      return [];
    }

    const xml = await response.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true,
    });

    const result = parser.parse(xml);
    const channel = result?.rss?.channel;

    if (!channel || !channel.item) {
      return [];
    }

    const items = Array.isArray(channel.item) ? channel.item : [channel.item];
    const channelImage = channel['itunes:image']?.['@_href'] || channel.image?.url || '';

    const episodes: Episode[] = items.map((item: Record<string, unknown>, index: number) => {
      const enclosure = item.enclosure as Record<string, string> | undefined;
      const itunesImage = item['itunes:image'] as Record<string, string> | undefined;
      const itunesDuration = item['itunes:duration'] as string | number | undefined;
      const itunesEpisode = item['itunes:episode'] as string | number | undefined;

      const title = String(item.title || `Episode ${items.length - index}`);
      const rawDesc = String(item['content:encoded'] || item.description || '');
      const description = parseDescription(rawDesc);
      const audioUrl = enclosure?.['@_url'] || '';
      const image = itunesImage?.['@_href'] || channelImage;
      const duration = String(itunesDuration || '');
      const link = String(item.link || '');
      const guid = String(item.guid?.['#text'] || item.guid || link || `ep-${index}`);
      const pubDate = String(item.pubDate || '');
      const epNum = itunesEpisode ? Number(itunesEpisode) : undefined;

      return {
        guid,
        title,
        description,
        pubDate,
        audioUrl,
        duration,
        image,
        link,
        slug: slugify(title),
        episodeNumber: epNum,
      };
    });

    return episodes;
  } catch (err) {
    console.warn('RSS parse error:', err);
    return [];
  }
}

export async function fetchEpisodeBySlug(slug: string): Promise<Episode | null> {
  const episodes = await fetchEpisodes();
  return episodes.find((ep) => ep.slug === slug) ?? null;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatDuration(duration: string): string {
  if (!duration) return '';
  // Already in HH:MM:SS or MM:SS
  if (duration.includes(':')) return duration;
  // Seconds only
  const secs = parseInt(duration, 10);
  if (isNaN(secs)) return duration;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
