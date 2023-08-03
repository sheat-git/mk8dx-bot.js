import { createColoredEmbed } from '@/components/embed'
import { MessageHandler } from '@/message'
import { SokujiConfigService, SokujiUserService } from '@/services/sokuji'
import { Sokuji } from '@/utilities'

MessageHandler.withPrefix.register({
    commands: ['japanize', 'japanese', 'japan', 'jp', 'ja', 'englishize', 'english', 'en'],
    handle: async (message) => {
        const sokuji = await Sokuji.loadNow(message.channelId, true)
        await message.channel.send({
            content: sokuji.isJa
                ? 'Switch to English by pressing the "English" button in the options.'
                : '日本語への変更は設定の「日本語」ボタンを押してください。',
            reply: sokuji.configMessageId
                ? {
                      messageReference: sokuji.configMessageId,
                      failIfNotExists: false,
                  }
                : undefined,
        })
    },
})

MessageHandler.withPrefix.register({
    commands: ['widget', 'banner', 'obs', 'o'],
    handle: async (message) => {
        const userIds = message.mentions.users.size ? [...message.mentions.users.keys()] : [message.author.id]
        const [config, embed] = await Promise.all([
            SokujiConfigService.default.get(message.channelId),
            createColoredEmbed(message.guildId),
            ...userIds.map((userId) => SokujiUserService.default.putChannelId(userId, message.channelId)),
        ])
        const { isJa } = config ?? {}
        await message.channel.send({
            embeds: [
                embed
                    .setTitle(isJa ? '配信ウィジェットURL' : 'Stream Widget URL')
                    .setDescription(
                        isJa
                            ? '- ユーザー毎のURLは固定で変化しません。\n- 同じチャンネルで即時集計を続ける場合、再実行する必要はありません。\n' +
                                  userIds
                                      .map(
                                          (userId) =>
                                              `### <@${userId}> さん用\nhttps://mk8dx.pages.dev/sokuji?user_id=${userId}`,
                                      )
                                      .join('\n')
                            : '- The URL for each user is fixed and does not change.\n- If you want to continue sokuji on the same channel, you do not need to rerun it.\n' +
                                  userIds
                                      .map(
                                          (userId) =>
                                              `### For <@${userId}>\nhttps://mk8dx.pages.dev/sokuji?user_id=${userId}`,
                                      )
                                      .join('\n'),
                    ),
            ],
        })
    },
})

MessageHandler.withPrefix.register({
    commands: ['tag', 'tags'],
    handle: async (message) => {
        const sokuji = await Sokuji.loadNow(message.channelId, true)
        await message.channel.send({
            content: sokuji.isJa
                ? 'タグの変更は設定の「タグ変更」ボタンから行ってください。'
                : 'Edit tags from the "Edit Tags" button in the options.',
            reply: sokuji.configMessageId
                ? {
                      messageReference: sokuji.configMessageId,
                      failIfNotExists: false,
                  }
                : undefined,
        })
    },
})

MessageHandler.withPrefix.register({
    commands: ['totalRaceNum', 'raceNum', 'trn', 'rn'],
    handle: async (message) => {
        const sokuji = await Sokuji.loadNow(message.channelId, true)
        await message.channel.send({
            content: sokuji.isJa
                ? 'レース数の変更は設定の「レース数変更」ボタンから行ってください。'
                : 'Edit total races from the "Edit Total Races" button in the options.',
            reply: sokuji.configMessageId
                ? {
                      messageReference: sokuji.configMessageId,
                      failIfNotExists: false,
                  }
                : undefined,
        })
    },
})
