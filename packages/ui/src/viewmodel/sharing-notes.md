Remaining tasks related to sharing:
[ ] squelch share instructions to prevent honoring malicious share instructions
[ ] trigger for visible nodes only on share instruction update - NOT all nodes registered in the ShareState object
[ ] Iterate over accumulator and expunge those items which are descendent of other items in the accumulator
[ ] fully read the below notes

Other notes:
NOTE: We do NOT want to consider node residency for any sharing operation.
We are doing it now ONLY at the share instruction root because we don't yet have any other way of doing it.
TODO: add context: {backrefId?: string, viewModelType: string } to the share instruction, and build a method of positively
creating that Node (or precisely matching an existing Node) versus hoping that it's resident, and
risking that other nodes are erroneously traversed which are outside of the context which was intended to be shared.
This means, when you create a share instruction, you are saying:
"Share this TopicSpaceMember(backrefId + vertexId)" {type: "TopicSpaceMember", backrefId: "xxx", vertexId:"xxx"}
you are not saying to share this topicspace member from the context of a Sticky
This means that the sharing rules can be evaluated in isolation, without needing to lean on the renderer having been run
This makes it more deterministic, and more reliable.
We may need to do this sooner than later, because we have memory leaks, and that means that more stuff
will be resident than we actually want to share
const adminID = [await this.vertex.userID.get()];
TODO: When we optimize triggerPrivReevaluation to memoize priv coalescence in that moment
(or calculate it on a rolling/observable basis) remember to make sure we always update the
visibleUserIDsForDescendants for the root node. If we don't call it expressly here, then visibleUserIDsForDescendants will not
be recalculated in cases where there are no child nodes - thus presenting an opportunity for later
items to appear which should be squelched.
We kind of don't need to do this, but we KNOW that the share instructions
have changed for this vertex, and in the interest of correctness, we must ensure that
we update visibleUserIDsForDescendants. Therefore, we are blackmailing our future
selves into calling this at least once for each of this.nodes, rather than implicitly relying on
the children to trigger it
i.e. this is being called in order to ensure that share instructions are DEFINITELY coalesced on a lone /// parent
