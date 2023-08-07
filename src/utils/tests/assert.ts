import * as uvuAssert from "uvu/assert";

const assert = {
    ...uvuAssert,
    close: (actual: number, expected: number, delta = 0.01) => {
        uvuAssert.ok(
            Math.abs(actual - expected) < delta,
            `Expected ${actual} to be close to ${expected}`
        );
    },
};

export default assert;
