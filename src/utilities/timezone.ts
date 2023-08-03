import { Locale } from 'discord.js'

export const expectTimezone = (locale?: Locale): Timezone => {
    switch (locale) {
        case Locale.Japanese:
        case Locale.Korean:
            return 'Asia/Tokyo'
        case Locale.ChineseCN:
        case Locale.ChineseTW:
            return 'Asia/Shanghai'
        case Locale.Indonesian:
        case Locale.Thai:
        case Locale.Vietnamese:
            return 'Asia/Bangkok'
        case Locale.Hindi:
            return 'Asia/Kolkata'
        case Locale.Russian:
        case Locale.Turkish:
            return 'Europe/Moscow'
        case Locale.Bulgarian:
        case Locale.Finnish:
        case Locale.Greek:
        case Locale.Lithuanian:
        case Locale.Romanian:
        case Locale.Ukrainian:
            return 'Europe/Athens'
        case Locale.Croatian:
        case Locale.Czech:
        case Locale.Danish:
        case Locale.Dutch:
        case Locale.French:
        case Locale.German:
        case Locale.Hungarian:
        case Locale.Italian:
        case Locale.Norwegian:
        case Locale.Polish:
        case Locale.SpanishES:
        case Locale.Swedish:
            return 'Europe/Berlin'
        case Locale.EnglishGB:
            return 'Europe/London'
        case Locale.PortugueseBR:
            return 'America/Sao_Paulo'
        case Locale.EnglishUS:
            return 'America/New_York'
        default:
            return 'UTC'
    }
}

type Timezone = (typeof timezones)[number]['id']

export const timezones = [
    {
        id: 'Pacific/Auckland',
        description: 'UTC+12:00 (UTC+13:00 DST)',
    },
    {
        id: 'Pacific/Guadalcanal',
        description: 'UTC+11:00',
    },
    {
        id: 'Australia/Sydney',
        description: 'UTC+10:00 (UTC+11:00 DST)',
    },
    {
        id: 'Asia/Tokyo',
        description: 'UTC+09:00',
    },
    {
        id: 'Asia/Shanghai',
        description: 'UTC+08:00',
    },
    {
        id: 'Asia/Bangkok',
        description: 'UTC+07:00',
    },
    {
        id: 'Asia/Dhaka',
        description: 'UTC+06:00',
    },
    {
        id: 'Asia/Kolkata',
        description: 'UTC+05:30',
    },
    {
        id: 'Asia/Karachi',
        description: 'UTC+05:00',
    },
    {
        id: 'Asia/Dubai',
        description: 'UTC+04:00',
    },
    {
        id: 'Europe/Moscow',
        description: 'UTC+03:00',
    },
    {
        id: 'Europe/Athens',
        description: 'UTC+02:00 (UTC+03:00 DST)',
    },
    {
        id: 'Europe/Berlin',
        description: 'UTC+01:00 (UTC+02:00 DST)',
    },
    {
        id: 'Europe/London',
        description: 'UTC+00:00 (UTC+01:00 DST)',
    },
    {
        id: 'UTC',
        description: 'UTC',
    },
    {
        id: 'Atlantic/Azores',
        description: 'UTC-01:00 (UTC+00:00 DST)',
    },
    {
        id: 'Atlantic/Nuuk',
        description: 'UTC-02:00',
    },
    {
        id: 'America/Sao_Paulo',
        description: 'UTC-03:00',
    },
    {
        id: 'America/Puerto_Rico',
        description: 'UTC-04:00',
    },
    {
        id: 'America/New_York',
        description: 'UTC-05:00 (UTC-04:00 DST)',
    },
    {
        id: 'America/Chicago',
        description: 'UTC-06:00 (UTC-05:00 DST)',
    },
    {
        id: 'America/Denver',
        description: 'UTC-07:00 (UTC-06:00 DST)',
    },
    {
        id: 'America/Los_Angeles',
        description: 'UTC-08:00 (UTC-07:00 DST)',
    },
    {
        id: 'Pacific/Honolulu',
        description: 'UTC-10:00',
    },
] as const
