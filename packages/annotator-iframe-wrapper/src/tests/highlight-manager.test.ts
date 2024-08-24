import { generateXPath } from '../hooks/highlight-manager';

describe('highlight manager', () => {
  it('computes xpath correctly without any quotes', () => {
    const selectorSet = `EdvoHighlight$$P$$test$$2`;
    expect(generateXPath(selectorSet)).toBe(`//P[text()[contains(., 'test')]]`);
  });
  it('computes xpath correctly with single quotes', () => {
    const selectorSet = `EdvoHighlight$$P$$in the aftermath of the death of Elverum's wife, the cartoonist$$2`;
    expect(generateXPath(selectorSet)).toBe(
      `//P[text()[contains(., concat('in the aftermath of the death of Elverum', "'", 's wife, the cartoonist'))]]`,
    );
  });
  it('computes xpath correctly with double quotes', () => {
    const selectorSet = `EdvoHighlight$$P$$and then she said, "why do you do this to me"$$2`;
    expect(generateXPath(selectorSet)).toBe(
      `//P[text()[contains(., concat('and then she said, ', '"', 'why do you do this to me', '"'))]]`,
    );
  });
  it('computes xpath correctly with both single and double quotes', () => {
    const selectorSet = `EdvoHighlight$$P$$and then the man's wife asked, "what are you making for dinner?"$$2`;
    expect(generateXPath(selectorSet)).toBe(
      `//P[text()[contains(., concat('and then the man', "'", 's wife asked, ', '"', 'what are you making for dinner?', '"'))]]`,
    );
  });
});
