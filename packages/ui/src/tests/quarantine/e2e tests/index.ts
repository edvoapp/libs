// SKIPPED TESTS
// If a test is skipped, it must be documented why it is skipped and what the plan for unskipping it is

export * from '../skip/rt-1886';
export * from '../skip/rt-1504';
export * from '../skip/auto-create-db'; // This is more of a helper than a test
export * from '../skip/rt-1391'; // Friend creation is not working (also doesn't have an e2e test)
export * from '../skip/feat-2045-loading-screen'; // This test does not consistently pass because sometimes the space loads too quickly. May need to orchestrate injection of a timeout to simulate a long loading time, or have this test create a large space
export * from '../skip/rt-1769'; // Double click for last made member not working properly for a while now

// TODO: unskip
export * from '../skip/my-universe'; //moving over to a homepage instead of topic space
export * from '../skip/rt-1796';
export * from '../skip/rt-1798';
export * from '../skip/rt-1799';
export * from '../skip/rt-1802';
export * from '../skip/rt-1810';
export * from '../skip/rt-1811';
export * from '../skip/rt-1812';
export * from '../skip/rt-1822';
export * from '../skip/rt-1859';
export * from '../skip/rt-1939';
export * from '../skip/rt-2002';
export * from '../skip/feat-2069-archive';
export * from '../skip/rt-2104'; // rootNode not defined due to signout and signing back in
export * from '../skip/topic'; // look into new topic page
//All of the above need to be reworked to work with the new page system since root is not a topic space anymore
