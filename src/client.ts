import { ActivityType, Client, Partials } from 'discord.js'
import { handleInteraction, setCommands } from './interaction'
import { handleMessage } from './message'
import './features'

const client = new Client({
    shards: 'auto',
    intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'DirectMessages', 'MessageContent'],
    partials: [Partials.Channel, Partials.Message],
})

const updateActivity = (options: { client: Client<true> }) => {
    options.client.user.setActivity(`%sheat - ${client.guilds.cache.size} servers`, {
        type: ActivityType.Watching,
    })
}

client.once('ready', async (client) => {
    updateActivity({ client })
    await setCommands(client.application, true)
})
client.on('guildCreate', updateActivity)
client.on('guildDelete', updateActivity)

client.on('messageCreate', handleMessage)
client.on('interactionCreate', handleInteraction)

client.on('error', (error) => {
    console.error(error)
})

export default client
