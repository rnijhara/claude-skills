module.exports = [
  { id: 'intro', chapter: 'Intro', introCard: { kicker: 'Example', title: 'Hello orders', big: true }, say: 'This is a short example walkthrough.' },
  { id: 'load', act: async h => { await h.uncard(); await h.cut(() => h.waitLoaded(), 'Loading'); } },
  { id: 'add', chapter: 'Adding an order', act: async h => { await h.cursor(true); await h.ring(h.area('aboveFrame'), { label: 'Host header', place: 'below', pad: 0 }); await h.at(0.5); await h.unring(); await h.click(h.loc('#add')); await h.ring(h.loc('#list'), { label: 'New order' }); },
    say: 'The host header sits above the product. I add an order, and it appears in the list.' },
  { id: 'end', pre: async h => { await h.unring(); await h.note('Every action is timed to the narration.', { kicker: 'Note' }); }, say: "That's the whole flow.", gap: 600 },
];
