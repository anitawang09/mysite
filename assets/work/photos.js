/*
 * Photos for the work-history polaroids.
 *
 * A plain script rather than a JSON file the page fetches, so the site works
 * when index.html is opened straight from disk — fetch() refuses file:// URLs,
 * which used to leave every card on its monogram.
 *
 * The key is the card's data-photo in index.html; the value is a file in this
 * folder, either on its own or with alt text describing the picture. Anything
 * left out keeps its monogram panel, which is a finished look in itself.
 */
window.WORK_PHOTOS = {
  atsa: {
    file: 'atsa.jpg',
    alt: 'Three student association members posing with a cat-shaped party balloon held overhead',
  },
  akitsu: {
    file: 'akitsu.jpg',
    alt: 'A bowl of beef curry with rice and greens on the restaurant bar, beside a reserved sign',
  },
  pharmalinx: {
    file: 'pharmalinx.jpg',
    alt: 'Gloved hands compounding medication with a mortar and pestle at a pharmacy bench, stock shelves behind',
  },
  kodis: {
    file: 'kodis.jpg',
    alt: "Kodi's Pawathon logo: a chocolate labrador inside a ring of paw prints, captioned Fun Run for Humans and Dogs, Supporting Cancer Research",
  },
  fantuan: {
    file: 'fantuan.jpg',
    alt: 'A campus event refreshment table: coffee urns, cream carafes, stacked cups and trays of iced cupcakes',
  },
};
