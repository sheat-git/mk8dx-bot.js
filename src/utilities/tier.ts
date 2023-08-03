export const calcTierIndex = (tier: string): number => {
    switch (tier) {
        case 'SQ':
            return -1
        case 'X':
            return 0
        case 'S':
            return 1
    }
    return [...Array(tier.length)].map((_, i) => tier.charCodeAt(i)).reduce((a, c) => a + c, 0) / tier.length
}
