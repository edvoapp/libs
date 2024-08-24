The template ( scaffold tree )
[T1] "Template 1"
\--- _ [S1] "This suggests"
\--- _ [S2] "My questions"
\--- \* [S3] "I Think"

The fully-created user tree
[A1] (the page vertex)
|--- _ [U1] "This suggests"
|--- _ [U2] "My questions"
|--- \* [U3] "I Think"

Approach 1 BEFORE
[A1] (the page vertex)
|--- _ [S1] "This suggests" (embed) - head
|--- _ [S2] "My questions" (embed) - item
|--- _ [S3] "I Think" (embed) - tail
|--- _ [S11] "Meow" (embed) - head
|--- _ [S12] "Woof" (embed) - item
|--- _ [S13] "Blah" (embed) - tail

[A1] (the page vertex)
|--- _ [S1] "This suggests" (embed) Chilren of S1 (suppress rendering of S1)
|--- _ [U1] "This suggests" + \-(shadow) Children of U1 Children of [S1,U1] \* [S4] ET"What are the main?" (embed)
|--- _ [S2] "My questions" (embed)
|--- _ [U2] "My questions" + \-(shadow) \* [S5] ET "What do you want to dig into more?" (embed)
|--- _ [S3] "I Think" (embed)
|--- _ [U3] "I Think" + \ (shadow) \* [S6] ET "Write out your thoughts" (embed)

The partially created user tree
[A1] (the page vertex)
\ [T1] (embed)
\

Approach 2 BEFORE
[A1] (the page vertex)
\--- \* [T1] "Template 1" (embed)

<div class="no-indent"> - color this blurple
  <div>This suggests</div>
  <div>My questions</div>
  <div>I think</div>
</div>
<div>This suggests</div>

[
T1 [1h,2i,3t],
T2 [Ah,Bi,Ct]
]

Approach 3 - Just attach to the template dammit
//

| \ ( category-embed -
| \--- _ [S1] "Template 1"
| \--- _ [U1] "template 1"
| |
| | (category-shadow)
| V
| \ Thead,item,tail)
| ^
| \
| _ [S2] "I think"
| T
| ^ (category-shadow)
|(head,it) |
| cat- |
\---------- _ [U1] "I think" (no actual body vertex. Created lazily)

- Post tail s
  Note: There's a little bit more to discuss, because I think we have
  to shadow this tree structure (triggered via some tainted/shadowed flag)
  so as to create unique identities for each sub-bullet, thus creating a new (text body-free) "I think"
  vertex that references the PUBLIC "I think vertex"
