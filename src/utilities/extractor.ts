export type ExtractedUser = {
    type: 'id' | 'name'
    value: string
}

export const extractUser = (text: string): ExtractedUser => {
    const match = text.match(/<@!?(\d+)>/)
    if (match) {
        return {
            type: 'id',
            value: match[1],
        }
    } else {
        return {
            type: 'name',
            value: text.trim(),
        }
    }
}

export const extractUsers = (text: string): ExtractedUser[] => {
    return text
        .replaceAll(/<@!?\d+>/g, ',$&,')
        .split(',')
        .map((userText) => extractUser(userText))
        .filter((user) => {
            return user.type === 'id' || user.value.length > 0
        })
}
