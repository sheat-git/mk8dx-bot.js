import { Command, createTextError } from '@/utilities'

export class MakeSubmitCommand extends Command<{
    arg: string
}> {
    async run() {
        const { teams, isSq } = extractTeams(this.options.arg)
        const tier = isSq
            ? 'SQ'
            : detectTier(teams.map((team) => team.averageMmr).filter((mmr) => mmr !== undefined) as number[])
        await this.reply({
            content:
                `!submit ${12 / teams.length} ${tier ?? 'tier'}\n` +
                teams.map((team) => team.players.map((player) => player + ' 0').join('\n')).join('\n'),
        })
    }
}

export const extractTeams = (
    text: string,
): {
    teams: {
        players: string[]
        averageMmr?: number
    }[]
    isSq?: boolean
} => {
    const sqMatches = [...text.matchAll(/`?\d\.`? ((?:[\w .-]+, ){0,5}[\w .-]+) \((\d+) MMR\)?/g)]
    if (sqMatches.length) {
        return {
            isSq: true,
            teams: sqMatches.map((match) => ({
                players: match[1].split(', '),
                averageMmr: parseInt(match[2]),
            })),
        }
    }
    const matches = [...text.matchAll(/`?(?:Team \d|\d{1,2})`?: ((?:[\w .-]+, ){0,3}[\w .-]+) \(MMR: (\d+)\)/g)]
    if (matches.length) {
        return {
            teams: matches.map((match) => ({
                players: match[1].split(', '),
                averageMmr: parseInt(match[2]),
            })),
        }
    }
    const scoreboardMatch = text.match(/!scoreboard (\d{1,2}) ((?:[\w .-]+, ){11}[\w .-]+)/)
    if (scoreboardMatch) {
        const numTeams = parseInt(scoreboardMatch[1])
        const format = 12 / numTeams
        const players = scoreboardMatch[2].split(', ')
        return {
            teams: [...Array(numTeams)].map((_, i) => ({
                players: players.slice(i * format, (i + 1) * format),
            })),
        }
    }
    throw createTextError(
        'Invalid format. Provide the valid text of the mogi room.',
        '形式が正しくありません。模擬部屋のテキストを正しく入力してください。',
    )
}

const detectTier = (averageMmrs: number[]) => {
    if (!averageMmrs.length) return
    const minMmr = Math.min(...averageMmrs)
    if (14000 <= minMmr) return 'X'
    if (13000 <= minMmr) return 'S'
    if (12000 <= minMmr) return 'A'
    const maxMmr = Math.max(...averageMmrs)
    if (11000 <= minMmr && maxMmr < 13000) return 'AB'
    if (10000 <= minMmr && maxMmr < 12000) return 'B'
    if (9000 <= minMmr && maxMmr < 11000) return 'BC'
    if (8000 <= minMmr && maxMmr < 10000) return 'C'
    if (7000 <= minMmr && maxMmr < 9000) return 'CD'
    if (6000 <= minMmr && maxMmr < 8000) return 'D'
    if (5000 <= minMmr && maxMmr < 7000) return 'DE'
    if (4000 <= minMmr && maxMmr < 6000) return 'E'
    if (3000 <= minMmr && maxMmr < 5000) return 'EF'
    if (2000 <= minMmr && maxMmr < 4000) return 'F'
    if (1000 <= minMmr && maxMmr < 3000) return 'FG'
    if (0 <= minMmr && maxMmr < 2000) return 'G'
}
