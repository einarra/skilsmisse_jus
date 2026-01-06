import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import OpenAI from 'openai';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const kilderDir = path.join(process.cwd(), '../kilder');
const vectorStoreName = "Skillsmisse Jus Store";
const assistantName = "Skillsmisse Jus Agent";

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("❌ OPENAI_API_KEY is not set in environment variables.");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  console.log("📂 Checking for files in:", kilderDir);
  if (!fs.existsSync(kilderDir)) {
    console.error("❌ Kilder directory not found at:", kilderDir);
    process.exit(1);
  }

  const files = fs.readdirSync(kilderDir).filter(f => f.endsWith('.pdf'));
  console.log(`found ${files.length} PDF files.`);

  // 1. Create or Get Vector Store
  let vectorStoreId;
  // @ts-ignore
  const vectorStores = await openai.beta.vectorStores.list();
  const existingStore = vectorStores.data.find((vs: any) => vs.name === vectorStoreName);

  if (existingStore) {
    console.log(`✅ Found existing Vector Store: ${existingStore.id}`);
    vectorStoreId = existingStore.id;

    // Clear existing files from store to ensure ONLY the 3 pdfs are there
    console.log("🧹 Clearing existing files from vector store...");
    // @ts-ignore
    const currentFiles = await openai.beta.vectorStores.files.list(vectorStoreId);
    for (const file of currentFiles.data) {
      // @ts-ignore
      await openai.beta.vectorStores.files.del(vectorStoreId, file.id);
    }
    console.log("✅ Vector store cleared.");
  } else {
    console.log("🚀 Creating new Vector Store...");
    // @ts-ignore
    const newStore = await openai.beta.vectorStores.create({
      name: vectorStoreName,
    });
    vectorStoreId = newStore.id;
    console.log(`✅ Created Vector Store: ${vectorStoreId}`);
  }

  // 2. Upload Files to Vector Store
  console.log("uploading files...");
  const fileIds: string[] = [];

  for (const file of files) {
    const filePath = path.join(kilderDir, file);
    console.log(`Uploading ${file}...`);
    try {
      const fileStream = fs.createReadStream(filePath);
      const uploadedFile = await openai.files.create({
        file: fileStream,
        purpose: 'assistants',
      });
      fileIds.push(uploadedFile.id);
      console.log(`✅ Uploaded ${file} (ID: ${uploadedFile.id})`);
    } catch (error) {
      console.error(`❌ Failed to upload ${file}:`, error);
    }
  }

  if (fileIds.length > 0) {
    console.log(`Adding ${fileIds.length} files to vector store...`);
    // @ts-ignore
    await openai.beta.vectorStores.fileBatches.createAndPoll(vectorStoreId, {
      file_ids: fileIds
    });
    console.log("✅ Files added to vector store.");
  } else {
    console.log("⚠️ No files were successfully uploaded.");
  }

  // 3. Create or Update Assistant
  const assistants = await openai.beta.assistants.list();
  const existingAssistant = assistants.data.find(a => a.name === assistantName);

  let assistantId;
  const instructions = `
Du er en juridisk assistent som spesialiserer seg på norsk skilsmesse- og familierett.
Den viktigste loven er "lov om ekteskap", som finnes i kildene mine i vector store. Men de andre lovene er også viktige.

Du har tilgang til opplastede dokumenter i din vector store og et søkeverktøy \`search_legal\`.

BRUK AV SØKEVERKTØY (search_legal):
1. **Strategisk søk**: Når du bruker \`search_legal\`, skal du trekke ut spesifikke juridiske nøkkelord, paragrafnumre eller rettslige begreper fra brukerens spørsmål for å få best mulige resultater.
2. **Iterativ prosess**: Dersom det første søket ikke gir relevante svar, eller informasjonen er mangelfull, skal du endre søkeordene (f.eks. bruke synonymer eller mer spesifikke termer) og søke på nytt. Du kan gjøre flere søk etter hverandre for å sikre et korrekt og utfyllende svar.
3. **Kombiner kilder**: Start alltid med å søke i de opplastede dokumentene i vector store. Bruk deretter \`search_legal\` for å berike svaret med praksis, tolkninger og oppdatert informasjon fra lovdata.no, SNL.no og wikipedia.org.

VIKTIG OM KILDEHENVISNING:
- Du skal ALLTID oppgi hvilken lov og hvilken paragraf (§) svaret ditt er basert på (f.eks: "I henhold til Ekteskapsloven § 58...").
- **Klippbare lenker**: Du skal ALLTID formatere juridiske kilder og referanser som klikkbare Markdown-lenker hvis du har en URL. Bruk formatet: \`[Ekteskapsloven § 58](URL)\`.
- Du skal legge ved direkte lenker til alle relevante kilder du finner via \`search_legal\`, spesielt til lovdata.no når mulig.
- Ikke skriv rå URL-er i teksten, bruk alltid [Beskrivelse](URL).

Dersom du etter flere søk fortsatt ikke finner svaret, skal du tydelig si: "Jeg finner ikke informasjon om dette i kildene mine".
Vær saklig, presis, og hjelpsom. Svar på norsk.
  `.trim();

  const tools: OpenAI.Beta.AssistantTool[] = [
    { type: "file_search" },
    {
      type: "function",
      function: {
        name: "search_legal",
        description: "Søk etter juridisk informasjon på lovdata.no, SNL.no og wikipedia.org. Bruk dette til å berike svaret ditt med hvordan regelverket er fulgt i praksis.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Søkeord eller spørsmål."
            }
          },
          required: ["query"]
        }
      }
    }
  ];

  if (existingAssistant) {
    console.log(`✅ Found existing Assistant: ${existingAssistant.id}`);
    assistantId = existingAssistant.id;

    // Update instructions and tool resources just in case
    await openai.beta.assistants.update(assistantId, {
      instructions: instructions,
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStoreId]
        }
      },
      tools: tools
    });
    console.log("Updated assistant with latest settings.");
  } else {
    console.log("🚀 Creating new Assistant...");
    const newAssistant = await openai.beta.assistants.create({
      name: assistantName,
      instructions: instructions,
      model: "gpt-4o",
      tools: tools,
      tool_resources: {
        file_search: {
          vector_store_ids: [vectorStoreId]
        }
      }
    });
    assistantId = newAssistant.id;
    console.log(`✅ Created Assistant: ${assistantId}`);
  }

  console.log("\n🎉 Setup Complete!");
  console.log(`Assistant ID: ${assistantId}`);
  console.log(`Vector Store ID: ${vectorStoreId}`);
  console.log("\nAdd these to your .env.local file:");
  console.log(`ASSISTANT_ID=${assistantId}`);
}

main().catch(console.error);
