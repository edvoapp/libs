import { AssertionError } from 'assert';

export type Test = {
  description: string;
  test: () => Promise<void>;
};

export type TestGroup = {
  description: string;
  tests: Test[];
  errors: string[];
  successes: string[];
};

export const testGroupsMap: { [description: string]: TestGroup } = {};

export let currentDescribe: string | null = null;

export function describe(description: string, registerTests: () => void) {
  currentDescribe = description;
  testGroupsMap[description] = {
    description,
    tests: [],
    errors: [],
    successes: [],
  };
  registerTests();
}

export function it(description: string, test: () => Promise<void>) {
  if (!currentDescribe || !testGroupsMap[currentDescribe])
    return console.error('Test', description, 'does not have a wrapping describe');

  testGroupsMap[currentDescribe].tests.push({ description, test });
}

type ErrorStack = {
  message: string;
};

function handleError(err: any) {
  if (err instanceof AssertionError) {
    return err.message;
  } else {
    return err.toString();
  }
}

export async function runAllTests() {
  for (const [, { description: groupDescription, tests, errors, successes }] of Object.entries(testGroupsMap)) {
    for (const { description: testDescription, test } of tests) {
      try {
        await test();
        const msg = `✅ ${testDescription} succeeded`;
        successes.push(msg);
      } catch (err) {
        const msg = `❌ ${testDescription} failed with error: ${handleError(err)}`;
        errors.push(msg);
      }
    }
    if (errors.length === 0) {
      console.log('All tests for', groupDescription, 'passed');
    } else {
      console.group(`${errors.length} test(s) for`, groupDescription, 'failed:');
      for (const err of errors) {
        console.error(`   ${err}`);
      }
      console.groupEnd();
    }
  }
}
