// Cards from their smallest size to their largest. The cards in a row share its width, shrinking
// down to their smallest so that cardsPerRow of them fit; a width with room for more at their
// largest fits as many as it can at that size rather than making them bigger, and a narrower one
// fits fewer (never bigger than their largest either). The home screen's square cards are sized
// the same way (homeCardGrid, five to a row).
export function cardGrid(
    width: number,
    gap: number,
    minCardSize: number,
    maxCardSize: number,
    cardsPerRow: number,
) {
    const atLargest = Math.floor((width + gap) / (maxCardSize + gap));
    if (atLargest >= cardsPerRow) {
        return { cardsPerRow: atLargest, cardSize: maxCardSize };
    }
    const fitting = Math.max(
        1,
        Math.min(cardsPerRow, Math.floor((width + gap) / (minCardSize + gap))),
    );
    return {
        cardsPerRow: fitting,
        cardSize: Math.min(maxCardSize, (width - (fitting - 1) * gap) / fitting),
    };
}
