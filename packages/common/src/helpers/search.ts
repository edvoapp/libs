import { globalStore } from '../dataset';
import { Vertex } from '../model';
import { ObservableList } from '@edvoapp/util';

// "pseudoTerms" include delimiters, and can be joined to create a faithful representation of the source text.
// "the quick brown" -> ["", "the", " ", "quick", " ", "brown", ""] -> "the quick brown"
export function splitString(query: string): string[] {
  return query.split(/([,._\s]+)/);
}

// strip out the non-term members of the list. This can no longer be recombined into the original source text
// ["", "the", " ", "quick", " ", "brown", ""] -> ["the", "quick", "brown"]
const termRe = new RegExp(/\w/);
export function filterTerms(pseudoterms: string[]): string[] {
  return pseudoterms.filter((t) => termRe.test(t));
}

// Convert the term to a token, removing all punctuation and lowercasing.
const tokenStrip = new RegExp(/\W/g);
export function termToToken(term: string): string {
  return term.replaceAll(tokenStrip, '').toLocaleLowerCase();
}

export function stringToTokens(s: string | undefined): string[] {
  if (typeof s === 'undefined') return [];
  return filterTerms(splitString(s)).map((t) => termToToken(t));
}

export async function searchTopicsByName(searchString: string, limit = 50): Promise<TopicSearchResult[]> {
  // TODO implement basic inverted index here

  const queryTokens = filterTerms(splitString(searchString)).map((t) => termToToken(t));
  if (!queryTokens.length) return [];

  const vertices = globalStore.query<Vertex>('vertex', null, {
    where: [
      ['userID', '==', globalStore.getCurrentUserID()],
      ['keywords', 'array-contains-any', queryTokens],
      ['status', '==', 'active'],
    ],

    orderBy: ['visitedAt', 'desc'],
    limit: Math.min(1000, limit * 10),
  });

  const rawResults = await vertices.toArray();

  return rawResults
    .map((v) => new TopicSearchResult(v, queryTokens))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function searchTopicsByNameObs(searchString: string, limit?: number): ObservableList<TopicSearchResult> {
  // TODO implement basic inverted index here

  const queryTokens = filterTerms(splitString(searchString)).map((t) => termToToken(t));

  const vertices = globalStore.query<Vertex>('vertex', null, {
    where: [
      ['userID', '==', globalStore.getCurrentUserID()],
      ['keywords', 'array-contains-any', queryTokens],
    ],
    limit: limit,
  });
  return vertices.mapObs((v) => new TopicSearchResult(v, queryTokens)).sortObs((a, b) => b.score - a.score);
}

export class TopicSearchResult {
  readonly score: number;
  readonly tokens: string[];
  constructor(readonly vertex: Vertex, queryTerms: string[], readonly label?: string) {
    const recordTokens = vertex.hydratedKeywords || [];

    const matches = findMatches(
      recordTokens.map((t) => termToToken(t)), // should already be tokens, but legacy data...
      queryTerms.map((t) => termToToken(t)),
    );

    this.score =
      // weight multi-term matches a bit higher
      matches.reduce((acc, m) => acc + m.length ** 1.2, 0) /
      // Modestly de-weight based on the length of the record tokens
      // ( should probably do something more sophisticated with term frequency )
      recordTokens.length ** 0.1;

    this.tokens = matches.flatMap((m) => recordTokens.slice(m.sToken, m.sToken + m.length));
  }
}

function findMatches(subject: string[], query: string[]): Match[] {
  const matches: Match[] = [];
  const skips: number[] = [];

  // TODO evaluate each term to exhaustion rather than just moving on.
  // IE: subject:[A B C] should match query:[A B B C] twice, both with length of 2 (A B, B C),
  // but is currently matching twice with length of 2,1 respectively: (A B, C)
  subject.forEach((term, s0) => {
    const q0 = query.indexOf(term);
    if (q0 >= 0 && !skips.includes(q0)) {
      // we have a match
      let lookahead = 1;
      while (subject[s0 + lookahead] && query[q0 + lookahead] && subject[s0 + lookahead] === query[q0 + lookahead]) {
        skips.push(q0 + lookahead);
        lookahead++;
      }
      matches.push({ sToken: s0, qToken: q0, length: lookahead });
    }
  });
  return matches;
}

interface Match {
  qToken: number;
  sToken: number;
  length: number;
}
