import { createColoredEmbed } from '@/components/embed'
import { InteractionHandler } from '@/interaction'
import { SokujiUserService } from '@/services/sokuji'
import { Sokuji, createTextError, sokujiLock } from '@/utilities'
import { ComponentType, MessageComponentInteraction, ModalSubmitInteraction, TextInputStyle } from 'discord.js'

const checkConfig = (options: {
    sokuji: Sokuji
    interaction: MessageComponentInteraction | ModalSubmitInteraction
}) => {
    if (options.sokuji.configMessageId === options.interaction.message?.id) return
    options.interaction.deleteReply().catch(() => {})
    throw createTextError(
        'The options of the completed sokuji cannot be changed. Please resume it and try again.',
        '終了した即時集計の設定は変更できません。変更するには再開してから行って下さい。',
    )
}

InteractionHandler.button.register({
    commands: ['sokuji', 'config', 'lang'],
    handle: async (interaction, [lang]) => {
        await interaction.deferUpdate()
        await sokujiLock.acquire(interaction.channelId, async () => {
            const sokuji = await Sokuji.loadNow(interaction.channelId, true)
            checkConfig({ sokuji, interaction })
            sokuji.isJa = lang === 'ja'
            await Promise.all([
                sokuji.editPrevMessage(interaction.client, { embeds: 'overwrite', components: 'overwrite' }),
                interaction.editReply(await sokuji.createConfigMessage()),
            ])
            await sokuji.saveWithPendingRace(true, true)
        })
    },
})

InteractionHandler.button.register({
    commands: ['sokuji', 'config', 'text'],
    handle: async (interaction, [command]) => {
        await interaction.deferUpdate()
        await sokujiLock.acquire(interaction.channelId, async () => {
            const sokuji = await Sokuji.loadNow(interaction.channelId, true)
            checkConfig({ sokuji, interaction })
            sokuji.showText = command === 'show'
            await Promise.all([
                sokuji.editPrevMessage(interaction.client, { content: 'overwrite' }),
                interaction.editReply({ components: sokuji.createConfigComponents() }),
            ])
            await sokuji.saveWithPendingRace(true, true)
        })
    },
})

InteractionHandler.button.register({
    commands: ['sokuji', 'config', 'image'],
    handle: async (interaction, [command]) => {
        await interaction.deferUpdate()
        await sokujiLock.acquire(interaction.channelId, async () => {
            const sokuji = await Sokuji.loadNow(interaction.channelId, true)
            checkConfig({ sokuji, interaction })
            sokuji.showImage = command === 'show'
            await Promise.all([
                sokuji.editPrevMessage(interaction.client, { embeds: 'overwrite', files: 'overwrite' }),
                interaction.editReply({ components: sokuji.createConfigComponents() }),
            ])
            await sokuji.saveWithPendingRace(true, true)
        })
    },
})

InteractionHandler.stringSelect.register({
    commands: ['sokuji', 'config', 'mode'],
    handle: async (interaction) => {
        await interaction.deferUpdate()
        await sokujiLock.acquire(interaction.channelId, async () => {
            const sokuji = await Sokuji.loadNow(interaction.channelId, true)
            checkConfig({ sokuji, interaction })
            sokuji.mode = interaction.values[0] as Sokuji['mode']
            await Promise.all([
                sokuji.editPrevMessage(interaction.client, { embeds: 'overwrite' }),
                interaction.editReply({ components: sokuji.createConfigComponents() }),
            ])
            await sokuji.saveWithPendingRace(true, true)
        })
    },
})

InteractionHandler.button.register({
    commands: ['sokuji', 'config', 'widget'],
    handle: async (interaction) => {
        await interaction.deferReply({ ephemeral: true })
        const [_, embed] = await Promise.all([
            SokujiUserService.default.putChannelId(interaction.user.id, interaction.channelId),
            createColoredEmbed(interaction.guildId),
        ])
        const isJa = interaction.locale === 'ja'
        await interaction.followUp({
            embeds: [
                embed
                    .setTitle(isJa ? '配信ウィジェットURL' : 'Stream Widget URL')
                    .setDescription(
                        isJa
                            ? '- ユーザー毎のURLは固定で変化しません。\n- 同じチャンネルで即時集計を続ける場合、再実行する必要はありません。\n' +
                                  `### <@${interaction.user.id}> さん用\nhttps://mk8dx.pages.dev/sokuji?user_id=${interaction.user.id}`
                            : '- The URL for each user is fixed and does not change.\n- If you want to continue sokuji on the same channel, you do not need to rerun it.\n' +
                                  `### For <@${interaction.user.id}>\nhttps://mk8dx.pages.dev/sokuji?user_id=${interaction.user.id}`,
                    ),
            ],
        })
    },
})

InteractionHandler.button.register({
    commands: ['sokuji', 'config', 'tags'],
    handle: async (interaction, [option]) => {
        const tags = option.split(' ')
        const isJa = interaction.locale === 'ja'
        await interaction.showModal({
            customId: `sokuji_config_tags_${tags.length}`,
            title: isJa ? 'タグを変更' : 'Edit Tags',
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.TextInput,
                            customId: 'tags',
                            style: TextInputStyle.Paragraph,
                            label: isJa ? 'すべてのタグを改行区切りで入力' : 'Enter all tags separated by line breaks',
                            value: tags.join('\n'),
                            required: true,
                        },
                    ],
                },
            ],
        })
    },
})

InteractionHandler.modalSubmit.register({
    commands: ['sokuji', 'config', 'tags'],
    handle: async (interaction, [teamNum]) => {
        await interaction.deferReply()
        const tags = interaction.fields
            .getTextInputValue('tags')
            .split('\n')
            .map((tag) => tag.replace(/\s/g, '').slice(0, 10))
            .filter((tag) => tag)
        const invalidTagsLength = createTextError('The number of tags is incorrect.', 'タグの数が正しくありません。')
        if (tags.length !== Number(teamNum)) throw invalidTagsLength
        await sokujiLock.acquire(interaction.channelId!, async () => {
            const sokuji = await Sokuji.loadNow(interaction.channelId!, true)
            checkConfig({ sokuji, interaction })
            if (tags.length !== sokuji.teamNum) throw invalidTagsLength
            sokuji.tags = tags
            await Promise.all([
                sokuji.editConfigMessage(interaction.client, { components: 'overwrite' }),
                sokuji.editPrevMessage(interaction.client, {
                    embeds: 'overwrite',
                    files: 'overwrite',
                    components: 'overwrite',
                }),
                interaction.followUp(sokuji.isJa ? 'タグを変更しました。' : 'Tags have been edited.'),
            ])
            await sokuji.saveWithPendingRace(true)
        })
    },
})

InteractionHandler.button.register({
    commands: ['sokuji', 'config', 'raceNum'],
    handle: async (interaction) => {
        const isJa = interaction.locale === 'ja'
        await interaction.showModal({
            customId: 'sokuji_config_raceNum',
            title: isJa ? 'レース数を変更' : 'Edit Total Races',
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.TextInput,
                            customId: 'raceNum',
                            style: TextInputStyle.Short,
                            label: isJa ? 'レース数を数字で入力' : 'Enter the total races as a number',
                            placeholder: '12',
                            required: true,
                        },
                    ],
                },
            ],
        })
    },
})

InteractionHandler.modalSubmit.register({
    commands: ['sokuji', 'config', 'raceNum'],
    handle: async (interaction) => {
        const raceNum = parseInt(interaction.fields.getTextInputValue('raceNum'))
        if (!Number.isInteger(raceNum)) throw createTextError('Invalid value.', '値が不正です。')
        if (raceNum < 1)
            throw createTextError('Please specify a value greater than or equal to 1.', '1以上の値を指定してください。')
        if (raceNum >= 100)
            throw createTextError('Please specify a value less than 100.', '100未満の値を指定してください。')
        await interaction.deferReply()
        await sokujiLock.acquire(interaction.channelId!, async () => {
            const sokuji = await Sokuji.loadNow(interaction.channelId!, true)
            checkConfig({ sokuji, interaction })
            if (raceNum < sokuji.races.length)
                throw createTextError(
                    `More than the specified number of races have already been registered. Please specify a value greater than or equal to ${sokuji.races.length}.`,
                    `すでに指定されたレース数以上登録されています。${sokuji.races.length}以上の値を指定してください。`,
                )
            sokuji.raceNum = raceNum
            await Promise.all([
                sokuji.editPrevMessage(interaction.client, {
                    content: 'overwrite',
                    embeds: 'overwrite',
                    files: 'overwrite',
                    components: 'overwrite',
                }),
                interaction.followUp(sokuji.isJa ? 'レース数を変更しました。' : 'Total races has been edited.'),
            ])
            if (sokuji.raceNum <= sokuji.races.length) await sokuji.save(true)
            else await sokuji.saveWithPendingRace(true)
        })
    },
})
