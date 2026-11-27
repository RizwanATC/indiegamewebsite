// Forest Liar story: short talking scenes between chapters.
// Each scene plays once (the first time you reach that point by playing on),
// before level `before` (an index into levels.js) or before the ending.
// `bg` is the chapter backdrop (0 day, 1 sunset, 2 dusk). Lines are
// [speaker, text]; speakers are keys of `cast`. Pip always stands on the left.
window.FOREST_LIAR_STORY = {
  cast: {
    PIP: { sprite: 'pip_idle', color: '#f4ecd2' },
    SIGN: { sprite: 'sign', color: '#f39a3d' },
    MUSHROOM: { sprite: 'shroom_face', color: '#ff8d7a' },
    BUSH: { sprite: 'bush', color: '#8cc63e' },
    STUMP: { sprite: 'stump', color: '#d9a066' },
    STAGEHAND: { sprite: 'tree_face', color: '#c99cf2' },
    'OLD OAK': { sprite: 'boss_tree', color: '#f7c948' },
  },
  scenes: [
    {
      id: 'intro',
      before: 0,
      bg: 0,
      title: 'CHAPTER 1: FRIENDLY FOREST',
      lines: [
        ['PIP', 'One letter. One forest. One very easy delivery.'],
        ['PIP', 'The envelope says: TO THE MAILBOX AT THE END OF THE WOODS. How hard can it be?'],
        ['SIGN', 'HELLO! WELCOME! NOTHING IN THIS FOREST IS A TRAP!'],
        ['PIP', '...Why would you say that?'],
        ['SIGN', 'NO REASON. HAVE A LOVELY WALK.'],
      ],
    },
    {
      id: 'chapter2',
      before: 4,
      bg: 1,
      title: 'CHAPTER 2: TRICKSTER GROVE',
      lines: [
        ['BUSH', 'Achoo! Sorry. You got through the Friendly Forest?'],
        ['PIP', 'Barely. Everything in there lied to me.'],
        ['BUSH', 'Oh, that was the FRIENDLY part. This is Trickster Grove.'],
        ['MUSHROOM', 'The trees here play a game. They move the finish line.'],
        ['PIP', 'Nobody can move a mailbox.'],
        ['MUSHROOM', '...Good luck!'],
      ],
    },
    {
      id: 'chapter3',
      before: 8,
      bg: 2,
      title: 'CHAPTER 3: THE LAST JOKE',
      lines: [
        ['STUMP', 'Psst. Courier. Who is that letter for?'],
        ['PIP', 'No idea. On the back it just says: FOR THE WHOLE FOREST.'],
        ['STUMP', 'The whole forest? Then everyone wants to read it first.'],
        ['PIP', 'Nobody reads a letter before it is delivered. Courier rules.'],
        ['STUMP', 'Then the Stagehand will put on a show to stop you. Watch the curtains.'],
      ],
    },
    {
      id: 'finale',
      before: 11,
      bg: 2,
      title: 'THE FINAL DELIVERY',
      lines: [
        ['STAGEHAND', 'AND... SCENE! You ruined my best act, raccoon.'],
        ['PIP', 'Your act tried to drop me into spikes.'],
        ['STAGEHAND', 'That is showbiz. One stage left. Every trick we have, all at once.'],
        ['PIP', 'Then I will deliver it all at once.'],
      ],
    },
    {
      id: 'outro',
      before: 'ending',
      bg: 2,
      title: 'DELIVERED',
      lines: [
        ['OLD OAK', 'So. You are the courier who walked through every lie in my forest.'],
        ['PIP', 'And fell for most of them. Here. One letter, slightly squashed.'],
        ['OLD OAK', 'For the whole forest? Then I shall read it out loud.'],
        ['PIP', 'Go on. I want to know what I nearly died for. Twelve times.'],
      ],
    },
  ],
};
