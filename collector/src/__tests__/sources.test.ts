import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseRedditRSS } from '../sources/reddit.js';
import { parseRSSItems as parseWWRItems } from '../sources/weworkremotely.js';
import { makeWebDedupeKey } from '@lead-finder/shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../fixtures');

describe('Source Parsers and Normalization', () => {
  describe('Reddit RSS parser', () => {
    it('parses valid reddit RSS fixture correctly', () => {
      const xml = fs.readFileSync(path.join(fixturesDir, 'reddit.xml'), 'utf8');
      const items = parseRedditRSS(xml);

      expect(items.length).toBe(2);
      expect(items[0]?.title).toBe('[Hiring] Senior React Native Developer for Fintech MVP ($2,000 budget)');
      expect(items[0]?.link).toBe('https://www.reddit.com/r/forhire/comments/12345/hiring_react_dev/');
      expect(items[0]?.content).toContain('Looking for an experienced React Native');
    });

    it('returns empty array on malformed or empty XML', () => {
      expect(parseRedditRSS('')).toEqual([]);
      expect(parseRedditRSS('<xml><broken></broken>')).toEqual([]);
    });

    it('strips HTML tags and decodes entities in content', () => {
      const sampleXml = `
        <item>
          <title>&lt;Urgent&gt; React &amp; Node &quot;Pro&quot;</title>
          <link>https://reddit.com/r/forhire/1</link>
          <description>&lt;p&gt;Need dev &amp;amp; designer &#039;fast&#039;&lt;/p&gt;</description>
        </item>
      `;
      const items = parseRedditRSS(sampleXml);
      expect(items[0]?.title).toBe('<Urgent> React & Node "Pro"');
      expect(items[0]?.content).toBe("Need dev & designer 'fast'");
    });
  });

  describe('We Work Remotely parser', () => {
    it('parses valid WWR RSS fixture with CDATA', () => {
      const xml = fs.readFileSync(path.join(fixturesDir, 'weworkremotely.xml'), 'utf8');
      const items = parseWWRItems(xml);

      expect(items.length).toBe(1);
      expect(items[0]?.title).toBe('Contract Full Stack Engineer (MERN / .NET)');
      expect(items[0]?.link).toBe('https://weworkremotely.com/jobs/99001-contract-full-stack');
      expect(items[0]?.description).toContain('We are looking for a freelance / contract engineer');
    });

    it('returns empty array for empty XML', () => {
      expect(parseWWRItems('')).toEqual([]);
    });
  });

  describe('Hacker News fixture normalization', () => {
    it('loads HN fixture and normalizes dedupe_key correctly', () => {
      const raw = fs.readFileSync(path.join(fixturesDir, 'hackernews.json'), 'utf8');
      const data = JSON.parse(raw);

      expect(data.hits.length).toBe(2);
      const hit1 = data.hits[0];
      const fallbackUrl = `https://news.ycombinator.com/item?id=${hit1.objectID}`;
      const dedupeKey = makeWebDedupeKey(fallbackUrl);

      expect(dedupeKey).toBe('web:news.ycombinator.com/item?id=40001');
    });
  });

  describe('RemoteOK fixture normalization', () => {
    it('loads RemoteOK fixture and ignores terms item', () => {
      const raw = fs.readFileSync(path.join(fixturesDir, 'remoteok.json'), 'utf8');
      const data = JSON.parse(raw);

      const jobs = data.slice(1);
      expect(jobs.length).toBe(2);
      expect(jobs[0].position).toBe('Freelance React Native Mobile Engineer');

      const dedupeKey = makeWebDedupeKey(jobs[0].url);
      expect(dedupeKey).toBe('web:remoteok.com/remote-jobs/1001-react-native-contractor');
    });
  });

  describe('Remotive fixture normalization', () => {
    it('loads Remotive fixture and normalizes URL and key', () => {
      const raw = fs.readFileSync(path.join(fixturesDir, 'remotive.json'), 'utf8');
      const data = JSON.parse(raw);

      expect(data.jobs.length).toBe(1);
      expect(data.jobs[0].title).toBe('Contract React & Node Specialist');

      const dedupeKey = makeWebDedupeKey(data.jobs[0].url);
      expect(dedupeKey).toBe('web:remotive.com/remote-jobs/software-dev/senior-full-stack-engineer-88001');
    });
  });
});

