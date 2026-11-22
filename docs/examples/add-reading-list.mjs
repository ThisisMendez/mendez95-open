import {readFile, writeFile} from 'node:fs/promises';

const target = new URL('../../content/stories.json', import.meta.url);
const example = JSON.parse(await readFile(new URL('./reading-list-case.json', import.meta.url), 'utf8'));
const stories = JSON.parse(await readFile(target, 'utf8'));
if (!Array.isArray(stories)) throw Error('Expected an array in content/stories.json');
if (stories.some(story => story.id === example.id || story.slug === example.slug)) {
  throw Error('This tutorial case already exists. Edit it in content/stories.json instead of adding a duplicate.');
}
await writeFile(target, JSON.stringify([...stories, example], null, 2) + '\n');
console.info(`Added the fictional ${example.slug} case to content/stories.json.`);
