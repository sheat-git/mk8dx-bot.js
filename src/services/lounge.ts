/* eslint-disable @typescript-eslint/no-explicit-any */
import { Lounge } from 'mk8dx'
import { createTextError } from '@/utilities'

type ServiceFunction<F extends (params: any) => Promise<any>> = F extends (params: infer P) => Promise<infer R>
    ? <B extends boolean = false>(params: P, ignoreError?: B) => B extends true ? Promise<R | undefined> : Promise<R>
    : never

const wrapFetch = <F extends (params: any) => Promise<any>>(
    fetch: F,
    options: {
        kind: string
        kindJa: string
        createName?: (params: Parameters<F>[0]) => string | undefined
    },
): ServiceFunction<F> => {
    const kind = options.kind.toLowerCase()
    const upperKind = kind[0].toUpperCase() + kind.slice(1)
    return (async (params: Parameters<F>[0], ignoreError?: boolean) => {
        try {
            return await fetch(params)
        } catch (error) {
            if (ignoreError) return
            if (error instanceof Lounge.ApiError && error.status == 404) {
                const name = options.createName?.(params)
                const nameText = name ? ` (${name})` : ''
                throw createTextError(
                    `${upperKind}${nameText} not found.`,
                    `${options.kindJa}${nameText}が見つかりません。`,
                )
            }
            throw createTextError(
                `An error occurred while fetching ${kind}. It is possible that "mk8dx-lounge.com" is down.`,
                `${options.kindJa}の取得中にエラーが発生しました。"mk8dx-lounge.com"がダウンしている可能性があります。`,
            )
        }
    }) as ServiceFunction<F>
}

export const getPlayer = wrapFetch(Lounge.getPlayer, {
    kind: 'player',
    kindJa: 'プレイヤー',
    createName: (params) => {
        if (params.name) return params.name
        if (params.discordId) return `<@${params.discordId}>`
        if (params.fc) return params.fc
    },
})

export const getPlayerDetails = wrapFetch(Lounge.getPlayerDetails, {
    kind: 'player',
    kindJa: 'プレイヤー',
    createName: (params) => {
        if (params.name) return params.name
    },
})

export const getTable = wrapFetch(Lounge.getTable, {
    kind: 'table',
    kindJa: 'テーブル',
    createName: ({ tableId }) => `ID: ${tableId}`,
})

export const getTableUnverified = wrapFetch(Lounge.getTableUnverified, {
    kind: 'table',
    kindJa: 'テーブル',
})

export const getPenaltyList = wrapFetch(Lounge.getPenaltyList, {
    kind: 'penalty',
    kindJa: 'ペナルティ',
    createName: ({ name }) => name,
})
