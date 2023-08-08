import { InteractionHandler } from '@/interaction'
import { TrackItem, TrackService } from '@/services/track'
import { createTextError } from '@/utilities'
import { ComponentType, ModalSubmitInteraction, TextInputStyle } from 'discord.js'
import { searchTrack } from 'mk8dx'
import { createTrackSettingsMessage } from './command'

const getTrack = async (interaction: ModalSubmitInteraction) => {
    const isGuild = interaction.message!.embeds[0].title?.startsWith('Server') ?? false
    const id = isGuild ? interaction.guildId! : interaction.user.id
    return {
        guild: isGuild ? interaction.guild! : undefined,
        id,
        track:
            (await TrackService[isGuild ? 'guild' : 'user'].get(id)) ??
            ({ ignores: [], additionals: Object.create(null) } as TrackItem),
    }
}

InteractionHandler.button.register({
    commands: ['tracks', 'settings', 'dictionary', 'add'],
    handle: async (interaction) => {
        const isJa = interaction.locale === 'ja'
        await interaction.showModal({
            customId: 'tracks_settings_dictionary_add',
            title: isJa ? '辞書に追加' : 'Add to Dictionary',
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.TextInput,
                            customId: 'word',
                            label: isJa ? '単語' : 'Alias',
                            placeholder: isJa ? '1つ目のコース' : 'first track',
                            style: TextInputStyle.Short,
                            required: true,
                        },
                    ],
                },
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.TextInput,
                            customId: 'name',
                            label: isJa ? 'コース名' : 'Track Name',
                            placeholder: isJa ? 'マリカス' : 'mks',
                            style: TextInputStyle.Short,
                            required: true,
                        },
                    ],
                },
            ],
        })
    },
})

InteractionHandler.modalSubmit.register({
    commands: ['tracks', 'settings', 'dictionary', 'add'],
    handle: async (interaction) => {
        const name = interaction.fields.getTextInputValue('name')
        const trackId = searchTrack(name)?.id
        if (trackId === undefined)
            throw createTextError(`No track found for ${name}.`, `${name}のコースが見つかりません。`)
        await interaction.deferUpdate()
        const { guild, id, track } = await getTrack(interaction)
        const word = interaction.fields.getTextInputValue('word')
        track.additionals[word] = trackId
        await TrackService[guild ? 'guild' : 'user'].put(id, track)
        const isJa = interaction.locale === 'ja'
        await interaction.editReply(await createTrackSettingsMessage({ guild, id, isJa }))
        await interaction.followUp({
            content: isJa ? `${word} を辞書に追加しました。` : `Added ${word} to the dictionary.`,
            ephemeral: !guild,
        })
    },
})

InteractionHandler.button.register({
    commands: ['tracks', 'settings', 'dictionary', 'remove'],
    handle: async (interaction) => {
        const isJa = interaction.locale === 'ja'
        await interaction.showModal({
            customId: 'tracks_settings_dictionary_remove',
            title: isJa ? '辞書から削除' : 'Remove from Dictionary',
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.TextInput,
                            customId: 'words',
                            label: isJa ? '単語' : 'Aliases',
                            placeholder: isJa ? '改行区切り' : 'separated by line breaks',
                            style: TextInputStyle.Paragraph,
                            required: true,
                        },
                    ],
                },
            ],
        })
    },
})

InteractionHandler.modalSubmit.register({
    commands: ['tracks', 'settings', 'dictionary', 'remove'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        const { guild, id, track } = await getTrack(interaction)
        const words: string[] = []
        for (const word of interaction.fields.getTextInputValue('words').split('\n')) {
            if (word in track.additionals) {
                words.push(word)
                delete track.additionals[word]
            }
        }
        await TrackService[guild ? 'guild' : 'user'].put(id, track)
        const isJa = interaction.locale === 'ja'
        await interaction.editReply(await createTrackSettingsMessage({ guild, id, isJa }))
        await interaction.followUp({
            content:
                (isJa ? '以下を辞書から削除しました。' : 'Removed the following from the dictionary.') +
                '\n' +
                words.map((v) => `- ${v}`).join('\n'),
            ephemeral: !guild,
        })
    },
})

InteractionHandler.button.register({
    commands: ['tracks', 'settings', 'ignores', 'add'],
    handle: async (interaction) => {
        const isJa = interaction.locale === 'ja'
        await interaction.showModal({
            customId: 'tracks_settings_ignores_add',
            title: isJa ? '無視リストに追加' : 'Add to Ignores',
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.TextInput,
                            customId: 'words',
                            label: isJa ? '単語' : 'Aliases',
                            placeholder: isJa ? '改行区切り' : 'separated by line breaks',
                            style: TextInputStyle.Paragraph,
                            required: true,
                        },
                    ],
                },
            ],
        })
    },
})

InteractionHandler.modalSubmit.register({
    commands: ['tracks', 'settings', 'ignores', 'add'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        const { guild, id, track } = await getTrack(interaction)
        const words: string[] = []
        for (const word of interaction.fields.getTextInputValue('words').split('\n')) {
            if (!track.ignores.includes(word)) {
                words.push(word)
                track.ignores.push(word)
            }
        }
        await TrackService[guild ? 'guild' : 'user'].put(id, track)
        const isJa = interaction.locale === 'ja'
        await interaction.editReply(await createTrackSettingsMessage({ guild, id, isJa }))
        await interaction.followUp({
            content:
                (isJa ? '以下を無視リストに追加しました。' : 'Added the following to the ignores.') +
                '\n' +
                words.map((v) => `- ${v}`).join('\n'),
            ephemeral: !guild,
        })
    },
})

InteractionHandler.button.register({
    commands: ['tracks', 'settings', 'ignores', 'remove'],
    handle: async (interaction) => {
        const isJa = interaction.locale === 'ja'
        await interaction.showModal({
            customId: 'tracks_settings_ignores_remove',
            title: isJa ? '無視リストから削除' : 'Remove from Ignores',
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.TextInput,
                            customId: 'words',
                            label: isJa ? '単語' : 'Aliases',
                            placeholder: isJa ? '改行区切り' : 'separated by line breaks',
                            style: TextInputStyle.Paragraph,
                            required: true,
                        },
                    ],
                },
            ],
        })
    },
})

InteractionHandler.modalSubmit.register({
    commands: ['tracks', 'settings', 'ignores', 'remove'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        const { guild, id, track } = await getTrack(interaction)
        const words: string[] = []
        for (const word of interaction.fields.getTextInputValue('words').split('\n')) {
            if (track.ignores.includes(word)) {
                words.push(word)
                track.ignores.splice(track.ignores.indexOf(word), 1)
            }
        }
        await TrackService[guild ? 'guild' : 'user'].put(id, track)
        const isJa = interaction.locale === 'ja'
        await interaction.editReply(await createTrackSettingsMessage({ guild, id, isJa }))
        await interaction.followUp({
            content:
                (isJa ? '以下を無視リストから削除しました。' : 'Removed the following from the ignores.') +
                '\n' +
                words.map((v) => `- ${v}`).join('\n'),
            ephemeral: !guild,
        })
    },
})
