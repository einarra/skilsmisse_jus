import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: "test" });
console.log("Keys on openai:", Object.keys(openai));
console.log("Keys on openai.beta:", Object.keys(openai.beta));
// @ts-ignore
console.log("openai.vectorStores exists:", !!openai.vectorStores);
console.log("openai.vectorStores keys:", Object.keys(openai.vectorStores || {}));

