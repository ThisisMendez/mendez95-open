import { profanity } from '@2toad/profanity';
export function screenBoardNote(name: string, text: string, blocked: (value: string) => boolean = value => profanity.exists(value, ['en', 'es'])): boolean {
    const joined = `${name} ${text}`;
    if (/(https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|co|app|gg|xyz)\b|@\w+\.\w+)/i.test(joined))
        return false;
    if (/(.)\1{7,}/u.test(joined) || /(\b\w+\b)(?:\s+\1){5,}/iu.test(text))
        return false;
    if (/\b(?:kill|hurt|attack)\s+(?:you|them|him|her|yourself)\b/i.test(joined))
        return false;
    const normalized = joined.toLowerCase().replace(/0/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/[@4]/g, 'a').replace(/5/g, 's').replace(/\$|7/g, 't');
    return !blocked(joined) && !blocked(normalized);
}
