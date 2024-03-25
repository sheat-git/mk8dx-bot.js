import { ActivityType, Client, Partials } from 'discord.js'
import { handleInteraction, setCommands } from './interaction'
import { handleMessage } from './message'
import './features'
import { setupCanvas, setupChart } from './utilities'

setupCanvas()
setupChart()

const client = new Client({
    intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'DirectMessages', 'MessageContent'],
    partials: [Partials.Channel, Partials.Message],
})

const updateActivity = async (options: { client: Client<true> }) => {
    const size =
        (await options.client.shard?.broadcastEval((c) => c.guilds.cache.size))?.reduce((a, b) => a + b) ??
        options.client.guilds.cache.size
    options.client.user.setActivity(`%sheat - ${size} servers`, {
        type: ActivityType.Watching,
    })
}

client.once('ready', async (client) => {
    await Promise.all([updateActivity({ client }), setCommands(client.application, true)])
})
client.on('guildCreate', updateActivity)
client.on('guildDelete', updateActivity)

client.on('messageCreate', handleMessage)
client.on('interactionCreate', handleInteraction)

client.on('error', (error) => {
    console.error(error)
})

client.login()
